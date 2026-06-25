# Real-Time Audio Translator for macOS
#
# INSTALL DEPENDENCIES (run once):
#   pip install openai-whisper sounddevice numpy deep-translator
#   brew install ffmpeg
#
# MACOS MICROPHONE PERMISSION:
#   System Preferences → Privacy & Security → Microphone → grant access to Terminal / your IDE
#
# BLACKHOLE SETUP (required to capture system audio):
#   1. Install BlackHole 2ch (free): https://existingblackholeapp.com
#   2. Open Audio MIDI Setup → click "+" → "Create Multi-Output Device"
#      → tick BlackHole 2ch AND Built-in Output (or your speakers/headphones)
#   3. System Preferences → Sound → Output → select that Multi-Output Device
#   4. In this app's control panel, select "BlackHole 2ch" as the input device

import queue
import threading
import tkinter as tk
from typing import Callable, List, Optional, Tuple

import numpy as np
import sounddevice as sd
import whisper
from deep_translator import GoogleTranslator

# ── Constants ─────────────────────────────────────────────────────────────────
SAMPLE_RATE = 16_000          # Hz — Whisper expects 16 kHz mono
CHUNK_DURATION = 3            # seconds of audio per transcription batch
MAX_BUFFER_DURATION = 15.0    # force-flush sentence buffer after this many seconds
NO_SPEECH_THRESHOLD = 0.6     # Whisper no_speech_prob above this → treat as silence
SENTENCE_ENDINGS = frozenset('.?!。？！')
DEFAULT_WHISPER_MODEL = "base"
DEFAULT_FONT_SIZE = 32
SUBTITLE_BOTTOM_OFFSET = 80   # px from bottom of screen to subtitle centre
SUBTITLE_PADDING = 12         # px padding around subtitle background rectangle
PANEL_WIDTH = 300
PANEL_HEIGHT = 240

# ── Sentence Buffer ───────────────────────────────────────────────────────────
class SentenceBuffer:
    """Accumulates Whisper text chunks; flushes on sentence boundaries."""

    def __init__(self):
        self._texts: list[str] = []
        self._lang: str = "en"
        self._duration: float = 0.0

    def append(self, text: str, lang: str, duration: float) -> None:
        self._texts.append(text.strip())
        self._lang = lang
        self._duration += duration

    def flush_if_needed(self, force: bool = False) -> tuple[str, str]:
        """Return (sentence, lang) and clear, or ('', '') if not flushing yet."""
        if not self._texts:
            return "", ""
        full_text = " ".join(self._texts).strip()
        ends_sentence = bool(full_text) and full_text[-1] in SENTENCE_ENDINGS
        if force or ends_sentence or self._duration >= MAX_BUFFER_DURATION:
            lang = self._lang
            self._texts.clear()
            self._duration = 0.0
            return full_text, lang
        return "", ""

    def clear(self) -> None:
        self._texts.clear()
        self._duration = 0.0


# ── Language Utilities ────────────────────────────────────────────────────────
LANGUAGE_OPTIONS: dict[str, str] = {
    "English": "en",
    "Korean": "ko",
    "Japanese": "ja",
    "Spanish": "es",
    "Chinese Simplified": "zh-CN",
    "French": "fr",
}

# Whisper uses its own language codes; Chinese diverges from ISO 639-1
_WHISPER_TO_ISO: dict[str, str] = {
    "chinese": "zh-CN",
    "zh": "zh-CN",
}


def _normalize_lang(whisper_lang: str) -> str:
    return _WHISPER_TO_ISO.get(whisper_lang.lower(), whisper_lang.lower()).lower()


def should_translate(whisper_lang: str, target_iso: str) -> bool:
    """False when detected language already matches the target — skip translation."""
    return _normalize_lang(whisper_lang) != target_iso.lower()


# ── Thread 1: Audio Capture ───────────────────────────────────────────────────
class AudioCaptureThread(threading.Thread):
    """Streams audio from a sounddevice input; pushes CHUNK_DURATION-second numpy chunks."""

    def __init__(self, device_index: Optional[int], audio_queue: queue.Queue, stop_event: threading.Event):
        super().__init__(daemon=True)
        self.device_index = device_index
        self.audio_queue = audio_queue
        self.stop_event = stop_event

    def run(self) -> None:
        target_frames = SAMPLE_RATE * CHUNK_DURATION
        accumulated: list[np.ndarray] = []
        acc_len = 0

        def _callback(indata: np.ndarray, frame_count: int, time_info, status) -> None:
            nonlocal acc_len
            accumulated.append(indata.copy())
            acc_len += frame_count
            if acc_len >= target_frames:
                chunk = np.concatenate(accumulated).flatten()
                try:
                    self.audio_queue.put_nowait(chunk)
                except queue.Full:
                    pass  # drop chunk if transcription can't keep up
                accumulated.clear()
                acc_len = 0

        with sd.InputStream(
            device=self.device_index,
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype="float32",
            callback=_callback,
        ):
            self.stop_event.wait()  # block until stop is requested; callback runs on its own thread


# ── Thread 2: Transcription ───────────────────────────────────────────────────
class TranscriptionThread(threading.Thread):
    """Transcribes audio chunks with Whisper; feeds SentenceBuffer; flushes sentences downstream."""

    def __init__(
        self,
        model,
        audio_queue: queue.Queue,
        translation_queue: queue.Queue,
        stop_event: threading.Event,
        status_callback,
    ):
        super().__init__(daemon=True)
        self.model = model
        self.audio_queue = audio_queue
        self.translation_queue = translation_queue
        self.stop_event = stop_event
        self.status_callback = status_callback
        self._buf = SentenceBuffer()

    def run(self) -> None:
        while not self.stop_event.is_set():
            try:
                audio_chunk = self.audio_queue.get(timeout=1.0)
            except queue.Empty:
                continue

            self.status_callback("Transcribing")
            result = self.model.transcribe(audio_chunk, fp16=False, verbose=False)

            text: str = result.get("text", "").strip()
            lang: str = result.get("language", "en")
            segments: list = result.get("segments", [])

            # Silence: no text, or every segment has high no_speech_prob
            is_silent = not text or (
                bool(segments)
                and all(seg.get("no_speech_prob", 1.0) > NO_SPEECH_THRESHOLD for seg in segments)
            )

            duration = segments[-1]["end"] if segments else float(CHUNK_DURATION)

            if text and not is_silent:
                self._buf.append(text, lang, duration)

            sentence, detected_lang = self._buf.flush_if_needed(force=is_silent)
            if sentence:
                self.translation_queue.put((sentence, detected_lang))

            self.status_callback("Listening")


# ── Thread 3: Translation + Display ───────────────────────────────────────────
class TranslationThread(threading.Thread):
    """Translates completed sentences; hands result to display_callback via root.after."""

    def __init__(
        self,
        translation_queue: queue.Queue,
        get_target_iso,      # callable() -> str  (reads current UI selection)
        status_callback,     # callable(str) -> None
        display_callback,    # callable(str) -> None
        stop_event: threading.Event,
    ):
        super().__init__(daemon=True)
        self.translation_queue = translation_queue
        self.get_target_iso = get_target_iso
        self.status_callback = status_callback
        self.display_callback = display_callback
        self.stop_event = stop_event

    def run(self) -> None:
        while not self.stop_event.is_set():
            try:
                sentence, detected_lang = self.translation_queue.get(timeout=1.0)
            except queue.Empty:
                continue

            target_iso = self.get_target_iso()

            if should_translate(detected_lang, target_iso):
                self.status_callback("Translating")
                try:
                    translated = GoogleTranslator(source="auto", target=target_iso).translate(sentence)
                except Exception:
                    translated = sentence   # graceful degradation: show raw transcript
            else:
                translated = sentence       # detected lang matches target — skip API call

            self.display_callback(translated)
            self.status_callback("Listening")


# ── Subtitle Overlay Window ───────────────────────────────────────────────────
class SubtitleWindow:
    """Full-screen borderless transparent overlay; renders subtitles at the bottom."""

    def __init__(self, root: tk.Tk):
        self.win = tk.Toplevel(root)
        self.win.overrideredirect(True)
        self.win.attributes("-topmost", True)
        self.win.attributes("-transparent", True)
        self.win.configure(bg="systemTransparent")

        sw = self.win.winfo_screenwidth()
        sh = self.win.winfo_screenheight()
        self.win.geometry(f"{sw}x{sh}+0+0")
        self._sw = sw
        self._sh = sh

        self.canvas = tk.Canvas(
            self.win,
            width=sw,
            height=sh,
            bg="systemTransparent",
            highlightthickness=0,
        )
        self.canvas.pack()

    def update_subtitle(self, text: str, font_size: int) -> None:
        """Replace current subtitle. Call only from the main thread (use root.after)."""
        self.canvas.delete("all")
        if not text:
            return

        font_tuple = ("Menlo", font_size, "bold")
        center_x = self._sw // 2
        text_y = self._sh - SUBTITLE_BOTTOM_OFFSET

        # Render off-screen to measure bounding box, then redraw in z-order
        probe = self.canvas.create_text(
            center_x, text_y,
            text=text, font=font_tuple, fill="white",
            width=self._sw - 100, anchor="center",
        )
        bbox = self.canvas.bbox(probe)
        self.canvas.delete(probe)

        p = SUBTITLE_PADDING
        # Dark semi-transparent backing rectangle (stipple="gray75" ≈ 75% opacity on macOS)
        self.canvas.create_rectangle(
            bbox[0] - p, bbox[1] - p, bbox[2] + p, bbox[3] + p,
            fill="#111111", outline="", stipple="gray75",
        )

        # White text on top
        self.canvas.create_text(
            center_x, text_y,
            text=text, font=font_tuple, fill="white",
            width=self._sw - 100, anchor="center",
        )


# ── Audio Device Helper ───────────────────────────────────────────────────────
def _get_audio_devices() -> List[Tuple[Optional[int], str]]:
    """Return (index, name) for all input-capable devices."""
    devices = [
        (i, dev["name"])
        for i, dev in enumerate(sd.query_devices())
        if dev["max_input_channels"] > 0
    ]
    return devices if devices else [(None, "Default")]


# ── Control Panel ─────────────────────────────────────────────────────────────
class ControlPanel:
    """Small always-on-top settings window; draggable; manages pipeline start/stop."""

    def __init__(
        self,
        root: tk.Tk,
        devices: List[Tuple[Optional[int], str]],
        on_start: Callable[[Optional[int]], None],
        on_stop: Callable[[], None],
        target_lang_var: tk.StringVar,
        status_var: tk.StringVar,
        font_size_var: tk.IntVar,
    ):
        self._root = root
        self._on_start = on_start
        self._on_stop = on_stop
        self._running = False
        self._drag_x = self._drag_y = 0

        root.title("Audio Translator")
        root.attributes("-topmost", True)
        root.resizable(False, False)

        # Position panel top-right, clear of subtitle area
        sw = root.winfo_screenwidth()
        root.geometry(f"{PANEL_WIDTH}x{PANEL_HEIGHT}+{sw - PANEL_WIDTH - 20}+20")

        # Drag support (click anywhere on panel to drag)
        root.bind("<ButtonPress-1>", self._drag_start)
        root.bind("<B1-Motion>", self._drag_motion)

        frame = tk.Frame(root, padx=10, pady=10)
        frame.pack(fill="both", expand=True)

        # Device selector
        tk.Label(frame, text="Input device:").grid(row=0, column=0, sticky="w", pady=2)
        self._device_map: dict[str, Optional[int]] = {name: idx for idx, name in devices}
        device_names = list(self._device_map.keys())
        self._device_var = tk.StringVar(value=device_names[0])
        tk.OptionMenu(frame, self._device_var, *device_names).grid(row=0, column=1, sticky="ew", pady=2)

        # Target language
        tk.Label(frame, text="Target language:").grid(row=1, column=0, sticky="w", pady=2)
        tk.OptionMenu(frame, target_lang_var, *LANGUAGE_OPTIONS.keys()).grid(row=1, column=1, sticky="ew", pady=2)

        # Font size
        tk.Label(frame, text="Font size:").grid(row=2, column=0, sticky="w", pady=2)
        tk.Scale(frame, from_=16, to=72, orient="horizontal", variable=font_size_var).grid(
            row=2, column=1, sticky="ew", pady=2
        )

        # Start / Stop toggle
        self._btn = tk.Button(frame, text="Start", command=self._toggle, width=12)
        self._btn.grid(row=3, column=0, columnspan=2, pady=8)

        # Status indicator
        tk.Label(frame, textvariable=status_var, fg="#888888").grid(row=4, column=0, columnspan=2)

        frame.columnconfigure(1, weight=1)

    def _drag_start(self, event) -> None:
        self._drag_x = event.x_root - self._root.winfo_x()
        self._drag_y = event.y_root - self._root.winfo_y()

    def _drag_motion(self, event) -> None:
        self._root.geometry(f"+{event.x_root - self._drag_x}+{event.y_root - self._drag_y}")

    def _toggle(self) -> None:
        if self._running:
            self._on_stop()
            self._btn.configure(text="Start")
        else:
            device_idx = self._device_map.get(self._device_var.get())
            self._on_start(device_idx)
            self._btn.configure(text="Stop")
        self._running = not self._running


# ── Main Entry Point ──────────────────────────────────────────────────────────
def main() -> None:
    print(f"Loading Whisper '{DEFAULT_WHISPER_MODEL}' model…")
    model = whisper.load_model(DEFAULT_WHISPER_MODEL)
    print("Model ready.")

    audio_q: queue.Queue = queue.Queue(maxsize=10)
    translation_q: queue.Queue = queue.Queue(maxsize=10)
    stop_event = threading.Event()
    active_threads: list = []

    root = tk.Tk()
    root.withdraw()

    subtitle_win = SubtitleWindow(root)

    target_lang_var = tk.StringVar(value="English")
    status_var = tk.StringVar(value="Stopped")
    font_size_var = tk.IntVar(value=DEFAULT_FONT_SIZE)

    def status_callback(status: str) -> None:
        root.after(0, status_var.set, status)

    def display_callback(text: str) -> None:
        root.after(0, subtitle_win.update_subtitle, text, font_size_var.get())

    def get_target_iso() -> str:
        return LANGUAGE_OPTIONS.get(target_lang_var.get(), "en")

    def _drain_queue(q: queue.Queue) -> None:
        while not q.empty():
            try:
                q.get_nowait()
            except queue.Empty:
                break

    def start_pipeline(device_index: Optional[int]) -> None:
        _drain_queue(audio_q)
        _drain_queue(translation_q)
        stop_event.clear()
        t1 = AudioCaptureThread(device_index, audio_q, stop_event)
        t2 = TranscriptionThread(model, audio_q, translation_q, stop_event, status_callback)
        t3 = TranslationThread(translation_q, get_target_iso, status_callback, display_callback, stop_event)
        active_threads.clear()
        active_threads.extend([t1, t2, t3])
        for t in active_threads:
            t.start()
        status_callback("Listening")

    def stop_pipeline() -> None:
        stop_event.set()
        for t in active_threads:
            t.join(timeout=3.0)
        active_threads.clear()
        status_callback("Stopped")
        root.after(0, subtitle_win.update_subtitle, "", DEFAULT_FONT_SIZE)

    devices = _get_audio_devices()
    ControlPanel(root, devices, start_pipeline, stop_pipeline, target_lang_var, status_var, font_size_var)

    root.deiconify()
    root.mainloop()


if __name__ == "__main__":
    main()
