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
from typing import Optional

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
