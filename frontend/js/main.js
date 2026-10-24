/**
 * ==========================================================================
 * VAYLUME - Global Main Utility Script (main.js)
 * ==========================================================================
 * Includes:
 * - Multilingual translation dictionary for 10 languages
 * - Dynamic language switcher & DOM translator
 * - Toast notification system
 * - Accessible Modal management
 * - Responsive mobile navigation & drawer controllers
 * - User header state sync & navigation active state
 */

// Multilingual Dictionary for 10 Indian & International Languages
const I18N_DICTIONARY = {
  English: {
    brand_tagline: "Your Memories. Your Knowledge. Your Digital Life.",
    nav_home: "Home",
    nav_features: "Features",
    nav_how_it_works: "How It Works",
    nav_security: "Security",
    nav_multilingual: "Multilingual AI",
    nav_dashboard: "Dashboard",
    nav_memories: "Memories",
    nav_notes: "AI Notes",
    nav_locker: "Digital Locker",
    nav_profile: "Profile",
    nav_logout: "Logout",
    btn_get_started: "Get Started",
    btn_login: "Login",
    btn_signup: "Create Account",
    btn_add_memory: "Add Memory",
    btn_generate_notes: "Generate Notes",
    btn_upload_document: "Upload Document",
    quick_actions: "Quick Actions",
    recent_activity: "Recent Activity",
    welcome_back: "Welcome back",
    search_placeholder: "Search anything...",
    card_memories_title: "Secure Memories",
    card_notes_title: "AI Notes Studio",
    card_locker_title: "Digital Locker",
    footer_rights: "All rights reserved. Designed for Hackathon 2026."
  },
  Telugu: {
    brand_tagline: "మీ జ్ఞాపకాలు. మీ విజ్ఞానం. మీ డిజిటల్ జీవితం.",
    nav_home: "హోమ్",
    nav_features: "ఫీచర్లు",
    nav_how_it_works: "ఇది ఎలా పనిచేస్తుంది",
    nav_security: "భద్రత",
    nav_multilingual: "బహుభాషా AI",
    nav_dashboard: "డాష్‌బోర్డ్",
    nav_memories: "జ్ఞాపకాలు",
    nav_notes: "AI నోట్స్",
    nav_locker: "డిజిటల్ లాకర్",
    nav_profile: "ప్రొఫైల్",
    nav_logout: "లాగ్ అవుట్",
    btn_get_started: "ప్రారంభించండి",
    btn_login: "లాగిన్",
    btn_signup: "ఖాతా సృష్టించండి",
    btn_add_memory: "+ జ్ఞాపకం చేర్చండి",
    btn_generate_notes: "నోట్స్ రూపొందించండి",
    btn_upload_document: "పత్రం అప్‌లోడ్ చేయండి",
    quick_actions: "త్వరిత చర్యలు",
    recent_activity: "ఇటీవలి కార్యాచరణ",
    welcome_back: "స్వాగతం",
    search_placeholder: "వెతకండి...",
    card_memories_title: "రక్షిత జ్ఞాపకాలు",
    card_notes_title: "AI నోట్స్ స్టూడియో",
    card_locker_title: "డిజిటల్ లాకర్",
    footer_rights: "సర్వహక్కులు ప్రత్యేకించబడ్డాయి. హాకథాన్ 2026."
  },
  Hindi: {
    brand_tagline: "आपकी यादें। आपका ज्ञान। आपका डिजिटल जीवन।",
    nav_home: "होम",
    nav_features: "विशेषताएं",
    nav_how_it_works: "यह कैसे काम करता है",
    nav_security: "सुरक्षा",
    nav_multilingual: "बहुभाषी AI",
    nav_dashboard: "डैशबोर्ड",
    nav_memories: "यादें",
    nav_notes: "AI नोट्स",
    nav_locker: "डिजिटल लॉकर",
    nav_profile: "प्रोफ़ाइल",
    nav_logout: "लॉगआउट",
    btn_get_started: "शुरू करें",
    btn_login: "लॉग इन",
    btn_signup: "खाता बनाएं",
    btn_add_memory: "+ याद जोड़ें",
    btn_generate_notes: "नोट्स तैयार करें",
    btn_upload_document: "दस्तावेज़ अपलोड करें",
    quick_actions: "त्वरित क्रियाएं",
    recent_activity: "हाल की गतिविधि",
    welcome_back: "वापसी पर स्वागत है",
    search_placeholder: "खोजें...",
    card_memories_title: "सुरक्षित यादें",
    card_notes_title: "AI नोट्स स्टूडियो",
    card_locker_title: "डिजिटल लॉकर",
    footer_rights: "सर्वाधिकार सुरक्षित। हैकथॉन 2026."
  },
  Gujarati: {
    brand_tagline: "તમારી યાદો. તમારું જ્ઞાન. તમારું ડિજિટલ જીવન.",
    nav_home: "હોમ",
    nav_features: "સુવિધાઓ",
    nav_how_it_works: "કેવી રીતે કામ કરે છે",
    nav_security: "સુરક્ષા",
    nav_multilingual: "બહુભાષી AI",
    nav_dashboard: "ડેશબોર્ડ",
    nav_memories: "યાદો",
    nav_notes: "AI નોટ્સ",
    nav_locker: "ડિજિટલ લૉકર",
    nav_profile: "પ્રોફાઇલ",
    nav_logout: "લૉગ આઉટ",
    btn_get_started: "શરૂ કરો",
    btn_login: "લૉગિન",
    btn_signup: "ખાતું બનાવો",
    btn_add_memory: "+ યાદ ઉમેરો",
    btn_generate_notes: "નોંધ બનાવો",
    btn_upload_document: "દસ્તાવેજ અપલોડ કરો",
    quick_actions: "ઝડપી ક્રિયાઓ",
    recent_activity: "તાજેતરની પ્રવૃત્તિ",
    welcome_back: "સ્વાગત છે",
    search_placeholder: "શોધો...",
    card_memories_title: "સુરક્ષિત યાદો",
    card_notes_title: "AI નોટ્સ સ્ટુડિયો",
    card_locker_title: "ડિજિટલ લૉકર",
    footer_rights: "સર્વાધિકાર સુરક્ષિત. હેકાથોન 2026."
  },
  Marathi: {
    brand_tagline: "तुमच्या आठवणी. तुमचे ज्ञान. तुमचे डिजिटल आयुष्य.",
    nav_home: "होम",
    nav_features: "वैशिष्ट्ये",
    nav_how_it_works: "कसे कार्य करते",
    nav_security: "सुरक्षा",
    nav_multilingual: "बहुभाषिक AI",
    nav_dashboard: "डॅशबोर्ड",
    nav_memories: "आठवणी",
    nav_notes: "AI नोट्स",
    nav_locker: "डिजिटल लॉकर",
    nav_profile: "प्रोफाइल",
    nav_logout: "लॉगआउट",
    btn_get_started: "सुरुवात करा",
    btn_login: "लॉगिन",
    btn_signup: "खाते तयार करा",
    btn_add_memory: "+ आठवण जोडा",
    btn_generate_notes: "नोट्स तयार करा",
    btn_upload_document: "दस्तऐवज अपलोड करा",
    quick_actions: "त्वरित कृती",
    recent_activity: "अलीकडील घडामोडी",
    welcome_back: "पुन्हा स्वागत आहे",
    search_placeholder: "शोधा...",
    card_memories_title: "सुरक्षित आठवणी",
    card_notes_title: "AI नोट्स स्टुडिओ",
    card_locker_title: "डिजिटल लॉकर",
    footer_rights: "सर्व हक्क राखीव. हॅकाथॉन 2026."
  },
  Kannada: {
    brand_tagline: "ನಿಮ್ಮ ನೆನಪುಗಳು. ನಿಮ್ಮ ಜ್ಞಾನ. ನಿಮ್ಮ ಡಿಜಿಟಲ್ ಜೀವನ.",
    nav_home: "ಮುಖಪುಟ",
    nav_features: "ವೈಶಿಷ್ಟ್ಯಗಳು",
    nav_how_it_works: "ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ",
    nav_security: "ಭದ್ರತೆ",
    nav_multilingual: "ಬಹುಭಾಷಾ AI",
    nav_dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    nav_memories: "ನೆನಪುಗಳು",
    nav_notes: "AI ಟಿಪ್ಪಣಿಗಳು",
    nav_locker: "ಡಿಜಿಟಲ್ ಲಾಕರ್",
    nav_profile: "ಪ್ರೊಫೈಲ್",
    nav_logout: "ಲಾಗ್ ಔಟ್",
    btn_get_started: "ಪ್ರಾರಂಭಿಸಿ",
    btn_login: "ಲಾಗಿನ್",
    btn_signup: "ಖಾತೆ ರಚಿಸಿ",
    btn_add_memory: "+ ನೆನಪು ಸೇರಿಸಿ",
    btn_generate_notes: "ಟಿಪ್ಪಣಿಗಳನ್ನು ರಚಿಸಿ",
    btn_upload_document: "ದಾಖಲೆ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ",
    quick_actions: "ತ್ವರಿತ ಕ್ರಿಯೆಗಳು",
    recent_activity: "ಇತ್ತೀಚಿನ ಚಟುವಟಿಕೆ",
    welcome_back: "ಮರಳಿ ಸ್ವಾಗತ",
    search_placeholder: "ಹುಡುಕಿ...",
    card_memories_title: "ಸುರಕ್ಷಿತ ನೆನಪುಗಳು",
    card_notes_title: "AI ನೋಟ್ಸ್ ಸ್ಟುಡಿಯೋ",
    card_locker_title: "ಡಿಜಿಟಲ್ ಲಾಕರ್",
    footer_rights: "ಎಲ್ಲಾ ಹಕ್ಕುಗಳನ್ನು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ. ಹ್ಯಾಕಥಾನ್ 2026."
  },
  Tamil: {
    brand_tagline: "உங்கள் நினைவுகள். உங்கள் அறிவு. உங்கள் டிஜிட்டல் வாழ்க்கை.",
    nav_home: "முகப்பு",
    nav_features: "அம்சங்கள்",
    nav_how_it_works: "எப்படி செயல்படுகிறது",
    nav_security: "பாதுகாப்பு",
    nav_multilingual: "பன்மொழி AI",
    nav_dashboard: "டாஷ்போர்டு",
    nav_memories: "நினைவுகள்",
    nav_notes: "AI குறிப்புகள்",
    nav_locker: "டிஜிட்டல் லாக்கர்",
    nav_profile: "சுயவிவரம்",
    nav_logout: "வெளியேறு",
    btn_get_started: "தொடங்குங்கள்",
    btn_login: "உள்நுழைக",
    btn_signup: "கணக்கை உருவாக்கவும்",
    btn_add_memory: "+ நினைவு சேர்க்க",
    btn_generate_notes: "குறிப்புகளை உருவாக்கு",
    btn_upload_document: "ஆவணம் பதிவேற்று",
    quick_actions: "விரைவு செயல்கள்",
    recent_activity: "சமீபத்திய செயல்பாடு",
    welcome_back: "மீண்டும் வருக",
    search_placeholder: "தேடுங்கள்...",
    card_memories_title: "பாதுகாப்பான நினைவுகள்",
    card_notes_title: "AI குறிப்புகள் ஸ்டுடியோ",
    card_locker_title: "டிஜிட்டல் லாக்கர்",
    footer_rights: "அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை. ஹேக்கத்தான் 2026."
  },
  Malayalam: {
    brand_tagline: "നിങ്ങളുടെ ഓർമ്മകൾ. നിങ്ങളുടെ അറിവ്. നിങ്ങളുടെ ഡിജിറ്റൽ ജീവിതം.",
    nav_home: "ഹോം",
    nav_features: "സവിശേഷതകൾ",
    nav_how_it_works: "പ്രവർത്തനം",
    nav_security: "സുരക്ഷ",
    nav_multilingual: "ബഹുഭാഷാ AI",
    nav_dashboard: "ഡാഷ്‌ബോർഡ്",
    nav_memories: "ഓർമ്മകൾ",
    nav_notes: "AI കുറിപ്പുകൾ",
    nav_locker: "ഡിജിറ്റൽ ലോക്കർ",
    nav_profile: "പ്രൊഫൈൽ",
    nav_logout: "ലോഗ് ഔട്ട്",
    btn_get_started: "ആരംഭിക്കുക",
    btn_login: "ലോഗിൻ",
    btn_signup: "അക്കൗണ്ട് നിർമ്മിക്കുക",
    btn_add_memory: "+ ഓർമ്മ ചേർക്കുക",
    btn_generate_notes: "കുറിപ്പുകൾ തയ്യാറാക്കുക",
    btn_upload_document: "രേഖ അപ്‌ലോഡ് ചെയ്യുക",
    quick_actions: "ദ്രുത പ്രവർത്തനങ്ങൾ",
    recent_activity: "സമീപകാല പ്രവർത്തനങ്ങൾ",
    welcome_back: "വീണ്ടും സ്വാഗതം",
    search_placeholder: "തിരയുക...",
    card_memories_title: "സുരക്ഷിത ഓർമ്മകൾ",
    card_notes_title: "AI നോട്ട്സ് സ്റ്റുഡിയോ",
    card_locker_title: "ഡിജിറ്റൽ ലോക്കർ",
    footer_rights: "എല്ലാ അവകാശങ്ങളും നിക്ഷിപ്തം. ഹാക്കത്തോൺ 2026."
  },
  Bengali: {
    brand_tagline: "আপনার স্মৃতি। আপনার জ্ঞান। আপনার ডিজিটাল জীবন।",
    nav_home: "হোম",
    nav_features: "বৈশিষ্ট্য",
    nav_how_it_works: "কীভাবে কাজ করে",
    nav_security: "নিরাপত্তা",
    nav_multilingual: "বহুভাষিক AI",
    nav_dashboard: "ড্যাশবোর্ড",
    nav_memories: "স্মৃতি",
    nav_notes: "AI নোট",
    nav_locker: "ডিজিটাল লকার",
    nav_profile: "প্রোফাইল",
    nav_logout: "লগআউট",
    btn_get_started: "শুরু করুন",
    btn_login: "লগইন",
    btn_signup: "অ্যাকাউন্ট তৈরি করুন",
    btn_add_memory: "+ স্মৃতি যোগ করুন",
    btn_generate_notes: "নোট তৈরি করুন",
    btn_upload_document: "নথিপত্র আপলোড করুন",
    quick_actions: "দ্রুত পদক্ষেপ",
    recent_activity: "সাম্প্রতিক কার্যকলাপ",
    welcome_back: "স্বাগতম",
    search_placeholder: "অনুসন্ধান করুন...",
    card_memories_title: "সুরক্ষিত স্মৃতি",
    card_notes_title: "AI নোটস স্টুডিও",
    card_locker_title: "ডিজিটাল লকার",
    footer_rights: "সর্বস্বত্ব সংরক্ষিত। হ্যাকাথন ২০২৬।"
  },
  Punjabi: {
    brand_tagline: "ਤੁਹਾਡੀਆਂ ਯਾਦਾਂ। ਤੁਹਾਡਾ ਗਿਆਨ। ਤੁਹਾਡਾ ਡਿਜੀਟਲ ਜੀਵਨ।",
    nav_home: "ਹੋਮ",
    nav_features: "ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ",
    nav_how_it_works: "ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ",
    nav_security: "ਸੁਰੱਖਿਆ",
    nav_multilingual: "ਬਹੁਭਾਸ਼ਾਈ AI",
    nav_dashboard: "ਡੈਸ਼ਬੋਰਡ",
    nav_memories: "ਯਾਦਾਂ",
    nav_notes: "AI ਨੋਟਸ",
    nav_locker: "ਡਿਜੀਟਲ ਲਾਕਰ",
    nav_profile: "ਪ੍ਰੋਫਾਈਲ",
    nav_logout: "ਲਾਗਆਉਟ",
    btn_get_started: "ਸ਼ੁਰੂ ਕਰੋ",
    btn_login: "ਲਾਗਇਨ",
    btn_signup: "ਖਾਤਾ ਬਣਾਓ",
    btn_add_memory: "+ ਯਾਦ ਸ਼ਾਮਲ ਕਰੋ",
    btn_generate_notes: "ਨੋਟਸ ਤਿਆਰ ਕਰੋ",
    btn_upload_document: "ਦਸਤਾਵੇਜ਼ ਅੱਪਲੋਡ ਕਰੋ",
    quick_actions: "ਤੇਜ਼ ਕਾਰਵਾਈਆਂ",
    recent_activity: "ਹਾਲੀਆ ਗਤੀਵਿਧੀ",
    welcome_back: "ਜੀ ਆਇਆਂ ਨੂੰ",
    search_placeholder: "ਖੋਜੋ...",
    card_memories_title: "ਸੁਰੱਖਿਅਤ ਯਾਦਾਂ",
    card_notes_title: "AI ਨੋਟਸ ਸਟੂਡੀਓ",
    card_locker_title: "ਡਿਜੀਟਲ ਲਾਕਰ",
    footer_rights: "ਸਾਰੇ ਹੱਕ ਰਾਖਵੇਂ ਹਨ। ਹੈਕਾਥੌਨ 2026।"
  }
};

// Supported languages list with native scripts
const SUPPORTED_LANGUAGES = [
  { code: 'English', label: 'English', native: 'English' },
  { code: 'Telugu', label: 'Telugu', native: 'తెలుగు' },
  { code: 'Hindi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'Gujarati', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'Marathi', label: 'Marathi', native: 'मराठी' },
  { code: 'Kannada', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'Tamil', label: 'Tamil', native: 'தமிழ்' },
  { code: 'Malayalam', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'Bengali', label: 'Bengali', native: 'বাংলা' },
  { code: 'Punjabi', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' }
];

/**
 * Toast Notification Function
 * @param {string} message - Message to display
 * @param {'success'|'error'|'info'} type - Toast type
 * @param {number} duration - Milliseconds before dismiss
 */
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };

  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || 'ℹ'}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

/**
 * Modal Handling with Smooth Entrance and Exit Transitions
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('closing');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    const firstInput = modal.querySelector('input, button, textarea, select');
    if (firstInput) firstInput.focus();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal && modal.classList.contains('show')) {
    modal.classList.add('closing');
    setTimeout(() => {
      modal.classList.remove('show', 'closing');
      document.body.style.overflow = '';
    }, 240);
  }
}

// Global modal backdrop close & Escape key listener
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.show').forEach(m => closeModal(m.id));
  }
});

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    closeModal(e.target.id);
  }
});

/**
 * HTML Escaper
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Language Switcher & Translation Engine
 */
function getActiveLanguage() {
  return localStorage.getItem('vaylume_lang') || 'English';
}

function setActiveLanguage(lang, silent = false) {
  if (!I18N_DICTIONARY[lang]) lang = 'English';
  localStorage.setItem('vaylume_lang', lang);
  applyTranslations(lang);

  // Update UI badge if present
  const currentLangDisplay = document.getElementById('current-lang-text');
  if (currentLangDisplay) {
    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === lang) || SUPPORTED_LANGUAGES[0];
    currentLangDisplay.textContent = `${langObj.native} (${langObj.code})`;
  }

  // Update language selector dropdown selection styling
  document.querySelectorAll('.lang-option').forEach(el => {
    if (el.dataset.lang === lang) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });

  // Sync any select dropdown with id 'language-select' or class 'lang-select'
  document.querySelectorAll('.app-lang-select').forEach(select => {
    select.value = lang;
  });

  if (!silent) showToast(`Language updated to ${lang}`, 'info', 2000);
}

function applyTranslations(lang) {
  const dict = I18N_DICTIONARY[lang] || I18N_DICTIONARY.English;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (dict[key]) {
      if (el.tagName === 'INPUT' && el.getAttribute('placeholder')) {
        el.setAttribute('placeholder', dict[key]);
      } else {
        el.textContent = dict[key];
      }
    }
  });
}

/**
 * Populate Language Dropdowns
 */
function initLanguageDropdown() {
  const dropdownContainers = document.querySelectorAll('.lang-dropdown-menu');
  const currentLang = getActiveLanguage();

  dropdownContainers.forEach(container => {
    container.innerHTML = '';
    SUPPORTED_LANGUAGES.forEach(item => {
      const option = document.createElement('div');
      option.className = `lang-option ${item.code === currentLang ? 'selected' : ''}`;
      option.dataset.lang = item.code;
      option.innerHTML = `
        <span>${item.native}</span>
        <span style="font-size: 0.75rem; opacity: 0.7;">${item.code}</span>
      `;
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveLanguage(item.code);
        container.classList.remove('show');
      });
      container.appendChild(option);
    });
  });

  // Toggle button listener
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = btn.nextElementSibling;
      if (menu && menu.classList.contains('lang-dropdown-menu')) {
        menu.classList.toggle('show');
      }
    });
  });

  // Close when clicking outside
  document.addEventListener('click', () => {
    document.querySelectorAll('.lang-dropdown-menu.show').forEach(m => m.classList.remove('show'));
  });

  // Initial translation apply — silent to avoid spurious toast on page load (L7 fix)
  applyTranslations(currentLang);
  const currentLangDisplay = document.getElementById('current-lang-text');
  if (currentLangDisplay) {
    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_LANGUAGES[0];
    currentLangDisplay.textContent = `${langObj.native} (${langObj.code})`;
  }
}

/**
 * Mobile Navigation & Sidebar Controllers
 */
function initNavigation() {
  // Mobile Hamburger for Landing Page
  const mobileToggle = document.querySelector('.mobile-nav-toggle');
  const navLinks = document.querySelector('.site-header .nav-links');
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('show');
    });
  }

  // App Sidebar Mobile Drawer Toggle
  const sidebarToggle = document.querySelector('.sidebar-toggle-btn');
  const sidebar = document.querySelector('.app-sidebar');
  let backdrop = document.querySelector('.app-sidebar-backdrop');

  if (sidebar && !backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'app-sidebar-backdrop';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
    });
  }

  if (sidebarToggle && sidebar && backdrop) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('show');
    });
  }

  // Highlight active link based on current page filename
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .sidebar-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && (href === currentPage || (currentPage === '' && href === 'index.html'))) {
      link.classList.add('active');
    }
  });

  // Sticky header scroll elevation
  const header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }
}

/**
 * Synchronize User Avatar & Info in Header / Sidebar
 */
function syncUserInfo() {
  const user = JSON.parse(localStorage.getItem('vaylume_user_profile') || 'null');
  if (user) {
    const userNameElements = document.querySelectorAll('.display-user-name');
    const userRoleElements = document.querySelectorAll('.display-user-role');
    const userAvatarElements = document.querySelectorAll('.user-avatar');

    const initials = user.fullName
      ? user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
      : 'V';

    userNameElements.forEach(el => el.textContent = user.fullName || 'Vaylume User');
    userRoleElements.forEach(el => el.textContent = user.preferredLanguage ? `Member • ${user.preferredLanguage}` : 'Member');
    userAvatarElements.forEach(el => el.textContent = initials);
  }

  // Bind logout buttons with smooth transition
  document.querySelectorAll('.btn-logout-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to securely logout from VAYLUME?')) {
        triggerSmoothLogout();
      }
    });
  });
}

/**
 * 16. Smooth Logout Transition (Full-Screen Vault Lock Effect)
 */
function triggerSmoothLogout() {
  let overlay = document.querySelector('.logout-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'logout-overlay';
    overlay.innerHTML = `
      <div class="logout-lock-icon">🔒</div>
      <h3 class="logout-title">Securing Vault Session</h3>
      <p class="logout-subtitle">Closing cryptographic session and isolating local memory...</p>
    `;
    document.body.appendChild(overlay);
  }

  setTimeout(() => {
    window.API.logout();
  }, 420);
}

/**
 * 8. Section Reveal Animation (Lightweight Scroll-Triggered Observer)
 */
function initSectionReveal() {
  const elements = document.querySelectorAll('.reveal-on-scroll');
  if (!elements.length) return;

  if (!('IntersectionObserver' in window)) {
    elements.forEach(el => el.classList.add('revealed'));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  elements.forEach(el => observer.observe(el));
}

// Global initialization on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initLanguageDropdown();
  initNavigation();
  syncUserInfo();
  initSectionReveal();
});

// Export globally
window.showToast = showToast;
window.openModal = openModal;
window.closeModal = closeModal;
window.triggerSmoothLogout = triggerSmoothLogout;
window.setActiveLanguage = setActiveLanguage;
window.getActiveLanguage = getActiveLanguage;
window.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
