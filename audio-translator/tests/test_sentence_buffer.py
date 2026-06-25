import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from translator import SentenceBuffer


def test_no_flush_without_trigger():
    buf = SentenceBuffer()
    buf.append("hello world", "en", 3.0)
    text, lang = buf.flush_if_needed()
    assert text == ""
    assert lang == ""


def test_flush_on_period():
    buf = SentenceBuffer()
    buf.append("Hello world.", "en", 3.0)
    text, lang = buf.flush_if_needed()
    assert text == "Hello world."
    assert lang == "en"


def test_flush_on_question_mark():
    buf = SentenceBuffer()
    buf.append("How are you?", "en", 3.0)
    text, lang = buf.flush_if_needed()
    assert text == "How are you?"


def test_flush_on_japanese_punctuation():
    buf = SentenceBuffer()
    buf.append("こんにちは。", "ja", 3.0)
    text, lang = buf.flush_if_needed()
    assert text == "こんにちは。"
    assert lang == "ja"


def test_flush_on_force():
    buf = SentenceBuffer()
    buf.append("incomplete sentence", "en", 3.0)
    text, lang = buf.flush_if_needed(force=True)
    assert text == "incomplete sentence"
    assert lang == "en"


def test_flush_on_duration_overflow():
    buf = SentenceBuffer()
    buf.append("first chunk", "en", 8.0)
    buf.append("second chunk", "en", 8.0)   # total 16s > MAX_BUFFER_DURATION (15s)
    text, lang = buf.flush_if_needed()
    assert text == "first chunk second chunk"
    assert lang == "en"


def test_clears_after_flush():
    buf = SentenceBuffer()
    buf.append("Hello.", "en", 3.0)
    buf.flush_if_needed()
    buf.append("Next", "en", 3.0)           # no punctuation
    text, _ = buf.flush_if_needed()
    assert text == ""


def test_lang_uses_most_recently_detected():
    buf = SentenceBuffer()
    buf.append("first", "en", 3.0)
    buf.append("second.", "ko", 3.0)
    _, lang = buf.flush_if_needed()
    assert lang == "ko"


def test_empty_buffer_force_returns_empty():
    buf = SentenceBuffer()
    text, lang = buf.flush_if_needed(force=True)
    assert text == ""
    assert lang == ""


def test_multi_chunk_joined_with_space():
    buf = SentenceBuffer()
    buf.append("  Hello", "en", 3.0)
    buf.append("world.  ", "en", 3.0)
    text, _ = buf.flush_if_needed()
    assert text == "Hello world."
