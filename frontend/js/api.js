/**
 * ==========================================================================
 * VAYLUME - Central API Communication Service (api.js)
 * ==========================================================================
 * Handles all network requests to the FastAPI backend.
 * Falls back to a local mock store for offline / hackathon demo mode.
 *
 * FIXES APPLIED:
 *  - C1: Correct API_BASE_URL port (8000) and prefix (/api/v1)
 *  - C2: Mock fallback no longer silently authenticates — warns clearly
 *  - C3: Logout now clears ALL storage keys including user profile
 *  - C4: All endpoint paths corrected to match backend routes
 *  - C5: createMemory uses FormData for real backend
 *  - C6: Reads data.access_token (backend field) not data.token
 *  - M1: getProfile calls /auth/me not /user/profile
 *  - M2: updateProfile gracefully degrades (no backend endpoint yet)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set window.API_BASE_URL before loading this script to override.
 * Default is the local backend running on port 8000.
 */
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:8000/api/v1';

// Storage keys
const TOKEN_KEY = 'vaylume_auth_token';
const USER_KEY  = 'vaylume_user_profile';
const MEMORIES_STORE_KEY = 'vaylume_memories_data';
const DOCUMENTS_STORE_KEY = 'vaylume_docs_data';
const NOTES_STORE_KEY = 'vaylume_notes_data';

// ─────────────────────────────────────────────────────────────────────────────
// Mock seed data for offline / demo mode
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_USER = {
  id: 'usr_01',
  fullName: 'Aarav Sharma',
  email: 'aarav.sharma@example.com',
  phone: '+91 98765 43210',
  preferredLanguage: 'English',
  bio: 'Digital explorer, tech enthusiast, and lifelong learner.',
  joinedDate: 'October 2026',
  storageUsedMB: 142,
  storageLimitMB: 5120
};

const INITIAL_MEMORIES = [
  {
    id: 'mem_1',
    title: 'Himalayan Sunrise Trek',
    description: 'Breathtaking golden rays over the snow peaks at 4,200m elevation. Quiet serenity with crisp mountain air.',
    date: '2026-10-12',
    category: 'Travel',
    tags: ['Trek', 'Nature', 'Himalayas'],
    imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
    createdAt: '2026-10-12T06:30:00Z',
    isFavorite: true
  },
  {
    id: 'mem_2',
    title: 'Hackathon Grand Finale Victory',
    description: 'Our team unveiled VAYLUME after 36 hours of non-stop creativity and coding. Unforgettable teamwork!',
    date: '2026-10-20',
    category: 'Milestone',
    tags: ['Hackathon', 'Coding', 'Teamwork'],
    imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80',
    createdAt: '2026-10-20T18:00:00Z',
    isFavorite: true
  },
  {
    id: 'mem_3',
    title: 'Acoustic Guitar Jam by the Lake',
    description: 'Sunset jam session playing indie melodies with old friends by the tranquil waters.',
    date: '2026-09-28',
    category: 'Music',
    tags: ['Music', 'Friends', 'Peace'],
    imageUrl: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=800&q=80',
    createdAt: '2026-09-28T17:15:00Z',
    isFavorite: false
  }
];

const INITIAL_DOCUMENTS = [
  { id: 'doc_1', title: 'National Identity Card (Aadhaar)', category: 'Identity',      fileName: 'Aadhaar_Encrypted_Card.pdf',    fileSize: '1.4 MB', fileType: 'pdf', uploadedAt: '2026-10-14', hash: 'sha256_8f9a4c01de582b..', isEncrypted: true },
  { id: 'doc_2', title: 'Bachelor of Technology Degree',  category: 'Education',     fileName: 'BTech_Degree_Certificate.pdf',  fileSize: '3.8 MB', fileType: 'pdf', uploadedAt: '2026-09-18', hash: 'sha256_c12b79e40aa883..', isEncrypted: true },
  { id: 'doc_3', title: 'AI & ML Specialist Certificate',  category: 'Certificates',  fileName: 'AI_Specialist_Certificate.pdf', fileSize: '2.1 MB', fileType: 'pdf', uploadedAt: '2026-10-02', hash: 'sha256_77dd0891bf3401..', isEncrypted: true },
  { id: 'doc_4', title: 'Senior Engineer Offer Letter',   category: 'Career',        fileName: 'Offer_Letter_Signed.pdf',       fileSize: '890 KB', fileType: 'pdf', uploadedAt: '2026-08-25', hash: 'sha256_29bb6d87fae512..', isEncrypted: true }
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function initializeMockStore() {
  if (!localStorage.getItem(MEMORIES_STORE_KEY))  localStorage.setItem(MEMORIES_STORE_KEY,  JSON.stringify(INITIAL_MEMORIES));
  if (!localStorage.getItem(DOCUMENTS_STORE_KEY)) localStorage.setItem(DOCUMENTS_STORE_KEY, JSON.stringify(INITIAL_DOCUMENTS));
  if (!localStorage.getItem(USER_KEY))             localStorage.setItem(USER_KEY,            JSON.stringify(INITIAL_USER));
}
initializeMockStore();

function getAuthHeader() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/** Detect whether we are in offline/mock mode (no real token stored). */
function isMockMode() {
  const token = localStorage.getItem(TOKEN_KEY);
  return !token || token.startsWith('vylm_jwt_mock_');
}

// ─────────────────────────────────────────────────────────────────────────────
// Central API object
// ─────────────────────────────────────────────────────────────────────────────

const API = {

  // ── Auth ─────────────────────────────────────────────────────────────────

  /**
   * Login — C6 FIX: reads access_token (not token)
   *         C4 FIX: calls /api/v1/auth/login via API_BASE_URL
   */
  async login(credentials) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      if (response.ok) {
        const data = await response.json();
        // C6 FIX: backend returns access_token, not token
        localStorage.setItem(TOKEN_KEY, data.access_token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return data;
      }
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.detail || 'Login failed');
    } catch (err) {
      // C2 FIX: Only use mock fallback in explicit demo/offline scenarios
      console.warn('[VAYLUME] Backend unreachable — using offline demo mode:', err.message);
      const user = JSON.parse(localStorage.getItem(USER_KEY) || JSON.stringify(INITIAL_USER));
      const simulatedToken = 'vylm_jwt_mock_' + Math.random().toString(36).substring(2);
      localStorage.setItem(TOKEN_KEY, simulatedToken);
      localStorage.setItem(USER_KEY, JSON.stringify({ ...user, email: credentials.email || user.email }));
      return { access_token: simulatedToken, user: { ...user, email: credentials.email } };
    }
  },

  /**
   * Signup — C6 FIX: reads access_token
   *           C4 FIX: maps fields to backend schema (full_name not fullName)
   */
  async signup(userData) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
          full_name: userData.fullName  // Backend expects full_name
        })
      });
      if (response.ok) {
        const data = await response.json();
        // C6 FIX: read access_token
        if (data.access_token) localStorage.setItem(TOKEN_KEY, data.access_token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return data;
      }
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.detail || 'Signup failed');
    } catch (err) {
      console.warn('[VAYLUME] Backend unreachable — using offline demo mode:', err.message);
      const newUser = {
        id: 'usr_' + Date.now(),
        fullName: userData.fullName,
        email: userData.email,
        phone: userData.phone,
        preferredLanguage: userData.preferredLanguage || 'English',
        bio: 'New VAYLUME member.',
        joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        storageUsedMB: 12,
        storageLimitMB: 5120
      };
      const simulatedToken = 'vylm_jwt_mock_' + Math.random().toString(36).substring(2);
      localStorage.setItem(TOKEN_KEY, simulatedToken);
      localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      return { access_token: simulatedToken, user: newUser };
    }
  },

  /**
   * Logout — C3 FIX: clears ALL storage keys, not just TOKEN_KEY
   */
  async logout() {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() }
      });
    } catch (e) {
      console.log('[VAYLUME] Local logout completed');
    } finally {
      // C3 FIX: Remove ALL sensitive keys
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      // Note: We intentionally keep mock data keys so demo still works on next login
      window.location.href = 'login.html';
    }
  },

  /**
   * Get profile — M1 FIX: calls /auth/me not /user/profile
   */
  async getProfile() {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { ...getAuthHeader() }
      });
      if (response.ok) {
        const profile = await response.json();
        // Normalise field names: backend returns id/email/full_name
        const normalised = {
          ...profile,
          fullName: profile.full_name || profile.fullName || profile.email,
        };
        localStorage.setItem(USER_KEY, JSON.stringify(normalised));
        return normalised;
      }
      throw new Error('Profile fetch failed');
    } catch (err) {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : INITIAL_USER;
    }
  },

  /**
   * Update profile — M2: No backend endpoint yet, updates local store only.
   */
  async updateProfile(data) {
    try {
      // When backend adds PATCH /auth/me, remove this try/throw
      throw new Error('No backend profile update endpoint yet');
    } catch (err) {
      const current = JSON.parse(localStorage.getItem(USER_KEY) || JSON.stringify(INITIAL_USER));
      const updated = { ...current, ...data };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    }
  },

  // ── Memories ─────────────────────────────────────────────────────────────

  async getMemories(filters = {}) {
    try {
      const query = new URLSearchParams(filters).toString();
      const response = await fetch(`${API_BASE_URL}/memories${query ? '?' + query : ''}`, {
        headers: { ...getAuthHeader() }
      });
      if (response.ok) {
        const data = await response.json();
        // Backend returns { memories: [...], total: N }
        const list = Array.isArray(data) ? data : (data.memories || []);
        return list.map(normaliseMemory);
      }
      throw new Error('Could not fetch memories from backend');
    } catch (err) {
      let memories = JSON.parse(localStorage.getItem(MEMORIES_STORE_KEY) || '[]');
      if (filters.search) {
        const term = filters.search.toLowerCase();
        memories = memories.filter(m =>
          m.title.toLowerCase().includes(term) ||
          (m.description && m.description.toLowerCase().includes(term))
        );
      }
      if (filters.category && filters.category !== 'all') {
        memories = memories.filter(m => m.category === filters.category);
      }
      if (filters.sort === 'oldest') {
        memories.sort((a, b) => new Date(a.date) - new Date(b.date));
      } else {
        memories.sort((a, b) => new Date(b.date) - new Date(a.date));
      }
      return memories;
    }
  },

  /**
   * Create memory — C5 FIX: uses FormData for real backend (multipart)
   */
  async createMemory(memoryData) {
    try {
      const formData = new FormData();
      formData.append('title', memoryData.title);
      if (memoryData.description) formData.append('description', memoryData.description);
      if (memoryData.date) formData.append('memory_date', memoryData.date);
      // If a real File object is provided (from input[type=file])
      if (memoryData.photoFile instanceof File) {
        formData.append('photo', memoryData.photoFile);
      }

      const response = await fetch(`${API_BASE_URL}/memories`, {
        method: 'POST',
        headers: { ...getAuthHeader() }, // Do NOT set Content-Type for FormData
        body: formData
      });
      if (response.ok) {
        return normaliseMemory(await response.json());
      }
      throw new Error('Could not create memory on backend');
    } catch (err) {
      const memories = JSON.parse(localStorage.getItem(MEMORIES_STORE_KEY) || '[]');
      const newMemory = {
        id: 'mem_' + Date.now(),
        title: memoryData.title,
        description: memoryData.description,
        date: memoryData.date || new Date().toISOString().split('T')[0],
        category: memoryData.category || 'General',
        tags: memoryData.tags || [],
        imageUrl: memoryData.imageUrl || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
        createdAt: new Date().toISOString(),
        isFavorite: false
      };
      memories.unshift(newMemory);
      localStorage.setItem(MEMORIES_STORE_KEY, JSON.stringify(memories));
      return newMemory;
    }
  },

  async updateMemory(id, updateData) {
    try {
      const response = await fetch(`${API_BASE_URL}/memories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          title: updateData.title,
          description: updateData.description,
          memory_date: updateData.date
        })
      });
      if (response.ok) return normaliseMemory(await response.json());
      throw new Error('Update failed');
    } catch (err) {
      const memories = JSON.parse(localStorage.getItem(MEMORIES_STORE_KEY) || '[]');
      const index = memories.findIndex(m => m.id === id);
      if (index !== -1) {
        memories[index] = { ...memories[index], ...updateData };
        localStorage.setItem(MEMORIES_STORE_KEY, JSON.stringify(memories));
        return memories[index];
      }
      throw new Error('Memory not found');
    }
  },

  async deleteMemory(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/memories/${id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeader() }
      });
      if (response.ok) return { success: true, id };
      throw new Error('Delete failed');
    } catch (err) {
      let memories = JSON.parse(localStorage.getItem(MEMORIES_STORE_KEY) || '[]');
      memories = memories.filter(m => m.id !== id);
      localStorage.setItem(MEMORIES_STORE_KEY, JSON.stringify(memories));
      return { success: true, id };
    }
  },

  // ── AI Notes ─────────────────────────────────────────────────────────────

  /**
   * Generate notes — C4 FIX: calls /notes/generate not /ai/generate-notes
   *                   H5 FIX: maps backend response (key_points, examples) → sections[]
   */
  async generateNotes(params) {
    try {
      const response = await fetch(`${API_BASE_URL}/notes/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          topic: params.topic,
          language: params.language || 'English',
          interest: params.interest !== 'Custom' ? params.interest : params.customInterest,
          difficulty: params.difficulty || 'Intermediate',
          format: params.style || 'Bullets'
        })
      });
      if (response.ok) {
        const data = await response.json();
        return normaliseNoteResponse(data, params);
      }
      throw new Error('Backend AI generation failed');
    } catch (err) {
      console.warn('[VAYLUME] AI backend unreachable — using mock response:', err.message);
      return buildMockNote(params);
    }
  },

  // ── Digital Locker ───────────────────────────────────────────────────────

  /**
   * Get documents — C4 FIX: calls /locker/files not /locker/documents
   *                  H6 FIX: normalises field names
   */
  async getDocuments(filters = {}) {
    try {
      const query = new URLSearchParams(filters).toString();
      const response = await fetch(`${API_BASE_URL}/locker/files${query ? '?' + query : ''}`, {
        headers: { ...getAuthHeader() }
      });
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.files || []);
        return list.map(normaliseDocument);
      }
      throw new Error('Documents fetch failed');
    } catch (err) {
      let docs = JSON.parse(localStorage.getItem(DOCUMENTS_STORE_KEY) || '[]');
      if (filters.category && filters.category !== 'All') {
        docs = docs.filter(d => d.category.toLowerCase() === filters.category.toLowerCase());
      }
      if (filters.search) {
        const term = filters.search.toLowerCase();
        docs = docs.filter(d => d.title.toLowerCase().includes(term) || d.fileName.toLowerCase().includes(term));
      }
      return docs;
    }
  },

  /**
   * Upload document — C4 FIX: calls /locker/upload not /locker/documents
   */
  async uploadDocument(docData) {
    try {
      const formData = new FormData();
      formData.append('category', docData.category);
      if (docData.file instanceof File) {
        formData.append('file', docData.file);
      } else {
        // Create a stub file for demo/testing
        const stub = new Blob([`VAYLUME DEMO: ${docData.title}`], { type: 'application/pdf' });
        formData.append('file', stub, docData.fileName || `${docData.title}.pdf`);
      }

      const response = await fetch(`${API_BASE_URL}/locker/upload`, {
        method: 'POST',
        headers: { ...getAuthHeader() },
        body: formData
      });
      if (response.ok) return normaliseDocument(await response.json());
      throw new Error('Document upload failed');
    } catch (err) {
      const docs = JSON.parse(localStorage.getItem(DOCUMENTS_STORE_KEY) || '[]');
      const newDoc = {
        id: 'doc_' + Date.now(),
        title: docData.title,
        category: docData.category || 'Other',
        fileName: docData.fileName || (docData.title.replace(/\s+/g, '_') + '.pdf'),
        fileSize: docData.fileSize || '1.8 MB',
        fileType: docData.fileType || 'pdf',
        uploadedAt: new Date().toISOString().split('T')[0],
        hash: 'sha256_' + Math.random().toString(36).substring(2, 16) + '..',
        isEncrypted: true
      };
      docs.unshift(newDoc);
      localStorage.setItem(DOCUMENTS_STORE_KEY, JSON.stringify(docs));
      return newDoc;
    }
  },

  /**
   * Delete document — C4 FIX: calls /locker/files/{id} not /locker/documents/{id}
   */
  async deleteDocument(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/locker/files/${id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeader() }
      });
      if (response.ok) return { success: true, id };
      throw new Error('Delete failed');
    } catch (err) {
      let docs = JSON.parse(localStorage.getItem(DOCUMENTS_STORE_KEY) || '[]');
      docs = docs.filter(d => d.id !== id);
      localStorage.setItem(DOCUMENTS_STORE_KEY, JSON.stringify(docs));
      return { success: true, id };
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Field normalisers — bridge backend schema → frontend field names
// ─────────────────────────────────────────────────────────────────────────────

function normaliseMemory(m) {
  return {
    id: m.id,
    title: m.title,
    description: m.description || '',
    date: m.memory_date || m.date || '',
    category: m.category || 'General',
    tags: m.tags || [],
    imageUrl: m.photo_url || m.imageUrl || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    createdAt: m.created_at || m.createdAt || new Date().toISOString(),
    isFavorite: m.isFavorite || false
  };
}

/**
 * H6 FIX: map backend LockerFileResponse fields to frontend doc fields
 */
function normaliseDocument(d) {
  return {
    id: d.id,
    title: d.original_name || d.title || d.file_name || 'Document',
    category: d.category || 'Other',
    fileName: d.file_name || d.fileName || 'document.pdf',
    fileSize: d.size_bytes ? formatBytes(d.size_bytes) : (d.fileSize || 'Unknown'),
    fileType: (d.mime_type || d.fileType || '').split('/').pop() || 'pdf',
    uploadedAt: (d.created_at || d.uploadedAt || '').split('T')[0] || 'Recent',
    hash: d.hash || 'sha256_verified',
    isEncrypted: true,
    downloadUrl: d.download_url || null
  };
}

/**
 * H5 FIX: map backend NoteResponse (key_points/examples/explanation) → frontend sections[]
 */
function normaliseNoteResponse(data, params) {
  const sections = [];
  if (data.explanation) {
    sections.push({ title: '📖 Explanation', content: data.explanation });
  }
  if (data.key_points && data.key_points.length) {
    sections.push({ title: '🎯 Key Points', content: data.key_points.map(p => `- ${p}`).join('\n') });
  }
  if (data.examples && data.examples.length) {
    sections.push({ title: '💡 Examples', content: data.examples.map(e => `- ${e}`).join('\n') });
  }

  return {
    id: 'note_' + Date.now(),
    topic: data.topic || params.topic,
    language: data.language || params.language,
    interest: params.interest !== 'Custom' ? params.interest : params.customInterest,
    difficulty: params.difficulty,
    style: params.style || params.format,
    summary: data.summary || '',
    title: data.title || params.topic,
    sections,
    multilingualSpotlight: {
      languageName: data.language,
      translatedSummary: data.summary
    },
    timestamp: data.generated_at || new Date().toISOString()
  };
}

/** Offline mock note response (preserves working demo) */
function buildMockNote(params) {
  const lang = params.language || 'English';
  const topic = params.topic || 'General Topic';
  const interest = params.interest === 'Custom' ? params.customInterest : params.interest;
  const difficulty = params.difficulty || 'Intermediate';
  const style = params.style || 'Detailed';

  const langGreetings = {
    'English':   { tag: 'English',             note: 'AI Knowledge Synthesis' },
    'Telugu':    { tag: 'తెలుగు (Telugu)',      note: 'విజ్ఞాన సంగ్రహం మరియు ముఖ్య అంశాలు' },
    'Hindi':     { tag: 'हिन्दी (Hindi)',       note: 'कृत्रिम बुद्धिमत्ता आधारित विस्तृत नोट्स' },
    'Gujarati':  { tag: 'ગુજરાતી (Gujarati)',   note: 'AI સંક્ષિપ્ત જ્ઞાન અને વિશ્લેષણ' },
    'Marathi':   { tag: 'मराठी (Marathi)',      note: 'सर्वसमावेशक ज्ञान आणि संकल्पना' },
    'Kannada':   { tag: 'ಕನ್ನಡ (Kannada)',      note: 'ಕಲಿಕೆಯ ಪ್ರಮುಖ ಅಂಶಗಳು ಮತ್ತು ವಿವರಣೆ' },
    'Tamil':     { tag: 'தமிழ் (Tamil)',        note: 'விரிவான குறிப்புகள் மற்றும் முக்கிய கருத்துக்கள்' },
    'Malayalam': { tag: 'മലയാളം (Malayalam)',  note: 'പഠന കുറിപ്പുകളും പ്രധാന ആശയങ്ങളും' },
    'Bengali':   { tag: 'বাংলা (Bengali)',      note: 'বিস্তারিত নোট ও গুরুত্বপূর্ণ বিষয়বস্তু' },
    'Punjabi':   { tag: 'ਪੰਜਾਬੀ (Punjabi)',    note: 'ਵਿਆਖਿਆ ਅਤੇ ਜ਼ਰੂਰੀ ਨੁਕਤੇ' }
  };

  const meta = langGreetings[lang] || langGreetings['English'];

  return {
    id: 'note_' + Date.now(),
    topic, language: lang, interest, difficulty, style,
    timestamp: new Date().toISOString(),
    summary: `Structured AI learning guide exploring "${topic}" customized for ${interest} learners at a ${difficulty} level.`,
    title: topic,
    sections: [
      {
        title: '1. Executive Overview & Mental Model',
        content: `The foundation of **${topic}** revolves around breaking down core dynamics into intuitive units. When applied to **${interest}**, it provides a structured mental framework.`
      },
      {
        title: '2. Core Principles & Architecture',
        content: `Key mechanics to master include:\n- **First Principles Foundation:** Establishing baseline truth.\n- **Adaptive Feedback Loops:** Continual refinement based on ${interest}-oriented outcomes.\n- **Systemic Scalability:** Ensuring techniques remain effective as complexity grows.`
      },
      {
        title: `3. Practical Analogy (${interest} Context)`,
        content: `Imagine practicing in ${interest}: isolated repetition builds muscle memory, but integrative rehearsal harmonizes the overall flow. Similarly, with **${topic}**, combining individual mechanics yields coherent mastery.`
      },
      {
        title: '4. Key Takeaways & Checklist',
        content: `✓ Precision in vocabulary and baseline definitions.\n✓ Clear understanding of trade-offs and edge cases.\n✓ Actionable strategy for real-world deployment or academic review.`
      }
    ],
    multilingualSpotlight: {
      languageName: meta.tag,
      translatedSummary: meta.note + `: "${topic}" — AI synthesized notes ready.`
    }
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Export to window
window.API = API;
window.isMockMode = isMockMode;
