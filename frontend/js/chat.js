/**
 * ==========================================================================
 * VAYLUME - Private 1-on-1 User-to-User Chat Controller (chat.js)
 * ==========================================================================
 * Features:
 * - Real-time private 1-on-1 messaging
 * - Conversation management (start chat by email or user ID, delete thread)
 * - Message status indicators (sent, delivered, read) & timestamps
 * - Transparent security disclosure (TLS in-transit encryption + server-authorized isolation)
 * - User blocking & moderation protection
 */

let allConversations = [];
let activeConversation = null;
let activeMessages = [];
let currentUser = null;
let chatPollingInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = JSON.parse(localStorage.getItem('vaylume_user_profile') || 'null');
  if (!currentUser) {
    try {
      currentUser = await window.API.getProfile();
    } catch (e) {
      currentUser = { id: 'usr_01', email: 'aarav.sharma@example.com', fullName: 'Aarav Sharma' };
    }
  }

  initNewChatModal();
  initSendForm();
  initChatActions();
  initChatSearch();

  await loadConversations();

  // Periodic poll for incoming messages every 5 seconds
  chatPollingInterval = setInterval(() => {
    if (activeConversation && !document.hidden) {
      refreshActiveMessages(false);
    }
  }, 5000);
});

window.addEventListener('beforeunload', () => {
  if (chatPollingInterval) clearInterval(chatPollingInterval);
});

/**
 * Load all user conversations from API
 */
async function loadConversations() {
  const container = document.getElementById('chat-conversations-list');
  const countBadge = document.getElementById('chat-conv-count');

  try {
    allConversations = await window.API.getConversations();

    if (countBadge) {
      countBadge.textContent = `${allConversations.length} active`;
    }

    renderConversationsList(allConversations);

    // If an active conversation was previously selected, re-select it
    if (activeConversation) {
      const stillExists = allConversations.find(c => c.id === activeConversation.id);
      if (stillExists) {
        selectConversation(stillExists, false);
      }
    }
  } catch (err) {
    console.warn('[VAYLUME Chat] Failed to load conversations:', err.message);
    if (container) {
      container.innerHTML = '<div class="empty-state" style="padding: 24px;"><p style="font-size: 0.8rem; color: var(--text-muted);">Could not load chats. Try starting a new conversation.</p></div>';
    }
  }
}

/**
 * Render the conversations list in the left pane
 */
function renderConversationsList(conversations) {
  const container = document.getElementById('chat-conversations-list');
  if (!container) return;

  if (!conversations || conversations.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 40px 16px; text-align: center;">
        <div style="font-size: 2rem; margin-bottom: 8px;">📭</div>
        <p style="font-size: 0.85rem; color: var(--text-muted);">No conversations yet.</p>
        <button type="button" class="btn btn-primary btn-sm" onclick="document.getElementById('btn-start-chat').click()" style="margin-top: 8px;">
          Start New Chat
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = conversations.map(c => {
    const isCurrentActive = activeConversation && activeConversation.id === c.id;
    const displayName = c.other_user_name || c.other_user_email || 'Contact';
    const initials = displayName.substring(0, 2).toUpperCase();
    const lastMsg = c.last_message ? c.last_message.content : 'No messages yet';
    const unread = c.unread_count || 0;

    return `
      <div class="chat-conv-item ${isCurrentActive ? 'active' : ''}" data-conv-id="${c.id}">
        <div class="chat-conv-avatar">${escapeHtml(initials)}</div>
        <div class="chat-conv-info">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="chat-conv-name">${escapeHtml(displayName)}</div>
            ${c.last_message ? `<span style="font-size: 0.7rem; color: var(--text-muted);">${formatTime(c.last_message.created_at)}</span>` : ''}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
            <div class="chat-conv-preview">${escapeHtml(lastMsg)}</div>
            ${unread > 0 ? `<span class="chat-conv-badge">${unread}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Bind click handlers
  container.querySelectorAll('.chat-conv-item').forEach(itemEl => {
    itemEl.addEventListener('click', () => {
      const convId = itemEl.dataset.convId;
      const target = allConversations.find(c => c.id === convId);
      if (target) {
        selectConversation(target, true);
      }
    });
  });
}

/**
 * Select a conversation and load its messages
 */
async function selectConversation(conv, shouldScroll = true) {
  activeConversation = conv;

  // Highlight active in list
  document.querySelectorAll('.chat-conv-item').forEach(el => {
    el.classList.toggle('active', el.dataset.convId === conv.id);
  });

  // Switch right pane view
  const emptyState = document.getElementById('chat-empty-thread-state');
  const activeThread = document.getElementById('chat-active-thread');
  if (emptyState) emptyState.style.display = 'none';
  if (activeThread) activeThread.style.display = 'flex';

  // Update header info
  const displayName = conv.other_user_name || conv.other_user_email || 'Contact';
  const nameEl = document.getElementById('active-chat-name');
  const avatarEl = document.getElementById('active-chat-avatar');

  if (nameEl) nameEl.textContent = displayName;
  if (avatarEl) avatarEl.textContent = displayName.substring(0, 2).toUpperCase();

  await refreshActiveMessages(shouldScroll);

  const input = document.getElementById('chat-message-input');
  if (input) input.focus();
}

/**
 * Refresh messages for active conversation
 */
async function refreshActiveMessages(scrollDown = false) {
  if (!activeConversation) return;

  const messagesScroll = document.getElementById('chat-messages-scroll');
  if (!messagesScroll) return;

  try {
    const msgs = await window.API.getMessages(activeConversation.id);
    activeMessages = msgs;

    if (msgs.length === 0) {
      messagesScroll.innerHTML = `
        <div style="margin: auto; text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 40px 16px;">
          <div>👋</div>
          <p style="margin-top: 8px;">No messages exchanged yet. Say hello to begin your private conversation!</p>
        </div>
      `;
      return;
    }

    const currentUserId = currentUser ? String(currentUser.id) : '';

    messagesScroll.innerHTML = msgs.map(m => {
      const isOutgoing = String(m.sender_id) === currentUserId;
      const statusIcon = isOutgoing ? (m.status === 'read' ? '✓✓' : (m.status === 'delivered' ? '✓✓' : '✓')) : '';

      return `
        <div class="chat-message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}">
          <div>${escapeHtml(m.content)}</div>
          <div class="chat-message-meta">
            <span>${formatTime(m.created_at)}</span>
            ${isOutgoing ? `<span title="${m.status || 'sent'}" style="margin-left: 2px;">${statusIcon}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    if (scrollDown) {
      messagesScroll.scrollTop = messagesScroll.scrollHeight;
    }
  } catch (err) {
    console.warn('[VAYLUME Chat] Failed to refresh messages:', err.message);
  }
}

/**
 * Initialize New Chat modal & submission
 */
function initNewChatModal() {
  const startBtn = document.getElementById('btn-start-chat');
  const form = document.getElementById('new-chat-form');

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      window.openModal('new-chat-modal');
      const input = document.getElementById('new-chat-recipient');
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 150);
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('new-chat-recipient');
      const recipient = (input ? input.value : '').trim();

      if (!recipient) {
        window.showToast('Please enter an email or User ID', 'error');
        return;
      }

      try {
        window.showToast('Starting private chat...', 'info');
        const conv = await window.API.createConversation(recipient);
        window.closeModal('new-chat-modal');
        window.showToast('Conversation ready! 💬', 'success');

        await loadConversations();
        selectConversation(conv, true);
      } catch (err) {
        window.showToast(err.message || 'Could not start conversation', 'error');
      }
    });
  }
}

/**
 * Initialize message sending
 */
function initSendForm() {
  const form = document.getElementById('chat-send-form');
  const input = document.getElementById('chat-message-input');

  if (!form || !input) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeConversation) {
      window.showToast('Select a conversation first', 'warning');
      return;
    }

    const content = input.value.trim();
    if (!content) return;

    input.value = '';

    try {
      await window.API.sendMessage(activeConversation.id, content);
      await refreshActiveMessages(true);
      await loadConversations();
    } catch (err) {
      window.showToast(err.message || 'Message could not be sent', 'error');
      input.value = content;
    }
  });
}

/**
 * Initialize actions: Delete Conversation & Block User
 */
function initChatActions() {
  const deleteBtn = document.getElementById('btn-delete-conv');
  const blockBtn = document.getElementById('btn-block-contact');

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!activeConversation) return;

      if (confirm('Permanently delete this private conversation and all message history? This action cannot be undone.')) {
        try {
          await window.API.deleteConversation(activeConversation.id);
          window.showToast('Conversation deleted permanently 🗑️', 'info');

          activeConversation = null;
          document.getElementById('chat-empty-thread-state').style.display = 'block';
          document.getElementById('chat-active-thread').style.display = 'none';

          await loadConversations();
        } catch (err) {
          window.showToast(err.message || 'Failed to delete conversation', 'error');
        }
      }
    });
  }

  if (blockBtn) {
    blockBtn.addEventListener('click', async () => {
      if (!activeConversation) return;

      const reason = prompt('Block this user? Enter an optional reason for the security report:', 'Spam or harassment');
      if (reason !== null) {
        try {
          const targetId = activeConversation.other_user_id || activeConversation.participant_ids?.find(id => String(id) !== String(currentUser.id));
          await window.API.blockUser(targetId, reason);
          window.showToast('User has been blocked. They will no longer be able to message you. 🚫', 'success');

          activeConversation = null;
          document.getElementById('chat-empty-thread-state').style.display = 'block';
          document.getElementById('chat-active-thread').style.display = 'none';

          await loadConversations();
        } catch (err) {
          window.showToast(err.message || 'Failed to block user', 'error');
        }
      }
    });
  }
}

/**
 * Filter conversations in real time
 */
function initChatSearch() {
  const searchInput = document.getElementById('chat-search-input');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allConversations.filter(c => {
      const name = (c.other_user_name || '').toLowerCase();
      const email = (c.other_user_email || '').toLowerCase();
      const last = (c.last_message?.content || '').toLowerCase();
      return name.includes(term) || email.includes(term) || last.includes(term);
    });
    renderConversationsList(filtered);
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function formatTime(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}
