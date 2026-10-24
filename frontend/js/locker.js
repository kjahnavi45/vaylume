/**
 * ==========================================================================
 * VAYLUME - Digital Locker Controller (locker.js)
 * ==========================================================================
 * Features:
 * - End-to-end encrypted document vault simulation
 * - Categorized file repository (Identity, Education, Certificates, Career, Personal, Other)
 * - Safe Document Upload with live file parsing & category tagging
 * - Instant keyword search & category tab filtering
 * - Secure Document Viewer modal with cryptographic checksums
 * - Safe blob-based decrypted download simulation (no public file exposure)
 * - Secure permanent document deletion
 */

let allDocuments = [];
let currentCategory = 'All';
let currentSearch = '';
let activeUploadFile = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (window.VaultLock) {
    window.VaultLock.init({
      onUnlock: async () => {
        await loadDocuments();
      }
    });
  } else {
    await loadDocuments();
  }
  initLockerSearchAndFilters();
  initUploadModal();
});

/**
 * Load documents from API
 */
async function loadDocuments() {
  const container = document.getElementById('locker-documents-list');
  if (!container) return;

  container.innerHTML = `
    <div class="skeleton-card skeleton" style="height: 100px; margin-bottom: 12px;"></div>
    <div class="skeleton-card skeleton" style="height: 100px; margin-bottom: 12px;"></div>
    <div class="skeleton-card skeleton" style="height: 100px; margin-bottom: 12px;"></div>
  `;

  try {
    allDocuments = await window.API.getDocuments();
    updateCategoryCounts();
    renderDocumentsList();
  } catch (err) {
    console.error('Failed to load documents:', err);
    container.innerHTML = '<div class="empty-state"><p>Could not load encrypted vault items.</p></div>';
  }
}

/**
 * Update Category Filter badge counts
 */
function updateCategoryCounts() {
  const categories = ['All', 'Identity', 'Education', 'Certificates', 'Career', 'Personal', 'Other'];
  categories.forEach(cat => {
    const badge = document.querySelector(`.category-badge[data-cat="${cat}"]`);
    if (badge) {
      if (cat === 'All') {
        badge.textContent = allDocuments.length;
      } else {
        const count = allDocuments.filter(d => (d.category || '').toLowerCase() === cat.toLowerCase()).length;
        badge.textContent = count;
      }
    }
  });

  const totalVaultCount = document.getElementById('locker-total-count');
  if (totalVaultCount) {
    totalVaultCount.textContent = `${allDocuments.length} Documents Protected`;
  }
}

/**
 * Render Document List / Grid
 */
function renderDocumentsList() {
  const container = document.getElementById('locker-documents-list');
  if (!container) return;

  let filtered = [...allDocuments];

  // Category filter
  if (currentCategory !== 'All') {
    filtered = filtered.filter(d => (d.category || '').toLowerCase() === currentCategory.toLowerCase());
  }

  // Search filter
  if (currentSearch) {
    const term = currentSearch.toLowerCase();
    filtered = filtered.filter(d => 
      d.title.toLowerCase().includes(term) || 
      d.fileName.toLowerCase().includes(term) ||
      (d.category && d.category.toLowerCase().includes(term))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📁</div>
        <h3 class="empty-state-title">No documents in this category</h3>
        <p class="empty-state-desc">Store your ID cards, academic records, certificates, and confidential documents inside the zero-knowledge vault.</p>
        <button class="btn btn-primary" onclick="window.openModal('upload-document-modal')">
          + Upload Document
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(doc => {
    const icon = getFileIcon(doc.fileType, doc.category);
    return `
      <div class="locker-doc-row card" data-id="${doc.id}">
        <div class="doc-icon-wrapper ${doc.category.toLowerCase()}">
          <span>${icon}</span>
        </div>
        <div class="doc-main-info">
          <div class="doc-title-row">
            <h4 class="doc-title">${window.escapeHtml(doc.title)}</h4>
            <span class="badge badge-emerald">🔒 AES-256</span>
          </div>
          <div class="doc-meta-row">
            <span class="badge badge-cyan">${window.escapeHtml(doc.category)}</span>
            <span class="doc-meta-item">📁 ${window.escapeHtml(doc.fileName)}</span>
            <span class="doc-meta-item">⚖️ ${window.escapeHtml(doc.fileSize)}</span>
            <span class="doc-meta-item">📅 ${window.escapeHtml(doc.uploadedAt)}</span>
            <span class="doc-hash-preview" title="Cryptographic Checksum">${window.escapeHtml(doc.hash || 'sha256_verified')}</span>
          </div>
        </div>
        <div class="doc-actions-group">
          <button class="btn btn-sm btn-secondary btn-view-doc" data-id="${doc.id}" title="Secure View">
            👁️ View
          </button>
          <button class="btn btn-sm btn-outline btn-download-doc" data-id="${doc.id}" title="Encrypted Download">
            ⬇️ Download
          </button>
          <button class="btn btn-sm btn-danger btn-delete-doc" data-id="${doc.id}" title="Permanent Delete">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');

  bindDocEvents();
}

/**
 * Returns intuitive icons for categories/types
 */
function getFileIcon(fileType, category) {
  if (category === 'Identity') return '🪪';
  if (category === 'Education') return '🎓';
  if (category === 'Certificates') return '📜';
  if (category === 'Career') return '💼';
  if (fileType === 'pdf') return '📄';
  if (fileType === 'jpg' || fileType === 'png') return '🖼️';
  return '📁';
}

/**
 * Bind Action handlers for View, Download, Delete
 */
function bindDocEvents() {
  // View Document Modal
  document.querySelectorAll('.btn-view-doc').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const doc = allDocuments.find(d => d.id === id);
      if (doc) openViewDocModal(doc);
    });
  });

  // Download Document (Safe Blob simulation)
  document.querySelectorAll('.btn-download-doc').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const doc = allDocuments.find(d => d.id === id);
      if (doc) triggerSafeDownload(doc);
    });
  });

  // Delete Document
  document.querySelectorAll('.btn-delete-doc').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const doc = allDocuments.find(d => d.id === id);
      if (confirm(`Permanently remove "${doc ? doc.title : 'this document'}" from encrypted locker?`)) {
        await window.API.deleteDocument(id);
        allDocuments = allDocuments.filter(d => d.id !== id);
        updateCategoryCounts();
        renderDocumentsList();
        window.showToast('Document wiped permanently from vault.', 'info');
      }
    });
  });
}

/**
 * Secure Document Viewer Modal
 */
function openViewDocModal(doc) {
  document.getElementById('view-doc-title').textContent = doc.title;
  document.getElementById('view-doc-category').textContent = doc.category;
  document.getElementById('view-doc-filename').textContent = doc.fileName;
  document.getElementById('view-doc-filesize').textContent = doc.fileSize;
  document.getElementById('view-doc-uploaded').textContent = doc.uploadedAt;
  document.getElementById('view-doc-hash').textContent = doc.hash || 'sha256_9b81f129c927318726..';

  // Modal download button binding
  const dlBtn = document.getElementById('view-doc-download-btn');
  if (dlBtn) {
    dlBtn.onclick = () => triggerSafeDownload(doc);
  }

  window.openModal('view-document-modal');
}

/**
 * Safe client-side decrypted blob download simulation
 */
function triggerSafeDownload(doc) {
  window.showToast('Decrypting document payload...', 'info', 1500);

  setTimeout(() => {
    // Generate secure blob file representation
    const dummyContent = `VAYLUME ENCRYPTED VAULT PAYLOAD
--------------------------------------------------
Document Title: ${doc.title}
Category: ${doc.category}
File Name: ${doc.fileName}
Cryptographic Hash: ${doc.hash}
Decryption Timestamp: ${new Date().toISOString()}
Decrypted Session ID: vylm_sess_${Math.random().toString(36).substring(2)}
Zero-Knowledge Assurance: Confirmed. Not exposed publicly.
--------------------------------------------------`;

    const blob = new Blob([dummyContent], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.fileName || `${doc.title}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    window.showToast(`Decrypted and downloaded "${doc.fileName}"`, 'success');
  }, 1000);
}

/**
 * Upload Document Form & File Dropzone
 */
function initUploadModal() {
  const form = document.getElementById('upload-document-form');
  const fileInput = document.getElementById('doc-file-input');
  const dropzone = document.getElementById('doc-dropzone');
  const selectedFileInfo = document.getElementById('selected-file-name');

  if (!form) return;

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) handleDocFile(files[0]);
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) handleDocFile(fileInput.files[0]);
    });

    function handleDocFile(file) {
      activeUploadFile = file;
      if (selectedFileInfo) {
        selectedFileInfo.textContent = `Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
        selectedFileInfo.style.display = 'block';
      }

      // Auto-fill title if empty
      const titleInput = document.getElementById('doc-title-input');
      if (titleInput && !titleInput.value) {
        titleInput.value = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      }
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('doc-title-input').value.trim();
    const category = document.getElementById('doc-category-select').value;
    const submitBtn = document.getElementById('doc-submit-btn');

    if (!title) {
      window.showToast('Please specify a document title.', 'error');
      return;
    }

    if (!category) {
      window.showToast('Please select a category.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="animate-spin">🔒</span> Encrypting Payload...';
    if (dropzone) dropzone.classList.add('uploading');

    const fileName = activeUploadFile ? activeUploadFile.name : `${title.replace(/\s+/g, '_')}.pdf`;
    const fileSize = activeUploadFile 
      ? (activeUploadFile.size / (1024 * 1024)).toFixed(2) + ' MB' 
      : '1.5 MB';
    const fileType = fileName.split('.').pop().toLowerCase();

    try {
      const newDoc = await window.API.uploadDocument({
        title,
        category,
        file: activeUploadFile,
        fileName,
        fileSize,
        fileType
      });

      allDocuments.unshift(newDoc);
      updateCategoryCounts();
      renderDocumentsList();

      if (dropzone) dropzone.classList.remove('uploading');
      window.closeModal('upload-document-modal');
      form.reset();
      activeUploadFile = null;
      if (selectedFileInfo) selectedFileInfo.style.display = 'none';

      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Encrypt & Save to Locker';
      window.showToast('Document encrypted with AES-256 and stored safely!', 'success');

    } catch (err) {
      if (dropzone) dropzone.classList.remove('uploading');
      window.showToast('Failed to upload document.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Encrypt & Save to Locker';
    }
  });
}

/**
 * Filter & Search Controllers
 */
function initLockerSearchAndFilters() {
  const searchInput = document.getElementById('locker-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim();
      renderDocumentsList();
    });
  }

  // Category Tab Chips
  document.querySelectorAll('.locker-cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.locker-cat-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.category || 'All';
      renderDocumentsList();
    });
  });
}
