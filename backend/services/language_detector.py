"""
Language Detector Service for VAYLUME.

Detects Indian languages (native scripts) and code-mixed Romanized transliterations
(Tenglish, Hinglish, Tanglish, Kanglish) as well as English.

Supported target languages:
- Telugu (Telugu script + Tenglish)
- Hindi (Devanagari script + Hinglish)
- Gujarati (Gujarati script)
- Marathi (Devanagari script with Marathi lexical markers)
- Kannada (Kannada script + Kanglish)
- Tamil (Tamil script + Tanglish)
- Malayalam (Malayalam script)
- Bengali (Bengali script)
- Punjabi (Gurmukhi script)
- English (Latin script)
"""

from __future__ import annotations

import re
from typing import Dict, NamedTuple, Optional, Tuple


class DetectionResult(NamedTuple):
    detected_display: str       # e.g. "Telugu", "Telugu (Tenglish)", "Hindi (Hinglish)", "English"
    normalized_language: str    # e.g. "Telugu", "Hindi", "English" (matches NoteLanguage enum)
    is_romanized: bool          # True if written in Latin alphabet
    confidence: float           # 0.0 to 1.0


# ── Unicode character ranges ──────────────────────────────────────────────────
_SCRIPT_RANGES = [
    ("Telugu",    0x0C00, 0x0C7F),
    ("Devanagari",0x0900, 0x097F),
    ("Gujarati",  0x0A80, 0x0AFF),
    ("Kannada",   0x0C80, 0x0CFF),
    ("Tamil",     0x0B80, 0x0BFF),
    ("Malayalam", 0x0D00, 0x0D7F),
    ("Bengali",   0x0980, 0x09FF),
    ("Punjabi",   0x0A00, 0x0A7F),
]

# Lexical markers for Devanagari script disambiguation (Marathi vs Hindi)
_MARATHI_NATIVE_WORDS = {"आहे", "आणि", "नाही", "कसे", "काय", "मध्ये", "वर", "तर", "हे", "ते", "झाले", "केले", "सांगा", "बद्दल"}
_HINDI_NATIVE_WORDS = {"है", "और", "नहीं", "कैसे", "क्या", "में", "पर", "तो", "यह", "वह", "हुआ", "किया", "बताओ", "बारे"}

# Code-mixed Romanized transliteration token patterns (case-insensitive)
_TENGLISH_PATTERNS = {
    "gurinchi", "cheppu", "cheppandi", "cheyyi", "chey", "cheyyandi", "ela", "enti", "chudu",
    "nerchuko", "bagundi", "telusuko", "manchi", "kani", "kuda", "ikkada", "akkada", "enduku",
    "ippudu", "appudu", "undhi", "unnadu", "unnam", "chesanu", "chesindi", "ivvandi", "kavali",
    "emiti", "ardham", "chesukovali", "teliyadu", "cheppava", "nerpinchu", "ani"
}

_HINGLISH_PATTERNS = {
    "kaise", "kya", "hai", "hain", "batao", "samjhao", "mujhe", "karna", "karo", "karein",
    "hoga", "nahi", "aur", "lekin", "kripya", "padhai", "seekhna", "chahiye", "samajh",
    "kyun", "kab", "kahan", "kaisa", "bataye", "samjha", "karke", "bhi", "tha", "the"
}

_TANGLISH_PATTERNS = {
    "epdi", "enna", "solunga", "solli", "puriyala", "puriyum", "nalla", "pannunga", "pannu",
    "pathu", "romba", "ethukku", "theriyum", "theriyala", "enga", "enga irukku", "vaanga"
}

_KANGLISH_PATTERNS = {
    "hege", "yenu", "heli", "helu", "madi", "madu", "channagide", "gothilla", "gothu",
    "tumba", "yaake", "illi", "alli", "beku", "beda", "nange", "nimge"
}


def detect_language(text: str) -> DetectionResult:
    """
    Detect language of input text.
    Returns DetectionResult with display label, normalized language, romanized flag, and confidence.
    """
    if not text or not text.strip():
        return DetectionResult("English", "English", False, 1.0)

    clean_text = text.strip()
    words = re.findall(r"\b[A-Za-z0-9_'\u0900-\u0D7F]+\b", clean_text)
    lower_words = [w.lower() for w in words]

    # 1. Count characters across Unicode Indic scripts
    script_counts: Dict[str, int] = {name: 0 for name, _, _ in _SCRIPT_RANGES}
    latin_count = 0
    total_alpha = 0

    for ch in clean_text:
        code = ord(ch)
        if ('a' <= ch <= 'z') or ('A' <= ch <= 'Z'):
            latin_count += 1
            total_alpha += 1
            continue

        for name, start, end in _SCRIPT_RANGES:
            if start <= code <= end:
                script_counts[name] += 1
                total_alpha += 1
                break

    # If native Indic script characters are present and dominant
    indic_total = sum(script_counts.values())
    if indic_total > 0 and indic_total >= (latin_count * 0.4):
        best_script = max(script_counts, key=script_counts.get)
        confidence = min(1.0, round(script_counts[best_script] / max(1, indic_total) * 0.95 + 0.05, 2))

        if best_script == "Devanagari":
            # Disambiguate Hindi vs Marathi
            marathi_matches = sum(1 for w in words if w in _MARATHI_NATIVE_WORDS)
            hindi_matches = sum(1 for w in words if w in _HINDI_NATIVE_WORDS)
            if marathi_matches > hindi_matches:
                return DetectionResult("Marathi", "Marathi", False, confidence)
            return DetectionResult("Hindi", "Hindi", False, confidence)

        return DetectionResult(best_script, best_script, False, confidence)

    # 2. Check for Romanized Indic transliterations (Tenglish, Hinglish, etc.)
    if lower_words:
        tenglish_score = sum(1 for w in lower_words if w in _TENGLISH_PATTERNS)
        hinglish_score = sum(1 for w in lower_words if w in _HINGLISH_PATTERNS)
        tanglish_score = sum(1 for w in lower_words if w in _TANGLISH_PATTERNS)
        kanglish_score = sum(1 for w in lower_words if w in _KANGLISH_PATTERNS)

        scores = [
            ("Telugu (Tenglish)", "Telugu", tenglish_score),
            ("Hindi (Hinglish)",   "Hindi",  hinglish_score),
            ("Tamil (Tanglish)",   "Tamil",  tanglish_score),
            ("Kannada (Kanglish)", "Kannada",kanglish_score),
        ]
        scores.sort(key=lambda s: s[2], reverse=True)
        top_name, top_norm, top_count = scores[0]

        if top_count > 0:
            confidence = min(0.95, round(0.65 + (top_count * 0.1), 2))
            return DetectionResult(top_name, top_norm, True, confidence)

    # 3. Default to English
    return DetectionResult("English", "English", False, 0.95)
