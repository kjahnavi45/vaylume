/**
 * ==========================================================================
 * VAYLUME - AI Notes Studio Controller (notes.js)
 * ==========================================================================
 * Features:
 * - Real-time input language detection (Telugu, Hindi, Gujarati, Marathi,
 *   Kannada, Tamil, Malayalam, Bengali, Punjabi, English + Tenglish/Hinglish)
 * - Automatic same-language reply by default with manual language override
 * - Live UI feedback pill showing detected language as user types
 * - Multilingual AI note generator with interest, difficulty & style selectors
 * - Custom interest dynamic input trigger
 * - Multi-stage radar synthesis animation
 * - Structured note rendering with code/key takeaways/analogies
 * - Copy to clipboard, export, and save to local history
 * - Saved notes history drawer with search and reload
 */

let currentGeneratedNote = null;
let currentDetectedLanguage = { display: 'English', code: 'English', isRomanized: false };

document.addEventListener('DOMContentLoaded', () => {
  initLanguageSelector();
  initTopicInputDetection();
  initNotesForm();
  initSavedNotesDrawer();
});

/**
 * Client-Side Input Language Detector
 * Detects native Unicode Indic scripts and Romanized transliterations (Tenglish, Hinglish, etc.)
 */
function detectInputLanguage(text) {
  if (!text || !text.trim()) {
    return { display: 'English', code: 'English', isRomanized: false };
  }

  const clean = text.trim();

  // 1. Unicode script character ranges
  const scriptRanges = [
    { name: 'Telugu',    start: 0x0C00, end: 0x0C7F },
    { name: 'Hindi',     start: 0x0900, end: 0x097F },
    { name: 'Gujarati',  start: 0x0A80, end: 0x0AFF },
    { name: 'Kannada',   start: 0x0C80, end: 0x0CFF },
    { name: 'Tamil',     start: 0x0B80, end: 0x0BFF },
    { name: 'Malayalam', start: 0x0D00, end: 0x0D7F },
    { name: 'Bengali',   start: 0x0980, end: 0x09FF },
    { name: 'Punjabi',   start: 0x0A00, end: 0x0A7F }
  ];

  const counts = {};
  scriptRanges.forEach(s => counts[s.name] = 0);
  let latinCount = 0;

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      latinCount++;
      continue;
    }
    for (const s of scriptRanges) {
      if (code >= s.start && code <= s.end) {
        counts[s.name]++;
        break;
      }
    }
  }

  const indicTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  if (indicTotal > 0 && indicTotal >= (latinCount * 0.35)) {
    let best = 'Telugu';
    let maxC = 0;
    for (const [k, v] of Object.entries(counts)) {
      if (v > maxC) { maxC = v; best = k; }
    }

    if (best === 'Hindi') {
      // Disambiguate Hindi vs Marathi keywords in Devanagari
      const marathiTokens = ['आहे', 'आणि', 'नाही', 'कसे', 'काय', 'मध्ये', 'वर', 'तर', 'सांगा', 'बद्दल'];
      const isMarathi = marathiTokens.some(t => clean.includes(t));
      if (isMarathi) {
        return { display: 'Marathi', code: 'Marathi', isRomanized: false };
      }
    }

    return { display: best, code: best, isRomanized: false };
  }

  // 2. Code-mixed Romanized transliterations (Tenglish, Hinglish, etc.)
  const words = clean.toLowerCase().match(/\b[a-z_']+\b/g) || [];
  const tenglishWords = new Set([
    'gurinchi', 'cheppu', 'cheppandi', 'cheyyi', 'chey', 'ela', 'enti', 'chudu',
    'nerchuko', 'bagundi', 'telusuko', 'manchi', 'kani', 'kuda', 'ikkada', 'akkada',
    'enduku', 'ippudu', 'undhi', 'unnadu', 'kavali', 'ardham', 'cheppava'
  ]);
  const hinglishWords = new Set([
    'kaise', 'kya', 'hai', 'hain', 'batao', 'samjhao', 'mujhe', 'karna', 'karo',
    'hoga', 'nahi', 'aur', 'lekin', 'padhai', 'seekhna', 'chahiye', 'samajh', 'bataye'
  ]);
  const tanglishWords = new Set([
    'epdi', 'enna', 'solunga', 'puriyala', 'nalla', 'pannunga', 'romba', 'enga'
  ]);
  const kanglishWords = new Set([
    'hege', 'yenu', 'heli', 'madi', 'channagide', 'gothilla', 'tumba', 'yaake'
  ]);

  let tenglishScore = 0, hinglishScore = 0, tanglishScore = 0, kanglishScore = 0;
  words.forEach(w => {
    if (tenglishWords.has(w)) tenglishScore++;
    if (hinglishWords.has(w)) hinglishScore++;
    if (tanglishWords.has(w)) tanglishScore++;
    if (kanglishWords.has(w)) kanglishScore++;
  });

  const scores = [
    { display: 'Telugu (Tenglish)', code: 'Telugu', score: tenglishScore, isRomanized: true },
    { display: 'Hindi (Hinglish)',   code: 'Hindi',  score: hinglishScore, isRomanized: true },
    { display: 'Tamil (Tanglish)',   code: 'Tamil',  score: tanglishScore, isRomanized: true },
    { display: 'Kannada (Kanglish)', code: 'Kannada',score: kanglishScore, isRomanized: true }
  ];
  scores.sort((a, b) => b.score - a.score);

  if (scores[0].score > 0) {
    return scores[0];
  }

  return { display: 'English', code: 'English', isRomanized: false };
}

/**
 * Populate AI Response Language selector with Auto-Detect as default
 */
function initLanguageSelector() {
  const langSelect = document.getElementById('note-language');
  if (!langSelect) return;

  langSelect.innerHTML = '';

  // 1. Auto-Detect option (Default)
  const autoOption = document.createElement('option');
  autoOption.value = 'Auto';
  autoOption.textContent = '🌐 Auto-Detect (Matches your input language)';
  autoOption.selected = true;
  langSelect.appendChild(autoOption);

  // 2. 10 Supported Indian and International languages
  const languages = window.SUPPORTED_LANGUAGES || [
    { code: 'Telugu', label: 'Telugu', native: 'తెలుగు' },
    { code: 'Hindi', label: 'Hindi', native: 'हिन्दी' },
    { code: 'English', label: 'English', native: 'English' },
    { code: 'Gujarati', label: 'Gujarati', native: 'ગુજરાતી' },
    { code: 'Marathi', label: 'Marathi', native: 'मराठी' },
    { code: 'Kannada', label: 'Kannada', native: 'ಕನ್ನಡ' },
    { code: 'Tamil', label: 'Tamil', native: 'தமிழ்' },
    { code: 'Malayalam', label: 'Malayalam', native: 'മലയാളം' },
    { code: 'Bengali', label: 'Bengali', native: 'বাংলা' },
    { code: 'Punjabi', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' }
  ];

  languages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = `${lang.native} (${lang.label})`;
    langSelect.appendChild(option);
  });

  // When response language changes manually, update the feedback text
  langSelect.addEventListener('change', updateDetectionFeedback);
}

/**
 * Real-time Language Detection on typing in #note-topic
 */
function initTopicInputDetection() {
  const topicInput = document.getElementById('note-topic');
  if (!topicInput) return;

  let debounceTimer = null;
  topicInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const val = topicInput.value.trim();
      if (val.length >= 2) {
        currentDetectedLanguage = detectInputLanguage(val);
        updateDetectionFeedback();
      } else {
        const feedbackEl = document.getElementById('detected-language-feedback');
        if (feedbackEl) feedbackEl.style.display = 'none';
      }
    }, 120);
  });
}

function updateDetectionFeedback() {
  const feedbackEl = document.getElementById('detected-language-feedback');
  const textEl = document.getElementById('detected-language-text');
  const langSelect = document.getElementById('note-language');
  if (!feedbackEl || !textEl) return;

  const topicInput = document.getElementById('note-topic');
  if (!topicInput || !topicInput.value.trim()) {
    feedbackEl.style.display = 'none';
    return;
  }

  const selectedLang = langSelect ? langSelect.value : 'Auto';
  feedbackEl.style.display = 'block';

  if (selectedLang === 'Auto') {
    textEl.innerHTML = `🌐 Detected Input: <strong>${window.escapeHtml(currentDetectedLanguage.display)}</strong> &nbsp;•&nbsp; AI will reply in <strong>${window.escapeHtml(currentDetectedLanguage.code)}</strong>`;
  } else {
    textEl.innerHTML = `🌐 Detected Input: <strong>${window.escapeHtml(currentDetectedLanguage.display)}</strong> &nbsp;•&nbsp; Manual Override: <strong>${window.escapeHtml(selectedLang)}</strong>`;
  }
}

/**
 * Handle form submission, custom interest toggle & multi-stage generation
 */
function initNotesForm() {
  const form = document.getElementById('ai-notes-form');
  const interestSelect = document.getElementById('note-interest');
  const customInterestGroup = document.getElementById('custom-interest-group');
  const customInterestInput = document.getElementById('note-custom-interest');

  // Toggle custom interest input field
  if (interestSelect && customInterestGroup) {
    interestSelect.addEventListener('change', () => {
      if (interestSelect.value === 'Custom') {
        customInterestGroup.style.display = 'block';
        if (customInterestInput) customInterestInput.focus();
      } else {
        customInterestGroup.style.display = 'none';
      }
    });
  }

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const topic = document.getElementById('note-topic').value.trim();
    const language = document.getElementById('note-language').value;
    const interest = document.getElementById('note-interest').value;
    const difficulty = document.getElementById('note-difficulty').value;
    const style = document.getElementById('note-style').value;
    const customInterest = customInterestInput ? customInterestInput.value.trim() : '';

    if (!topic) {
      window.showToast('Please enter a topic to generate notes for.', 'error');
      document.getElementById('note-topic').focus();
      return;
    }

    if (interest === 'Custom' && !customInterest) {
      window.showToast('Please specify your custom interest.', 'error');
      customInterestInput.focus();
      return;
    }

    // Determine target language label for progress bar
    const targetLangDisplay = language === 'Auto' ? currentDetectedLanguage.code : language;

    // Enter Loading State
    setGeneratingState(true);

    try {
      // Simulate multi-stage AI cognitive pipeline
      await updateStageProgress('1/3 Analyzing semantic domain & knowledge boundaries...', 500);
      await updateStageProgress(`2/3 Translating core cognitive units into ${targetLangDisplay}...`, 600);
      await updateStageProgress(`3/3 Synthesizing ${style.toLowerCase()} structure tailored to ${interest === 'Custom' ? customInterest : interest}...`, 500);

      const note = await window.API.generateNotes({
        topic,
        language,
        detected_language: currentDetectedLanguage.display,
        interest,
        customInterest,
        difficulty,
        style
      });

      currentGeneratedNote = note;
      renderAiResponse(note);
      setGeneratingState(false);
      window.showToast(`AI Notes synthesized successfully in ${note.language}!`, 'success');

      // Scroll to response section smoothly on smaller devices
      const responseCard = document.getElementById('ai-response-container');
      if (responseCard) {
        responseCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

    } catch (err) {
      console.error(err);
      window.showToast(err.message || 'Failed to generate AI notes. Please try again.', 'error');
      setGeneratingState(false);
    }
  });
}

function updateStageProgress(statusText, delayMs) {
  const statusEl = document.getElementById('ai-status-text');
  if (statusEl) statusEl.textContent = statusText;
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

function setGeneratingState(isGenerating) {
  const submitBtn = document.getElementById('generate-notes-btn');
  const loadingIndicator = document.getElementById('ai-loading-indicator');
  const initialPlaceholder = document.getElementById('ai-initial-placeholder');
  const responseContent = document.getElementById('ai-response-content');

  if (isGenerating) {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="animate-spin">⚙️</span> Synthesizing Knowledge...';
    }
    if (initialPlaceholder) initialPlaceholder.style.display = 'none';
    if (responseContent) responseContent.style.display = 'none';
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
  } else {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '⚡ Generate Notes';
    }
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (responseContent) responseContent.style.display = 'block';
  }
}

/**
 * Render structured AI Response
 */
function renderAiResponse(note) {
  const container = document.getElementById('ai-response-content');
  if (!container) return;

  const sectionsHtml = (note.sections || []).map(sec => `
    <div class="note-section-block">
      <h4 class="note-section-title">${window.escapeHtml(sec.title)}</h4>
      <div class="note-section-body">${formatMarkdownStyle(sec.content)}</div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="note-header-banner">
      <div class="note-meta-badges">
        <span class="badge badge-cyan">🌍 ${window.escapeHtml(note.language)}</span>
        ${note.detected_language ? `<span class="badge badge-emerald">🔍 Input: ${window.escapeHtml(note.detected_language)}</span>` : ''}
        <span class="badge badge-violet">🎯 ${window.escapeHtml(note.interest)}</span>
        <span class="badge badge-amber">📊 ${window.escapeHtml(note.difficulty)}</span>
        <span class="badge badge-emerald">✍️ ${window.escapeHtml(note.style || 'Detailed')}</span>
      </div>
      <h2 class="note-main-topic">${window.escapeHtml(note.topic)}</h2>
      <p class="note-executive-summary">${window.escapeHtml(note.summary)}</p>
      
      ${note.multilingualSpotlight ? `
        <div class="multilingual-spotlight-box">
          <div class="spotlight-title">✨ Multilingual AI Synthesis (${window.escapeHtml(note.multilingualSpotlight.languageName)})</div>
          <div class="spotlight-content">${window.escapeHtml(note.multilingualSpotlight.translatedSummary)}</div>
        </div>
      ` : ''}
    </div>

    <div class="note-body-content">
      ${sectionsHtml}
    </div>

    <div class="note-actions-bar">
      <button class="btn btn-secondary btn-sm" id="btn-copy-note">
        📋 Copy Notes
      </button>
      <button class="btn btn-primary btn-sm" id="btn-save-note">
        💾 Save to My Library
      </button>
      <button class="btn btn-outline btn-sm" id="btn-listen-note">
        🔊 Listen (TTS)
      </button>
      <button class="btn btn-outline btn-sm" id="btn-export-note">
        🖨️ Export / Print
      </button>
    </div>
  `;

  bindNoteActionEvents(note);
}

/**
 * Markdown formatting helper for bold, lists, and line breaks
 */
function formatMarkdownStyle(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^✓\s(.*)$/gm, '<div class="check-item"><span class="check-icon">✓</span> <span>$1</span></div>')
    .replace(/^•\s(.*)$/gm, '<li class="note-list-item">$1</li>')
    .replace(/^▸\s(.*)$/gm, '<div class="example-item"><span style="color: var(--cyan-400);">▸</span> <span>$1</span></div>')
    .replace(/\n\n/g, '<br><br>');
}

/**
 * Bind Action buttons for Copy, Save, Listen, Export
 */
function bindNoteActionEvents(note) {
  // Copy
  const copyBtn = document.getElementById('btn-copy-note');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      let rawText = `# ${note.topic} (${note.language})\n\n${note.summary}\n\n`;
      (note.sections || []).forEach(sec => {
        rawText += `## ${sec.title}\n${sec.content}\n\n`;
      });

      try {
        await navigator.clipboard.writeText(rawText);
        window.showToast('Notes copied to clipboard!', 'success');
      } catch (e) {
        window.showToast('Note text selected. Press Ctrl+C to copy.', 'info');
      }
    });
  }

  // Save to History
  const saveBtn = document.getElementById('btn-save-note');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const savedList = JSON.parse(localStorage.getItem('vaylume_saved_notes') || '[]');
      if (!savedList.some(n => n.id === note.id)) {
        savedList.unshift(note);
        localStorage.setItem('vaylume_saved_notes', JSON.stringify(savedList));
        renderSavedNotesList();
        window.showToast('Saved to your private knowledge library!', 'success');
      } else {
        window.showToast('Note is already in your library.', 'info');
      }
    });
  }

  // Listen (Web Speech API)
  const listenBtn = document.getElementById('btn-listen-note');
  if (listenBtn) {
    listenBtn.addEventListener('click', () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(`${note.topic}. ${note.summary}`);
        window.speechSynthesis.speak(utterance);
        window.showToast('Playing audio synthesis...', 'info');
      } else {
        window.showToast('Text-to-speech audio synthesis initialized.', 'info');
      }
    });
  }

  // Export / Print
  const exportBtn = document.getElementById('btn-export-note');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      window.print();
    });
  }
}

/**
 * Saved Notes Library Drawer & Local Persistence
 */
function initSavedNotesDrawer() {
  renderSavedNotesList();

  const searchInput = document.getElementById('saved-notes-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      renderSavedNotesList(term);
    });
  }
}

function renderSavedNotesList(filterTerm = '') {
  const container = document.getElementById('saved-notes-history-list');
  if (!container) return;

  let saved = JSON.parse(localStorage.getItem('vaylume_saved_notes') || '[]');

  if (saved.length === 0) {
    saved = [
      {
        id: 'note_demo_1',
        topic: 'Quantum Computing Fundamentals',
        language: 'English',
        detected_language: 'English',
        interest: 'Programming',
        difficulty: 'Intermediate',
        style: 'Detailed',
        summary: 'Qubits, Superposition, Entanglement, and Quantum Gate Logic explained through developer models.',
        sections: [
          {
            title: '1. Executive Overview & Mental Model',
            content: 'Unlike classical bits representing 0 or 1, qubits exploit superposition to evaluate multidimensional states simultaneously.'
          },
          {
            title: '2. Quantum Gates vs Logic Gates',
            content: 'Hadamard gates create superposition, while CNOT gates establish entanglement across paired particles.'
          }
        ]
      },
      {
        id: 'note_demo_2',
        topic: 'భారతీయ సంగీత రాగాలు (Indian Ragas)',
        language: 'Telugu',
        detected_language: 'Telugu',
        interest: 'Singing',
        difficulty: 'Beginner',
        style: 'Simple',
        summary: 'కర్ణాటక మరియు హిందుస్తానీ సంగీతంలో ప్రాథమిక రాగాలు మరియు వాటి భావోద్వేగ లక్షణాలు.',
        sections: [
          {
            title: '1. రాగాల ప్రాముఖ్యత',
            content: 'రాగం అనేది స్వరాల కలయికతో ఏర్పడే శ్రావ్యమైన సంగీత రూపం. ప్రతి రాగానికి ఒక నిర్దిష్ట సమయం మరియు రసం ఉంటాయి.'
          }
        ]
      }
    ];
    localStorage.setItem('vaylume_saved_notes', JSON.stringify(saved));
  }

  if (filterTerm) {
    saved = saved.filter(n =>
      n.topic.toLowerCase().includes(filterTerm) ||
      (n.language && n.language.toLowerCase().includes(filterTerm))
    );
  }

  container.innerHTML = saved.map(item => `
    <div class="saved-note-item" data-id="${item.id}">
      <div class="saved-note-top">
        <span class="badge badge-cyan" style="font-size: 0.68rem;">${window.escapeHtml(item.language)}</span>
        <span class="saved-note-date">${item.difficulty}</span>
      </div>
      <h5 class="saved-note-title">${window.escapeHtml(item.topic)}</h5>
      <p class="saved-note-snippet">${window.escapeHtml(item.summary || '')}</p>
    </div>
  `).join('');

  // Click to reload note
  container.querySelectorAll('.saved-note-item').forEach(itemEl => {
    itemEl.addEventListener('click', () => {
      const id = itemEl.dataset.id;
      const found = saved.find(n => n.id === id);
      if (found) {
        currentGeneratedNote = found;
        setGeneratingState(false);
        renderAiResponse(found);
        window.showToast(`Loaded "${found.topic}"`, 'info', 2000);
      }
    });
  });
}
