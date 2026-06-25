# Audio Translator — Design Spec
**Date:** 2026-06-25  
**Status:** Approved

---

## Overview

A real-time audio translation desktop app for macOS. Captures system audio via BlackHole, transcribes with local Whisper, translates with deep-translator (Google backend), and renders subtitles in a transparent always-on-top overlay. Runs entirely offline and free — no paid APIs.

Output: single Python file at `audio-translator/translator.py`.

---

## Tech Stack

| Concern | Library |
|---|---|
| Audio capture | `sounddevice` |
| Transcription | `openai-whisper` (local, base model default) |
| Translation | `deep-translator` (GoogleTranslator backend) |
| UI | `tkinter` (stdlib) |
| Numerics | `numpy` |
| Python | 3.10+ |

All free and open source. No cloud dependencies.

---

## Architecture

Three daemon threads connected by two `queue.Queue` instances. tkinter main loop runs on the main thread (macOS requirement).

```
[Thread 1: Audio Capture]
  sounddevice.InputStream (BlackHole 2ch or user-selected device)
  → 3–5s PCM chunks → audio_queue

[Thread 2: Transcription]
  audio_queue → whisper.transcribe()
  → language detection (result["language"])
  → sentence buffer accumulation
  → flush to translation_queue on boundary trigger

[Thread 3: Translation + Display]
  translation_queue → language passthrough check
  → GoogleTranslator.translate() (skipped if src == target)
  → root.after() to push text to subtitle window

[Main thread]
  tkinter event loop
  subtitle window + control panel window
```

Stop signal: `threading.Event` shared across threads. Set on Stop button press; all threads exit their loops on next iteration.

---

## Sentence Buffer Logic

Thread 2 maintains a rolling string buffer of Whisper output chunks. A flush is triggered when **any** of the following conditions is met:

1. **Punctuation boundary:** buffer ends with `.`, `?`, `!`, `。`, `？`, `！` (Japanese/Korean sentence-enders)
2. **Silence detection:** Whisper segment has `no_speech_prob > 0.6`, treated as a ~1.5s silence gap
3. **Time overflow:** accumulated audio timestamps in buffer exceed 15 seconds

On flush: buffer is cleared and the complete sentence is enqueued to `translation_queue`. Previous subtitle is replaced entirely on display (no word-by-word updates).

---

## Language Passthrough

After Whisper returns `result["language"]` (ISO 639-1 code), compare against the user's selected target language (also stored as ISO 639-1). If equal, send `result["text"]` directly to the display without calling `deep-translator`.

Supported target languages and their codes:

| Label | ISO 639-1 |
|---|---|
| English | en |
| Korean | ko |
| Japanese | ja |
| Spanish | es |
| Chinese Simplified | zh-CN |
| French | fr |

---

## UI: Subtitle Window

- Full-screen borderless tkinter `Toplevel`, `overrideredirect(True)`
- `wm_attributes("-topmost", True)`, `wm_attributes("-transparent", True)`
- `Canvas` widget spanning full screen dimensions
- Per subtitle update: draw dark semi-transparent rectangle at bottom-center first, then white text on top
- Font: IBM Plex Mono or system monospace, size from slider (16–72px)
- No hover states; display-only

---

## UI: Control Panel

- Small always-on-top `Tk()` root window (not Toplevel — it's the main window)
- Draggable via `<ButtonPress-1>` / `<B1-Motion>` bindings
- Positioned top-right by default; does not overlap subtitle area
- Widgets:
  - **Device selector:** `OptionMenu` populated at startup from `sounddevice.query_devices()`; defaults to BlackHole 2ch if present
  - **Target language:** `OptionMenu` with 6 supported languages; default English
  - **Font size:** `Scale` widget, range 16–72, default 32
  - **Start / Stop:** single `Button` that toggles state and spawns/signals threads
  - **Status:** `Label` showing one of: `Stopped`, `Listening`, `Translating`

---

## Audio Processing

- `sounddevice.InputStream` with `samplerate=16000`, `channels=1`, `dtype='float32'`
- Callback appends raw frames to a numpy rolling buffer
- Every 3–5 seconds, buffer snapshot is passed to `whisper.transcribe()`
- Whisper model loaded once at startup (base by default); kept in memory for session

---

## macOS Requirements (comments in code)

1. Grant microphone access: System Preferences → Privacy & Security → Microphone → allow Terminal/IDE
2. Install BlackHole 2ch from `existingblackholeapp.com` (free)
3. Create Multi-Output Device in Audio MIDI Setup combining BlackHole 2ch + built-in speakers
4. Set system audio output to that Multi-Output Device
5. Select "BlackHole 2ch" in the app's device selector

---

## File Structure

```
audio-translator/
└── translator.py   ← single output file
```

All `pip install` commands listed as comments at the top of `translator.py`:
```
# pip install openai-whisper sounddevice numpy deep-translator
# brew install ffmpeg  (required by whisper)
```

---

## Error Handling

- Device not found: show error in status label, disable Start
- Whisper model load failure: surface exception in status label
- Translation API failure: display raw transcript (graceful degradation)
- Thread exceptions: caught and surfaced to status label; do not crash the UI

---

## Out of Scope

- Model selector in UI (base model only; user changes in code)
- Watchlist / history of past subtitles
- PWA / push notifications
- AI synthesis layer
- Windows / Linux support
