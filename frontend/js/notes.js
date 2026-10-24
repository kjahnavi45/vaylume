/**
 * ==========================================================================
 * VAYLUME - AI Notes Studio Controller (notes.js)
 * ==========================================================================
 * Features:
 * - Multilingual AI note generator with interest, difficulty & style selectors
 * - Custom interest dynamic input trigger
 * - Multi-stage radar synthesis animation
 * - Structured note rendering with code/key takeaways/analogies
 * - Copy to clipboard, export, and save to local history
 * - Saved notes history drawer with search and reload
 */

let currentGeneratedNote = null;

document.addEventListener('DOMContentLoaded', () => {
  initNotesForm();
  initLanguageSelector();
  initSavedNotesDrawer();
});

/**
 * Populate supported languages into the AI language selector
 */
function initLanguageSelector() {
  const langSelect = document.getElementById('note-language');
  if (!langSelect || !window.SUPPORTED_LANGUAGES) return;

  const activeLang = window.getActiveLanguage ? window.getActiveLanguage() : 'English';
  langSelect.innerHTML = '';

  window.SUPPORTED_LANGUAGES.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = `${lang.native} (${lang.label})`;
    if (lang.code === activeLang) option.selected = true;
    langSelect.appendChild(option);
  });
}

/**
 * Handle form submission, custom interest toggle & multi-stage generation
 */
function initNotesForm() {
  const form = document.getElementById('ai-notes-form');
  const interestSelect = document.getElementById('note-interest');
  const customInterestGroup = document.getElementById('custom-interest-group');
  const customInterestInput = document.getElementById('note-custom-interest');
  const submitBtn = document.getElementById('generate-notes-btn');

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

    // Enter Loading State
    setGeneratingState(true);

    try {
      // Simulate multi-stage AI cognitive pipeline
      await updateStageProgress('1/3 Analyzing semantic domain & knowledge boundaries...', 600);
      await updateStageProgress(`2/3 Translating core cognitive units into ${language}...`, 700);
      await updateStageProgress(`3/3 Synthesizing ${style.toLowerCase()} structure tailored to ${interest === 'Custom' ? customInterest : interest}...`, 600);

      const note = await window.API.generateNotes({
        topic,
        language,
        interest,
        customInterest,
        difficulty,
        style
      });

      currentGeneratedNote = note;
      renderAiResponse(note);
      setGeneratingState(false);
      window.showToast(`AI Notes synthesized successfully in ${language}!`, 'success');

      // Scroll to response section smoothly on smaller devices
      const responseCard = document.getElementById('ai-response-container');
      if (responseCard) {
        responseCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

    } catch (err) {
      console.error(err);
      window.showToast('Failed to generate AI notes. Please try again.', 'error');
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
        <span class="badge badge-violet">🎯 ${window.escapeHtml(note.interest)}</span>
        <span class="badge badge-amber">📊 ${window.escapeHtml(note.difficulty)}</span>
        <span class="badge badge-emerald">✍️ ${window.escapeHtml(note.style)}</span>
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
    .replace(/^-\s(.*)$/gm, '<li class="note-list-item">$1</li>')
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
      // Check if already saved
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

  // Listen (Simulated / Web Speech API)
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

  // Seed default notes if empty for demo
  if (saved.length === 0) {
    saved = [
      {
        id: 'note_demo_1',
        topic: 'Quantum Computing Fundamentals',
        language: 'English',
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
    saved = saved.filter(n => n.topic.toLowerCase().includes(filterTerm) || n.language.toLowerCase().includes(filterTerm));
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
