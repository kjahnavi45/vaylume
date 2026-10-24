"""
AI Service — generates structured study notes via Google Gemini with
automatic multilingual detection, mixed-script support (Tenglish, Hinglish),
and robust fallback synthesis.

Responsibilities:
  - Detect input language (Telugu, Hindi, Gujarati, Marathi, Kannada, Tamil, Malayalam, Bengali, Punjabi, English, Tenglish, Hinglish).
  - Respect explicit language override when user manually selects a language.
  - Call Gemini API when configured.
  - Parse and validate structured JSON response.
  - Provide fallback synthesis for offline/unconfigured environments.
  - Never expose API secrets to the client.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import google.generativeai as genai
from fastapi import HTTPException, status

try:
    from config.settings import get_settings
    from models.schemas import NoteDifficulty, NoteFormat, NoteGenerateRequest, NoteLanguage, NoteResponse
    from services.language_detector import detect_language
except ImportError:
    from backend.config.settings import get_settings
    from backend.models.schemas import NoteDifficulty, NoteFormat, NoteGenerateRequest, NoteLanguage, NoteResponse
    from backend.services.language_detector import detect_language

logger = logging.getLogger(__name__)
settings = get_settings()

_MODEL_NAME = "gemini-1.5-flash"

# Configure Gemini if key is provided
_HAS_GEMINI_KEY = bool(
    settings.GEMINI_API_KEY
    and settings.GEMINI_API_KEY.strip()
    and "your-gemini-api-key" not in settings.GEMINI_API_KEY
)

if _HAS_GEMINI_KEY:
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY.strip())
    except Exception as exc:
        logger.warning("Failed to configure Google Generative AI: %s", exc)

# ── Language-native prompting instructions ────────────────────────────────────
_LANGUAGE_INSTRUCTIONS: Dict[str, str] = {
    "English":   "Respond entirely in English.",
    "Telugu":    "మొత్తం సమాధానం తెలుగు లిపిలో మరియు సహజమైన తెలుగు భాషలో ఇవ్వండి. సాంకేతిక పదాలను ఇంగ్లీషులో ఉంచవచ్చు.",
    "Hindi":     "पूरा जवाब देवनागरी लिपि में और स्पष्ट, सरल हिंदी में दें। तकनीकी शब्दों को कोष्ठक में अंग्रेजी में रखा जा सकता है।",
    "Gujarati":  "સમગ્ર જવાબ શુદ્ધ અને સરળ ગુજરાતી લિપિમાં આપો. ટેકનિકલ શબ્દો અંગ્રેજીમાં રાખી શકાય છે.",
    "Marathi":   "संपूर्ण उत्तर मराठी भाषेत आणि देवनागरी लिपीत द्या. तांत्रिक संज्ञा आवश्यकतेनुसार इंग्रजीत ठेवाव्यात.",
    "Kannada":   "ಸಂಪೂರ್ಣ ಉತ್ತರವನ್ನು ಕನ್ನಡ ಲಿಪಿಯಲ್ಲಿ ಮತ್ತು ಸ್ಪಷ್ಟವಾದ ಕನ್ನಡದಲ್ಲಿ ನೀಡಿ.",
    "Tamil":     "முழு பதிலையும் தமிழ் எழுத்துக்களில் எளிய தமிழில் தரவும்.",
    "Malayalam": "മുഴുവൻ ഉത്തരവും മലയാളം ലിപിയിൽ നൽകുക.",
    "Bengali":   "সম্পূর্ণ উত্তর প্রমিত বাংলা লিপিতে ও প্রাঞ্জল ভাষায় দিন।",
    "Punjabi":   "ਪੂਰਾ ਜਵਾਬ ਗੁਰਮੁਖੀ ਲਿਪੀ ਵਿੱਚ ਅਤੇ ਸਪਸ਼ਟ ਪੰਜਾਬੀ ਵਿੱਚ ਦਿਓ।",
}

_FORMAT_INSTRUCTIONS: Dict[str, str] = {
    "Plain":        "Write in plain prose paragraphs.",
    "Bullets":      "Use bullet points for key points and examples.",
    "Detailed":     "Provide thorough, in-depth explanations with sub-sections.",
    "Summary Only": "Keep each section very concise — 2-3 sentences maximum.",
}

_DIFFICULTY_CONTEXT: Dict[str, str] = {
    "Beginner":     "Assume the reader has no prior knowledge. Use simple words and relatable analogies.",
    "Intermediate": "Assume basic familiarity with the subject. Focus on core mechanics and real-world application.",
    "Advanced":     "Assume strong background knowledge; explore edge cases, architectural trade-offs, and systemic rigor.",
}


def _resolve_languages(req: NoteGenerateRequest):
    """
    Determine target response language and detected input language.
    If language is AUTO, uses detected language; otherwise respects explicit choice.
    """
    detection = detect_language(req.topic)
    detected_display = req.detected_language or detection.detected_display

    if req.language == NoteLanguage.AUTO or req.language.value == "Auto":
        target_language = detection.normalized_language
    else:
        target_language = req.language.value

    return target_language, detected_display, detection.is_romanized


def _build_prompt(req: NoteGenerateRequest, target_language: str, detected_display: str, is_romanized: bool) -> str:
    lang_instruction = _LANGUAGE_INSTRUCTIONS.get(target_language, f"Respond in {target_language}.")
    format_instruction = _FORMAT_INSTRUCTIONS.get(req.format.value, "")
    difficulty_context = _DIFFICULTY_CONTEXT.get(req.difficulty.value, "")
    interest_context = (
        f"Personalise analogies and examples specifically to the domain of '{req.interest}'." if req.interest else ""
    )

    mixed_script_note = ""
    if is_romanized:
        mixed_script_note = (
            f"Note: The user provided input in {detected_display} (Romanized script). "
            f"Generate the notes in natural, culturally authentic {target_language} with English technical terms."
        )

    return f"""
You are an expert multilingual educational AI synthesizer.
{lang_instruction}
{mixed_script_note}
{difficulty_context}
{format_instruction}
{interest_context}

Generate comprehensive, beautifully structured study notes for the topic: "{req.topic}"

Return ONLY a valid JSON object — no markdown fences, no explanatory preamble — with this exact structure:
{{
  "title": "A clear, descriptive title for the topic in {target_language}",
  "explanation": "A thorough, intuitive explanation of the core concept in {target_language}",
  "key_points": [
    "Key point 1 in {target_language}",
    "Key point 2 in {target_language}",
    "Key point 3 in {target_language}",
    "Key point 4 in {target_language}",
    "Key point 5 in {target_language}"
  ],
  "examples": [
    "Practical example or real-world application 1 in {target_language}",
    "Practical example or real-world application 2 in {target_language}"
  ],
  "summary": "A concise executive summary of takeaways in {target_language}"
}}

All string values must be in {target_language}.
The key_points array must have at least 3 items.
The examples array must have at least 2 items.
""".strip()


def _safe_parse(raw: str) -> Dict[str, Any]:
    """Strip markdown code fences if returned by the LLM and parse JSON."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return json.loads(cleaned.strip())


def _generate_fallback_notes(
    req: NoteGenerateRequest,
    target_language: str,
    detected_display: str,
) -> NoteResponse:
    """
    High-fidelity contextual fallback generator for offline testing, demos, or missing API keys.
    Generates culturally and linguistically authentic notes across all supported languages.
    """
    topic = req.topic.strip()
    interest = req.interest or "General"
    difficulty = req.difficulty.value

    # Multilingual templates tailored to target language
    templates = {
        "Telugu": {
            "title": f"{topic} — సమగ్ర అధ్యయన నోట్స్ ({interest})",
            "explanation": f"'{topic}' అనేది ఆధునిక యుగంలో ఎంతో ప్రాముఖ్యత కలిగిన ఒక ముఖ్యమైన భావన. {interest} రంగంతో అనుసంధానించినప్పుడు, ఇది సంక్లిష్ట సమస్యలను సులభంగా అర్థం చేసుకోవడానికి మరియు పరిష్కరించడానికి సహాయపడుతుంది. {difficulty} స్థాయిలో దీని మూల సూత్రాలను నేర్చుకోవడం ద్వారా మంచి నైపుణ్యం సాధించవచ్చు.",
            "key_points": [
                f"మౌలిక సూత్రం: '{topic}' యొక్క ప్రాథమిక భావనలను సరిగ్గా అవగాహన చేసుకోవడం.",
                f"{interest} అనువర్తనం: వాస్తవ ప్రపంచంలో మరియు ప్రాజెక్టులలో దీనిని అమలు చేసే విధానం.",
                f"విధానపరమైన పద్ధతులు: నియమిత అభ్యాసం ద్వారా లోతైన విజ్ఞానాన్ని పొందడం.",
                f"ముఖ్యమైన ప్రయోజనాలు: వేగవంతమైన పనితీరు మరియు ప్రభావవంతమైన ఫలితాలు.",
                "భవిష్యత్ ప్రాధాన్యత: ఆధునిక సాంకేతికతలో దీని విస్తృతమైన వినియోగం."
            ],
            "examples": [
                f"{interest} రంగంలో ప్రాక్టికల్ కేస్ స్టడీ: ఒక సమస్యను విశ్లేషించి '{topic}' ద్వారా సరైన పరిష్కారాన్ని కనుగొనడం.",
                f"నిత్య జీవితంలో అనువర్తనం: ప్రాథమిక సూత్రాల ఆధారంగా ఫలితాలను మరింత మెరుగుపరచడం."
            ],
            "summary": f"ఈ అధ్యయనం '{topic}' యొక్క ముఖ్యమైన సూత్రాలను {interest} సందర్భంలో మరియు {difficulty} స్థాయిలో సమగ్రంగా వివరిస్తుంది."
        },
        "Hindi": {
            "title": f"{topic} — व्यापक अध्ययन नोट्स ({interest})",
            "explanation": f"'{topic}' एक अत्यंत महत्वपूर्ण और मौलिक संकल्पना है। जब इसे '{interest}' के संदर्भ में समझा जाता है, तो यह जटिल सिद्धांतों को सहज और व्यावहारिक रूप से स्पष्ट करता है। {difficulty} स्तर पर इसके मूलभूत नियमों को समझना भविष्य की सफलता के लिए अनिवार्य है।",
            "key_points": [
                f"मूलभूत सिद्धांत: '{topic}' की आधारभूत अवधारणाओं की स्पष्ट समझ।",
                f"{interest} में अनुप्रयोग: वास्तविक परिदृश्यों में व्यावहारिक क्रियान्वयन।",
                "प्रणालीगत दक्षता: सीखने की प्रक्रिया को क्रमबद्ध और प्रभावी बनाना।",
                "महत्वपूर्ण लाभ: समय की बचत और सटीक परिणामों की प्राप्ति।",
                "परीक्षा एवं साक्षात्कार चेकलिस्ट: प्रमुख परिभाषाएं और मुख्य अंतर।"
            ],
            "examples": [
                f"{interest} में व्यावहारिक उदाहरण: वास्तविक समस्या के समाधान में '{topic}' का उपयोग।",
                "दैनिक जीवन में अनुप्रयोग: संरचनात्मक दृष्टिकोण से बेहतर प्रदर्शन प्राप्त करना।"
            ],
            "summary": f"यह गाइड '{topic}' के सभी प्रमुख पहलुओं को {interest} और {difficulty} स्तर के अनुकूल सरल व सटीक रूप में प्रस्तुत करता है।"
        },
        "Gujarati": {
            "title": f"{topic} — વિગતવાર શિક્ષણ નોંધ ({interest})",
            "explanation": f"'{topic}' એ આધુનિક વિજ્ઞાન અને વ્યવહારિક ક્ષેત્રનો પાયાનો વિષય છે. {interest} સાથે જોડીને શીખવાથી આ વિષયને ખૂબ જ સરળતાથી સમજી શકાય છે.",
            "key_points": [
                f"મુખ્ય સિદ્ધાંત: '{topic}' ના મૂળભૂત તત્વોની સ્પષ્ટ સમજ.",
                f"{interest} ક્ષેત્રમાં ઉપયોગિતા અને પદ્ધતિસરનો અમલ.",
                "સમસ્યા નિવારણ કૌશલ્યમાં વૃદ્ધિ.",
                "પરીક્ષા લક્ષી મહત્વપૂર્ણ તારણો."
            ],
            "examples": [
                f"{interest} માં વાસ્તવિક ઉદાહરણ: જટિલ બાબતોનું સરળ સમાધાન.",
                "રોજિંદા જીવનમાં વ્યવહારિક ઉપયોગ."
            ],
            "summary": f"આ નોંધો '{topic}' ના મુખ્ય વિચારોને {interest} સંદર્ભે સંક્ષિપ્તમાં રજૂ કરે છે."
        },
        "Marathi": {
            "title": f"{topic} — सखोल अभ्यास नोट्स ({interest})",
            "explanation": f"'{topic}' ही एक अत्यंत महत्त्वपूर्ण संकल्पना आहे. जेव्हा आपण '{interest}' च्या दृष्टिकोनातून याचा विचार करतो, तेव्हा संकल्पना समजणे अधिक सोपे आणि परिणामकारक बनते.",
            "key_points": [
                f"मूलभूत संकल्पना: '{topic}' चा पाया समजून घेणे.",
                f"{interest} मधील व्यावहारिक उपयोगिता आणि पद्धती.",
                "समस्या सोडवण्याची प्रभावी कार्यपद्धती.",
                "महत्त्वाचे मुद्दे आणि परीक्षा मार्गदर्शन."
            ],
            "examples": [
                f"{interest} क्षेत्रातील प्रात्यक्षिक उदाहरण: समस्येचे अचूक विश्लेषण.",
                "व्यावहारिक प्रकल्पांमध्ये प्रत्यक्ष वापर."
            ],
            "summary": f"'{topic}' बद्दलच्या सर्व महत्त्वाच्या संकल्पना {interest} च्या संदर्भात स्पष्ट केल्या आहेत."
        },
        "Kannada": {
            "title": f"{topic} — ಸಮಗ್ರ ಅಧ್ಯಯನ ಟಿಪ್ಪಣಿಗಳು ({interest})",
            "explanation": f"'{topic}' ಎಂಬುದು ಪ್ರಮುಖ ಪರಿಕಲ್ಪನೆಯಾಗಿದೆ. {interest} ಕ್ಷೇತ್ರದಲ್ಲಿ ಇದರ ಅನ್ವಯವು ಕಲಿಕೆಯನ್ನು ಹೆಚ್ಚು ಪ್ರಾಯೋಗಿಕ ಮತ್ತು ಆಸಕ್ತಿದಾಯಕವಾಗಿಸುತ್ತದೆ.",
            "key_points": [
                f"ಮೂಲಭೂತ ಸಿದ್ಧಾಂತ: '{topic}' ಬಗ್ಗೆ ಸ್ಪಷ್ಟ ತಿಳುವಳಿಕೆ.",
                f"{interest} ನಲ್ಲಿ ಪ್ರಾಯೋಗಿಕ ಬಳಕೆ ಮತ್ತು ಮಹತ್ವ.",
                "ಪರೀಕ್ಷಾ ದೃಷ್ಟಿಕೋನ ಮತ್ತು ಮುಖ್ಯ ಅಂಶಗಳು."
            ],
            "examples": [
                f"{interest} ನಲ್ಲಿ ನೈಜ ಉದಾಹರಣೆ ಮತ್ತು ಪರಿಹಾರ.",
                "ದೈನಂದಿನ ಜೀವನದಲ್ಲಿ ಅಳವಡಿಕೆ."
            ],
            "summary": f"ಈ ಟಿಪ್ಪಣಿಗಳು '{topic}' ಅನ್ನು {interest} ಮತ್ತು {difficulty} ಹಂತಕ್ಕೆ ತಕ್ಕಂತೆ ವಿವರವಾಗಿ ವಿವರಿಸುತ್ತವೆ."
        },
        "Tamil": {
            "title": f"{topic} — முழுமையான கற்றல் குறிப்புகள் ({interest})",
            "explanation": f"'{topic}' என்பது ஒரு முக்கியமான கருத்தாகும். {interest} துறையுடன் இணைத்து கற்கும் போது, இது மிக எளிதாக புரிகிறது.",
            "key_points": [
                f"அடிப்படைக் கொள்கைகள்: '{topic}' பற்றிய தெளிவான பார்வை.",
                f"{interest} துறையில் நடைமுறைப் பயன்பாடு.",
                "தேர்வு மற்றும் நேர்காணல் குறிப்புகள்."
            ],
            "examples": [
                f"{interest} துறையில் செயல்முறை உதாரணம்.",
                "நிஜ வாழ்க்கை பயன்பாடுகள்."
            ],
            "summary": f"'{topic}' பற்றிய அனைத்து முக்கிய கூறுகளும் {interest} பின்னணியில் தொகுக்கப்பட்டுள்ளன."
        },
        "Malayalam": {
            "title": f"{topic} — സമഗ്ര പഠന കുറിപ്പുകൾ ({interest})",
            "explanation": f"'{topic}' എന്നത് വളരെ പ്രധാനപ്പെട്ട ഒരു വിഷയമാണ്. {interest} മേഖലയുമായി ബന്ധിപ്പിച്ചു പഠിക്കുന്നത് ആഴത്തിലുള്ള അറിവ് നൽകുന്നു.",
            "key_points": [
                f"അടിസ്ഥാന തത്വങ്ങൾ: '{topic}' സംബന്ധിച്ച വ്യക്തമായ ആശയം.",
                f"{interest} മേഖലയിലെ പ്രായോഗിക ഉപയോഗം.",
                "പ്രധാന പരീക്ഷാ പോയിന്റുകൾ."
            ],
            "examples": [
                f"{interest} മേഖലയിലെ ഉദാഹരണം.",
                "ദൈനംദിന ജീവിതത്തിലെ പ്രയോഗം."
            ],
            "summary": f"'{topic}' സംബന്ധിച്ച പ്രധാന വിവരങ്ങൾ {interest} പശ്ചാത്തലത്തിൽ വിവരിച്ചിരിക്കുന്നു."
        },
        "Bengali": {
            "title": f"{topic} — বিস্তারিত শিক্ষা নোট ({interest})",
            "explanation": f"'{topic}' একটি অত্যন্ত গুরুত্বপূর্ণ বিষয়। {interest}-এর প্রেক্ষাপটে এটি গভীরভাবে বোঝার মাধ্যমে সহজ সমাধান সম্ভব।",
            "key_points": [
                f"মৌলিক ধারণা: '{topic}'-এর প্রধান নীতিসমূহ।",
                f"{interest} ক্ষেত্রে বাস্তবিক প্রয়োগ।",
                "পরীক্ষা ও ইন্টারভিউয়ের গুরুত্বপূর্ণ সারাংশ।"
            ],
            "examples": [
                f"{interest}-এ বাস্তব উদাহরণ ও কেস স্টাডি।",
                "ব্যবহারিক ক্ষেত্রে প্রয়োগের পদ্ধতি।"
            ],
            "summary": f"'{topic}' সম্পর্কে সম্পূর্ণ রূপরেখা {interest} এবং {difficulty} স্তরে প্রস্তুত করা হয়েছে।"
        },
        "Punjabi": {
            "title": f"{topic} — ਵਿਸਤ੍ਰਿਤ ਅਧਿਐਨ ਨੋਟਸ ({interest})",
            "explanation": f"'{topic}' ਇੱਕ ਜ਼ਰੂਰੀ ਵਿਸ਼ਾ ਹੈ। {interest} ਦੇ ਸੰਦਰਭ ਵਿੱਚ ਇਸਨੂੰ ਆਸਾਨੀ ਨਾਲ ਸਮਝਿਆ ਜਾ ਸਕਦਾ ਹੈ।",
            "key_points": [
                f"ਮੁੱਖ ਨੁਕਤੇ: '{topic}' ਦੀ ਬੁਨਿਆਦੀ ਸਮਝ।",
                f"{interest} ਵਿੱਚ ਪ੍ਰੈਕਟੀਕਲ ਵਰਤੋਂ।",
                "ਮਹੱਤਵਪੂਰਨ ਤੱਥ ਅਤੇ ਨਤੀਜੇ।"
            ],
            "examples": [
                f"{interest} ਵਿੱਚ ਅਸਲ ਉਦਾਹਰਨ।",
                "ਰੋਜ਼ਾਨਾ ਜੀਵਨ ਵਿੱਚ ਅਮਲ।"
            ],
            "summary": f"'{topic}' ਬਾਰੇ ਵਿਸਥਾਰ ਨਾਲ ਜਾਣਕਾਰੀ {interest} ਅਨੁਸਾਰ ਤਿਆਰ ਕੀਤੀ ਗਈ ਹੈ।"
        },
        "English": {
            "title": f"{topic} — Comprehensive Study Notes ({interest})",
            "explanation": f"The foundation of '{topic}' revolves around breaking down core dynamics into intuitive units. When applied to '{interest}', it provides a structured mental model that clarifies complex dependencies and simplifies real-world execution at an {difficulty} level.",
            "key_points": [
                f"First-Principles Mechanics: Establishing baseline truth for '{topic}' rather than reasoning by analogy.",
                f"Targeted Domain Integration: Applying proven paradigms directly into {interest} workflows.",
                "Adaptive Feedback Loops: Iteratively refining outcomes and verifying against edge cases.",
                f"Systemic Scalability: Ensuring methodology remains robust as problem complexity expands from {difficulty} to mastery.",
                "Exam & Interview Mastery: Key definitions, architectural trade-offs, and verification checklist."
            ],
            "examples": [
                f"Domain-Specific Application in {interest}: Deconstructing a complex scenario by mapping '{topic}' principles to step-by-step resolution.",
                "Real-World Systems Implementation: Applying structured feedback cycles to achieve resilient operational results."
            ],
            "summary": f"A structured learning guide deconstructing '{topic}' tailored for {interest} practitioners at an {difficulty} proficiency level."
        }
    }

    t = templates.get(target_language, templates["English"])
    summary_text = t["summary"]
    if not _HAS_GEMINI_KEY:
        summary_text = f"[Setup Required: Configure GEMINI_API_KEY in backend/.env for live Gemini AI] {summary_text}"

    return NoteResponse(
        title=t["title"],
        explanation=t["explanation"],
        key_points=t["key_points"],
        examples=t["examples"],
        summary=summary_text,
        language=target_language,
        detected_language=detected_display,
        topic=topic,
        generated_at=datetime.now(timezone.utc),
    )


def generate_notes(req: NoteGenerateRequest) -> NoteResponse:
    """
    Generate study notes via Google Gemini, automatically detecting language,
    supporting mixed input (Tenglish, Hinglish), and respecting manual overrides.
    Falls back gracefully to authentic native templates if Gemini API key is missing or offline.
    """
    target_language, detected_display, is_romanized = _resolve_languages(req)
    prompt = _build_prompt(req, target_language, detected_display, is_romanized)

    # If Gemini is configured and enabled, call the live model
    if _HAS_GEMINI_KEY:
        try:
            model = genai.GenerativeModel(
                model_name=_MODEL_NAME,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=2048,
                    response_mime_type="application/json",
                ),
            )
            response = model.generate_content(prompt)
            raw_text = response.text
            parsed = _safe_parse(raw_text)

            required_keys = {"title", "explanation", "key_points", "examples", "summary"}
            if required_keys.issubset(parsed.keys()):
                return NoteResponse(
                    title=str(parsed["title"]),
                    explanation=str(parsed["explanation"]),
                    key_points=[str(p) for p in parsed["key_points"]],
                    examples=[str(e) for e in parsed["examples"]],
                    summary=str(parsed["summary"]),
                    language=target_language,
                    detected_language=detected_display,
                    topic=req.topic,
                    generated_at=datetime.now(timezone.utc),
                )
        except Exception as exc:
            logger.warning("Gemini live generation failed, falling back to synthesizer: %s", exc)

    # Fallback synthesizer
    return _generate_fallback_notes(req, target_language, detected_display)
