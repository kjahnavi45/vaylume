/**
 * ==========================================================================
 * VAYLUME - Dashboard Controller (dashboard.js)
 * ==========================================================================
 * Manages stats aggregation, recent activity timeline, time-of-day greeting,
 * and quick action modal triggers directly from the dashboard view.
 */

document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboardData();
  initDashboardQuickActions();
});

/**
 * Load and render all live dashboard statistics and recent activities
 */
async function loadDashboardData() {
  try {
    // 1. Get user profile
    const profile = await window.API.getProfile();
    renderUserGreeting(profile);

    // 2. Fetch Memories
    const memories = await window.API.getMemories();
    const memoriesCountEl = document.getElementById('stat-memories-count');
    if (memoriesCountEl) memoriesCountEl.textContent = memories.length;

    // 3. Fetch Documents
    const docs = await window.API.getDocuments();
    const docsCountEl = document.getElementById('stat-docs-count');
    if (docsCountEl) docsCountEl.textContent = docs.length;

    // 4. Calculate Storage used
    const storageUsedEl = document.getElementById('stat-storage-used');
    const storageProgressEl = document.getElementById('dashboard-storage-bar');
    if (storageUsedEl) {
      const used = profile.storageUsedMB || 142;
      const limit = profile.storageLimitMB || 5120;
      storageUsedEl.textContent = `${used} MB / ${(limit / 1024).toFixed(0)} GB`;
      if (storageProgressEl) {
        const percent = Math.min(100, Math.round((used / limit) * 100));
        storageProgressEl.style.width = `${percent}%`;
      }
    }

    // 5. Notes Count from local history or default
    const savedNotes = JSON.parse(localStorage.getItem('vaylume_saved_notes') || '[]');
    const notesCountEl = document.getElementById('stat-notes-count');
    if (notesCountEl) notesCountEl.textContent = Math.max(3, savedNotes.length);

    // 6. Render Recent Activity Stream
    renderRecentActivity(memories, docs, savedNotes);

  } catch (err) {
    console.error('Error loading dashboard data:', err);
    window.showToast('Could not sync latest activity', 'info');
  }
}

/**
 * Display Personalized Time-of-Day Greeting
 */
function renderUserGreeting(profile) {
  const greetingEl = document.getElementById('dashboard-greeting-title');
  if (!greetingEl) return;

  const hour = new Date().getHours();
  let timeOfDay = 'Good day';
  if (hour < 12) timeOfDay = 'Good morning';
  else if (hour < 18) timeOfDay = 'Good afternoon';
  else timeOfDay = 'Good evening';

  const name = profile.fullName ? profile.fullName.split(' ')[0] : 'Explorer';
  greetingEl.innerHTML = `${timeOfDay}, <span class="text-gradient">${name}</span>`;

  const dateSub = document.getElementById('dashboard-date-subtitle');
  if (dateSub) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateSub.textContent = new Date().toLocaleDateString(undefined, options);
  }
}

/**
 * Render recent activity list dynamically
 */
function renderRecentActivity(memories, docs, notes) {
  const activityContainer = document.getElementById('recent-activity-list');
  if (!activityContainer) return;

  const activities = [];

  // Add memory activities
  memories.slice(0, 2).forEach(m => {
    activities.push({
      type: 'memory',
      icon: '📸',
      badgeClass: 'badge-cyan',
      badgeText: 'Memory Added',
      title: m.title,
      date: m.date || 'Recent',
      link: 'memories.html'
    });
  });

  // Add doc activities
  docs.slice(0, 2).forEach(d => {
    activities.push({
      type: 'document',
      icon: '🔐',
      badgeClass: 'badge-emerald',
      badgeText: 'Encrypted Doc',
      title: `${d.title} (${d.category})`,
      date: d.uploadedAt || 'Recent',
      link: 'locker.html'
    });
  });

  // Add AI notes
  activities.push({
    type: 'note',
    icon: '🤖',
    badgeClass: 'badge-violet',
    badgeText: 'AI Note Generated',
    title: notes.length > 0 ? notes[0].topic : 'Machine Learning Systems & Architecture',
    date: 'Today',
    link: 'notes.html'
  });

  activityContainer.innerHTML = activities.map(act => `
    <div class="activity-item">
      <div class="activity-icon-bubble">
        <span>${act.icon}</span>
      </div>
      <div class="activity-details">
        <div class="activity-header">
          <span class="badge ${act.badgeClass}">${act.badgeText}</span>
          <span class="activity-time">${act.date}</span>
        </div>
        <h4 class="activity-title">${act.title}</h4>
      </div>
      <a href="${act.link}" class="btn btn-sm btn-outline" style="margin-left: auto;">View</a>
    </div>
  `).join('');
}

/**
 * Wire Quick Action Modals on Dashboard
 */
function initDashboardQuickActions() {
  // Add Memory Modal quick form
  const memoryForm = document.getElementById('quick-add-memory-form');
  if (memoryForm) {
    memoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('quick-memory-title').value.trim();
      const desc = document.getElementById('quick-memory-desc').value.trim();
      const date = document.getElementById('quick-memory-date').value;

      if (!title) {
        window.showToast('Please enter a memory title', 'error');
        return;
      }

      await window.API.createMemory({
        title,
        description: desc,
        date: date || new Date().toISOString().split('T')[0],
        category: 'Personal'
      });

      window.closeModal('quick-add-memory-modal');
      window.showToast('Memory added securely!', 'success');
      memoryForm.reset();
      loadDashboardData();
    });
  }

  // Quick Upload Document Modal
  const docForm = document.getElementById('quick-upload-doc-form');
  if (docForm) {
    docForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('quick-doc-title').value.trim();
      const category = document.getElementById('quick-doc-category').value;
      const fileInput = document.getElementById('quick-doc-file');

      if (!title) {
        window.showToast('Please enter document title', 'error');
        return;
      }

      const file = fileInput.files ? fileInput.files[0] : null;
      const fileName = file ? file.name : (title.replace(/\s+/g, '_') + '.pdf');
      const fileSize = file ? (file.size / (1024 * 1024)).toFixed(1) + ' MB' : '1.2 MB';

      await window.API.uploadDocument({
        title,
        category: category || 'Personal',
        fileName,
        fileSize
      });

      window.closeModal('quick-upload-doc-modal');
      window.showToast('Document encrypted and stored in Digital Locker!', 'success');
      docForm.reset();
      loadDashboardData();
    });
  }
}
