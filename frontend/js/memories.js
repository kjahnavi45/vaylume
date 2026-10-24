/**
 * ==========================================================================
 * VAYLUME - Memories Controller (memories.js)
 * ==========================================================================
 * Features:
 * - Card view for memories with photo, title, description, and date badge
 * - Full photo preview / Lightbox modal
 * - Add new memory with live photo dropzone / base64 preview
 * - Edit memory modal
 * - Delete memory with instant UI update
 * - Keyword search, category filtering & sorting
 */

let allMemories = [];
let currentFilter = 'all';
let currentSort = 'newest';
let currentSearch = '';
let activeImageBase64 = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadMemories();
  initMemorySearchAndFilter();
  initAddMemoryModal();
  initEditMemoryModal();
  initDropzone();
});

/**
 * Load memories from API service
 */
async function loadMemories() {
  const container = document.getElementById('memories-grid');
  if (!container) return;

  container.innerHTML = `
    <div class="skeleton-card skeleton" style="border-radius: var(--radius-lg); height: 320px;"></div>
    <div class="skeleton-card skeleton" style="border-radius: var(--radius-lg); height: 320px;"></div>
    <div class="skeleton-card skeleton" style="border-radius: var(--radius-lg); height: 320px;"></div>
  `;

  try {
    allMemories = await window.API.getMemories();
    renderMemoriesGrid();
  } catch (err) {
    console.error('Failed to load memories:', err);
    container.innerHTML = `<div class="empty-state"><p>Could not load memories.</p></div>`;
  }
}

/**
 * Render filtered and sorted memories cards
 */
function renderMemoriesGrid() {
  const container = document.getElementById('memories-grid');
  const countBadge = document.getElementById('memories-count-badge');
  if (!container) return;

  let filtered = [...allMemories];

  // Search filter
  if (currentSearch) {
    const term = currentSearch.toLowerCase();
    filtered = filtered.filter(m => 
      m.title.toLowerCase().includes(term) || 
      (m.description && m.description.toLowerCase().includes(term))
    );
  }

  // Category filter
  if (currentFilter !== 'all') {
    filtered = filtered.filter(m => (m.category || '').toLowerCase() === currentFilter.toLowerCase());
  }

  // Sort
  if (currentSort === 'oldest') {
    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
  } else {
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  if (countBadge) {
    countBadge.textContent = `${filtered.length} ${filtered.length === 1 ? 'Memory' : 'Memories'}`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">📸</div>
        <h3 class="empty-state-title">No memories found</h3>
        <p class="empty-state-desc">Capture your precious moments, thoughts, and milestones securely in your private VAYLUME vault.</p>
        <button class="btn btn-primary" onclick="window.openModal('add-memory-modal')">
          + Add First Memory
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(memory => `
    <article class="memory-card card" data-id="${memory.id}">
      <div class="memory-image-container">
        <img src="${memory.imageUrl}" alt="${window.escapeHtml(memory.title)}" class="memory-img" loading="lazy">
        <div class="memory-badge-overlay">
          <span class="badge badge-cyan">${window.escapeHtml(memory.category || 'General')}</span>
        </div>
      </div>
      <div class="memory-card-body">
        <div class="memory-date-row">
          <span class="memory-date">📅 ${formatDate(memory.date)}</span>
          ${memory.isFavorite ? '<span class="favorite-star" title="Favorited">★</span>' : ''}
        </div>
        <h3 class="memory-title">${window.escapeHtml(memory.title)}</h3>
        <p class="memory-description">${window.escapeHtml(memory.description || '')}</p>
        
        ${memory.tags && memory.tags.length > 0 ? `
          <div class="memory-tags-list">
            ${memory.tags.map(tag => `<span class="tag-pill">#${window.escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}

        <div class="memory-actions-row">
          <button class="btn btn-sm btn-secondary btn-view-memory" data-id="${memory.id}">
            🔍 View
          </button>
          <button class="btn btn-sm btn-outline btn-edit-memory" data-id="${memory.id}">
            ✏️ Edit
          </button>
          <button class="btn btn-sm btn-danger btn-delete-memory" data-id="${memory.id}">
            🗑️ Delete
          </button>
        </div>
      </div>
    </article>
  `).join('');

  bindCardActionEvents();
}

/**
 * Format ISO or YYYY-MM-DD Date
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Unspecified Date';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Bind click listeners for View, Edit, Delete
 */
function bindCardActionEvents() {
  // View Memory Lightbox
  document.querySelectorAll('.btn-view-memory').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const memory = allMemories.find(m => m.id === id);
      if (memory) openViewMemoryModal(memory);
    });
  });

  // Edit Memory
  document.querySelectorAll('.btn-edit-memory').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const memory = allMemories.find(m => m.id === id);
      if (memory) openEditMemoryModal(memory);
    });
  });

  // Delete Memory
  document.querySelectorAll('.btn-delete-memory').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const memory = allMemories.find(m => m.id === id);
      if (confirm(`Are you sure you want to delete "${memory ? memory.title : 'this memory'}"?`)) {
        await window.API.deleteMemory(id);
        allMemories = allMemories.filter(m => m.id !== id);
        renderMemoriesGrid();
        window.showToast('Memory securely deleted.', 'info');
      }
    });
  });
}

/**
 * View Lightbox Modal
 */
function openViewMemoryModal(memory) {
  const modal = document.getElementById('view-memory-modal');
  if (!modal) return;

  document.getElementById('view-memory-img').src = memory.imageUrl;
  document.getElementById('view-memory-title').textContent = memory.title;
  document.getElementById('view-memory-date').textContent = formatDate(memory.date);
  document.getElementById('view-memory-category').textContent = memory.category || 'General';
  document.getElementById('view-memory-desc').textContent = memory.description || 'No description provided.';

  window.openModal('view-memory-modal');
}

/**
 * Add Memory Modal & Dropzone Handler
 */
function initDropzone() {
  const dropzone = document.getElementById('memory-dropzone');
  const fileInput = document.getElementById('memory-photo-file');
  const previewContainer = document.getElementById('memory-preview-container');
  const previewImg = document.getElementById('memory-preview-img');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) handleImageSelection(files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) handleImageSelection(fileInput.files[0]);
  });

  function handleImageSelection(file) {
    if (!file.type.startsWith('image/')) {
      window.showToast('Please upload a valid image file (PNG, JPG, WebP)', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      activeImageBase64 = e.target.result;
      if (previewImg && previewContainer) {
        previewImg.src = activeImageBase64;
        previewContainer.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  }
}

function initAddMemoryModal() {
  const form = document.getElementById('add-memory-form');
  if (!form) return;

  // Set default today's date
  const dateInput = document.getElementById('memory-date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('memory-title').value.trim();
    const description = document.getElementById('memory-description').value.trim();
    const date = document.getElementById('memory-date').value;
    const category = document.getElementById('memory-category').value || 'Personal';
    const tagsInput = document.getElementById('memory-tags').value;

    if (!title) {
      window.showToast('Memory title is required.', 'error');
      return;
    }

    const tags = tagsInput
      ? tagsInput.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean)
      : [];

    const defaultImages = [
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80'
    ];
    const chosenImage = activeImageBase64 || defaultImages[Math.floor(Math.random() * defaultImages.length)];

    const newMem = await window.API.createMemory({
      title,
      description,
      date,
      category,
      tags,
      imageUrl: chosenImage
    });

    allMemories.unshift(newMem);
    renderMemoriesGrid();
    window.closeModal('add-memory-modal');
    form.reset();
    activeImageBase64 = null;
    const previewContainer = document.getElementById('memory-preview-container');
    if (previewContainer) previewContainer.style.display = 'none';

    window.showToast('Memory encrypted and saved securely!', 'success');
  });
}

/**
 * Edit Memory Modal
 */
let editingMemoryId = null;

function openEditMemoryModal(memory) {
  editingMemoryId = memory.id;
  document.getElementById('edit-memory-title').value = memory.title;
  document.getElementById('edit-memory-description').value = memory.description || '';
  document.getElementById('edit-memory-date').value = memory.date || '';
  document.getElementById('edit-memory-category').value = memory.category || 'General';
  document.getElementById('edit-memory-tags').value = (memory.tags || []).join(', ');

  window.openModal('edit-memory-modal');
}

function initEditMemoryModal() {
  const form = document.getElementById('edit-memory-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editingMemoryId) return;

    const title = document.getElementById('edit-memory-title').value.trim();
    const description = document.getElementById('edit-memory-description').value.trim();
    const date = document.getElementById('edit-memory-date').value;
    const category = document.getElementById('edit-memory-category').value;
    const tagsInput = document.getElementById('edit-memory-tags').value;

    const tags = tagsInput
      ? tagsInput.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean)
      : [];

    const updated = await window.API.updateMemory(editingMemoryId, {
      title,
      description,
      date,
      category,
      tags
    });

    const index = allMemories.findIndex(m => m.id === editingMemoryId);
    if (index !== -1) allMemories[index] = updated;

    renderMemoriesGrid();
    window.closeModal('edit-memory-modal');
    window.showToast('Memory updated successfully.', 'success');
  });
}

/**
 * Search & Category Filtering
 */
function initMemorySearchAndFilter() {
  const searchInput = document.getElementById('memory-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim();
      renderMemoriesGrid();
    });
  }

  const sortSelect = document.getElementById('memory-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderMemoriesGrid();
    });
  }

  // Filter chips
  document.querySelectorAll('.memory-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.memory-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.category || 'all';
      renderMemoriesGrid();
    });
  });
}
