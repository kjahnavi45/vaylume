/**
 * ==========================================================================
 * VAYLUME - Central API Communication Service (api.js)
 * ==========================================================================
 * Handles network requests using fetch() to backend endpoints.
 * Includes placeholder configurations for REST APIs and automatic
 * client-side fallback store for seamless hackathon demos and frontend testing.
 */

// Backend API Base URL placeholder - customize when backend is deployed
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:5000/api';

// Storage keys
const TOKEN_KEY = 'vaylume_auth_token';
const USER_KEY = 'vaylume_user_profile';
const MEMORIES_STORE_KEY = 'vaylume_memories_data';
const DOCUMENTS_STORE_KEY = 'vaylume_docs_data';
const NOTES_STORE_KEY = 'vaylume_notes_data';

// Initial Mock Seed Data for instant hackathon demonstration
const INITIAL_USER = {
  id: 'usr_01',
  fullName: 'Aarav Sharma',
  email: 'aarav.sharma@example.com',
  phone: '+91 98765 43210',
  preferredLanguage: 'English',
  bio: 'Digital explorer, tech enthusiast, and lifelong learner.',
  joinedDate: 'October 2026',
  storageUsedMB: 142,
  storageLimitMB: 5120 // 5 GB
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
  {
    id: 'doc_1',
    title: 'National Identity Card (Aadhaar)',
    category: 'Identity',
    fileName: 'Aadhaar_Encrypted_Card.pdf',
    fileSize: '1.4 MB',
    fileType: 'pdf',
    uploadedAt: '2026-10-14',
    hash: 'sha256_8f9a4c01de582b..',
    isEncrypted: true
  },
  {
    id: 'doc_2',
    title: 'Bachelor of Technology Degree',
    category: 'Education',
    fileName: 'BTech_Degree_Certificate.pdf',
    fileSize: '3.8 MB',
    fileType: 'pdf',
    uploadedAt: '2026-09-18',
    hash: 'sha256_c12b79e40aa883..',
    isEncrypted: true
  },
  {
    id: 'doc_3',
    title: 'AI & Machine Learning Specialist Certificate',
    category: 'Certificates',
    fileName: 'AI_Specialist_Certificate.pdf',
    fileSize: '2.1 MB',
    fileType: 'pdf',
    uploadedAt: '2026-10-02',
    hash: 'sha256_77dd0891bf3401..',
    isEncrypted: true
  },
  {
    id: 'doc_4',
    title: 'Senior Software Engineer Offer Letter',
    category: 'Career',
    fileName: 'Offer_Letter_Signed.pdf',
    fileSize: '890 KB',
    fileType: 'pdf',
    uploadedAt: '2026-08-25',
    hash: 'sha256_29bb6d87fae512..',
    isEncrypted: true
  }
];

// Helper to initialize local store if not present
function initializeMockStore() {
  if (!localStorage.getItem(MEMORIES_STORE_KEY)) {
    localStorage.setItem(MEMORIES_STORE_KEY, JSON.stringify(INITIAL_MEMORIES));
  }
  if (!localStorage.getItem(DOCUMENTS_STORE_KEY)) {
    localStorage.setItem(DOCUMENTS_STORE_KEY, JSON.stringify(INITIAL_DOCUMENTS));
  }
  if (!localStorage.getItem(USER_KEY)) {
    localStorage.setItem(USER_KEY, JSON.stringify(INITIAL_USER));
  }
}

// Auto-seed mock storage
initializeMockStore();

// --- Auth Token Helpers ---
function getAuthHeader() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/**
 * Central API object
 */
const API = {
  /**
   * User Login
   * @param {Object} credentials - { email, password }
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
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return data;
      }
      throw new Error((await response.json()).message || 'Login failed');
    } catch (err) {
      // Graceful fallback for mock/offline frontend test
      console.warn('Backend API unreachable, using local authentication simulation:', err.message);
      
      const user = JSON.parse(localStorage.getItem(USER_KEY) || JSON.stringify(INITIAL_USER));
      const simulatedToken = 'vylm_jwt_' + Math.random().toString(36).substring(2);
      localStorage.setItem(TOKEN_KEY, simulatedToken);
      localStorage.setItem(USER_KEY, JSON.stringify({
        ...user,
        email: credentials.email || user.email
      }));

      return {
        success: true,
        token: simulatedToken,
        user: { ...user, email: credentials.email }
      };
    }
  },

  /**
   * User Signup
   * @param {Object} userData - { fullName, email, phone, password, preferredLanguage }
   */
  async signup(userData) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return data;
      }
      throw new Error((await response.json()).message || 'Signup failed');
    } catch (err) {
      console.warn('Backend API unreachable, simulating local user registration:', err.message);
      
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

      const simulatedToken = 'vylm_jwt_' + Math.random().toString(36).substring(2);
      localStorage.setItem(TOKEN_KEY, simulatedToken);
      localStorage.setItem(USER_KEY, JSON.stringify(newUser));

      return {
        success: true,
        token: simulatedToken,
        user: newUser
      };
    }
  },

  /**
   * User Logout
   */
  async logout() {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        }
      });
    } catch (e) {
      console.log('Local logout completed');
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = 'login.html';
    }
  },

  /**
   * Get Current User Profile
   */
  async getProfile() {
    try {
      const response = await fetch(`${API_BASE_URL}/user/profile`, {
        headers: { ...getAuthHeader() }
      });
      if (response.ok) {
        const profile = await response.json();
        localStorage.setItem(USER_KEY, JSON.stringify(profile));
        return profile;
      }
      throw new Error('Profile fetch failed');
    } catch (err) {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : INITIAL_USER;
    }
  },

  /**
   * Update Profile
   * @param {Object} data 
   */
  async updateProfile(data) {
    try {
      const response = await fetch(`${API_BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(data)
      });
      if (response.ok) {
        const updated = await response.json();
        localStorage.setItem(USER_KEY, JSON.stringify(updated));
        return updated;
      }
      throw new Error('Profile update failed');
    } catch (err) {
      const current = JSON.parse(localStorage.getItem(USER_KEY) || JSON.stringify(INITIAL_USER));
      const updated = { ...current, ...data };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    }
  },

  /**
   * Get Memories List
   * @param {Object} filters - { search, tag, sort }
   */
  async getMemories(filters = {}) {
    try {
      const query = new URLSearchParams(filters).toString();
      const response = await fetch(`${API_BASE_URL}/memories?${query}`, {
        headers: { ...getAuthHeader() }
      });
      if (response.ok) {
        return await response.json();
      }
      throw new Error('Could not fetch memories from backend');
    } catch (err) {
      let memories = JSON.parse(localStorage.getItem(MEMORIES_STORE_KEY) || '[]');
      
      if (filters.search) {
        const term = filters.search.toLowerCase();
        memories = memories.filter(m => 
          m.title.toLowerCase().includes(term) || 
          m.description.toLowerCase().includes(term)
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
   * Create New Memory
   * @param {Object} memoryData - { title, description, date, imageUrl, category, tags }
   */
  async createMemory(memoryData) {
    try {
      const response = await fetch(`${API_BASE_URL}/memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(memoryData)
      });
      if (response.ok) {
        return await response.json();
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

  /**
   * Update Memory
   * @param {string} id 
   * @param {Object} updateData 
   */
  async updateMemory(id, updateData) {
    try {
      const response = await fetch(`${API_BASE_URL}/memories/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(updateData)
      });
      if (response.ok) {
        return await response.json();
      }
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

  /**
   * Delete Memory
   * @param {string} id 
   */
  async deleteMemory(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/memories/${id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeader() }
      });
      if (response.ok) {
        return await response.json();
      }
      throw new Error('Delete failed');
    } catch (err) {
      let memories = JSON.parse(localStorage.getItem(MEMORIES_STORE_KEY) || '[]');
      memories = memories.filter(m => m.id !== id);
      localStorage.setItem(MEMORIES_STORE_KEY, JSON.stringify(memories));
      return { success: true, id };
    }
  },

  /**
   * Generate Multilingual AI Notes
   * @param {Object} params - { topic, language, interest, difficulty, style, customInterest }
   */
  async generateNotes(params) {
    try {
      const response = await fetch(`${API_BASE_URL}/ai/generate-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(params)
      });
      if (response.ok) {
        return await response.json();
      }
      throw new Error('Backend AI generation offline');
    } catch (err) {
      // Simulate high quality, contextual multilingual AI generation response
      const lang = params.language || 'English';
      const topic = params.topic || 'General Topic';
      const interest = params.interest === 'Custom' ? params.customInterest : params.interest;
      const difficulty = params.difficulty || 'Intermediate';
      const style = params.style || 'Detailed';

      // Language greeting / label adaptations
      const langGreetings = {
        'English': { tag: 'English', note: 'AI Knowledge Synthesis' },
        'Telugu': { tag: 'తెలుగు (Telugu)', note: 'విజ్ఞాన సంగ్రహం మరియు ముఖ్య అంశాలు' },
        'Hindi': { tag: 'हिन्दी (Hindi)', note: 'कृत्रिम बुद्धिमत्ता आधारित विस्तृत नोट्स' },
        'Gujarati': { tag: 'ગુજરાતી (Gujarati)', note: 'AI સંક્ષિપ્ત જ્ઞાન અને વિશ્લેષણ' },
        'Marathi': { tag: 'मराठी (Marathi)', note: 'सर्वसमावेशक ज्ञान आणि संकल्पना' },
        'Kannada': { tag: 'ಕನ್ನಡ (Kannada)', note: 'ಕಲಿಕೆಯ ಪ್ರಮುಖ ಅಂಶಗಳು ಮತ್ತು ವಿವರಣೆ' },
        'Tamil': { tag: 'தமிழ் (Tamil)', note: 'விரிவான குறிப்புகள் மற்றும் முக்கிய கருத்துக்கள்' },
        'Malayalam': { tag: 'മലയാളം (Malayalam)', note: 'പഠന കുറിപ്പുകളും പ്രധാന ആശയങ്ങളും' },
        'Bengali': { tag: 'বাংলা (Bengali)', note: 'বিস্তারিত নোট ও গুরুত্বপূর্ণ বিষয়বস্তু' },
        'Punjabi': { tag: 'ਪੰਜਾਬੀ (Punjabi)', note: 'ਵਿਆਖਿਆ ਅਤੇ ਜ਼ਰੂਰੀ ਨੁਕਤੇ' }
      };

      const meta = langGreetings[lang] || langGreetings['English'];

      return {
        id: 'note_' + Date.now(),
        topic: topic,
        language: lang,
        interest: interest,
        difficulty: difficulty,
        style: style,
        timestamp: new Date().toISOString(),
        summary: `Structured AI learning guide exploring "${topic}" customized for ${interest} learners at a ${difficulty} level with a ${style.toLowerCase()} approach.`,
        sections: [
          {
            title: '1. Executive Overview & Mental Model',
            content: `The foundation of **${topic}** revolves around breaking down core dynamics into intuitive units. When applied to **${interest}**, it provides a structured mental framework that clarifies complex dependencies and simplifies execution.`
          },
          {
            title: '2. Core Principles & Architecture',
            content: `Key mechanics to master include:\n- **First Principles Foundation:** Establishing baseline truth rather than reasoning by analogy.\n- **Adaptive Feedback Loops:** Continual refinement based on ${interest}-oriented outcomes.\n- **Systemic Scalability:** Ensuring techniques remain effective as problem complexity expands from ${difficulty} to mastery.`
          },
          {
            title: `3. Practical Analogy & Application (${interest} Context)`,
            content: `Imagine practicing a performance in ${interest}: isolated repetition builds muscle memory, but integrative rehearsal harmonizes the overall flow. Similarly, with **${topic}**, combining individual mechanics yields coherent mastery.`
          },
          {
            title: '4. Critical Takeaways & Exam/Interview Checklist',
            content: `✓ Precision in vocabulary and baseline definitions.\n✓ Clear understanding of trade-offs and edge cases.\n✓ Actionable strategy for real-world deployment or academic review.`
          }
        ],
        multilingualSpotlight: {
          languageName: meta.tag,
          translatedSummary: meta.note + `: "${topic}" సంక్షిప్త విశ్లేషణ మరియు ముఖ్య సమాచారం అందుబాటులో ఉంది.`
        }
      };
    }
  },

  /**
   * Get Documents from Digital Locker
   * @param {Object} filters - { category, search }
   */
  async getDocuments(filters = {}) {
    try {
      const query = new URLSearchParams(filters).toString();
      const response = await fetch(`${API_BASE_URL}/locker/documents?${query}`, {
        headers: { ...getAuthHeader() }
      });
      if (response.ok) {
        return await response.json();
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
   * Upload Document to Digital Locker
   * @param {Object} docData - { title, category, file, fileName, fileSize, fileType }
   */
  async uploadDocument(docData) {
    try {
      // In a real backend this sends a multipart/form-data request
      const formData = new FormData();
      formData.append('title', docData.title);
      formData.append('category', docData.category);
      if (docData.file) {
        formData.append('file', docData.file);
      }

      const response = await fetch(`${API_BASE_URL}/locker/documents`, {
        method: 'POST',
        headers: { ...getAuthHeader() },
        body: formData
      });
      if (response.ok) {
        return await response.json();
      }
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
   * Delete Document from Digital Locker
   * @param {string} id 
   */
  async deleteDocument(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/locker/documents/${id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeader() }
      });
      if (response.ok) {
        return await response.json();
      }
      throw new Error('Delete failed');
    } catch (err) {
      let docs = JSON.parse(localStorage.getItem(DOCUMENTS_STORE_KEY) || '[]');
      docs = docs.filter(d => d.id !== id);
      localStorage.setItem(DOCUMENTS_STORE_KEY, JSON.stringify(docs));
      return { success: true, id };
    }
  }
};

// Export to window
window.API = API;
