import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from translator import should_translate, LANGUAGE_OPTIONS


def test_different_langs_should_translate():
    assert should_translate("en", "ko") is True


def test_same_lang_skips_translation():
    assert should_translate("en", "en") is False


def test_chinese_zh_maps_to_zh_cn():
    assert should_translate("zh", "zh-CN") is False


def test_chinese_word_maps_to_zh_cn():
    assert should_translate("chinese", "zh-CN") is False


def test_french_to_english_translates():
    assert should_translate("fr", "en") is True


def test_case_insensitive_detected():
    assert should_translate("EN", "en") is False


def test_case_insensitive_target():
    assert should_translate("en", "EN") is False


def test_language_options_has_six_entries():
    assert len(LANGUAGE_OPTIONS) == 6


def test_all_expected_languages_present():
    expected = {"English", "Korean", "Japanese", "Spanish", "Chinese Simplified", "French"}
    assert set(LANGUAGE_OPTIONS.keys()) == expected
