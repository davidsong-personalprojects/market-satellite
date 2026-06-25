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
