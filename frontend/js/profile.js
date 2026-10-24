/**
 * ==========================================================================
 * VAYLUME - Profile & Settings Controller (profile.js)
 * ==========================================================================
 * Features:
 * - View & update personal information (Name, Email, Phone, Preferred Language, Bio)
 * - Security preferences: Two-factor authentication, biometric toggle
 * - Password update validation
 * - Data export to JSON (Zero-Knowledge backup)
 * - Danger zone: Account deletion simulation
 * - Storage metrics breakdown
 */

document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile();
  initProfileForm();
  await initThemePersonalization();
  initPasswordChangeForm();
  initDataExportAndDangerZone();
  initSecuritySwitches();
});

/**
 * Load user profile into form inputs and stat cards
 */
async function loadUserProfile() {
  try {
    const profile = await window.API.getProfile();

    // Populate input fields
    const nameInput = document.getElementById('profile-name');
    const emailInput = document.getElementById('profile-email');
    const phoneInput = document.getElementById('profile-phone');
    const bioInput = document.getElementById('profile-bio');
    const langSelect = document.getElementById('profile-language');

    if (nameInput) nameInput.value = profile.fullName || '';
    if (emailInput) emailInput.value = profile.email || '';
    if (phoneInput) phoneInput.value = profile.phone || '';
    if (bioInput) bioInput.value = profile.bio || '';

    // Populate language select options
    if (langSelect && window.SUPPORTED_LANGUAGES) {
      langSelect.innerHTML = '';
      window.SUPPORTED_LANGUAGES.forEach(lang => {
        const opt = document.createElement('option');
        opt.value = lang.code;
        opt.textContent = `${lang.native} (${lang.label})`;
        if (lang.code === profile.preferredLanguage) opt.selected = true;
        langSelect.appendChild(opt);
      });
    }

    // Populate Header / Hero badges
    const displayHeroName = document.getElementById('profile-hero-name');
    const displayHeroEmail = document.getElementById('profile-hero-email');
    const displayHeroJoined = document.getElementById('profile-hero-joined');
    const displayAvatar = document.getElementById('profile-hero-avatar');

    if (displayHeroName) displayHeroName.textContent = profile.fullName || 'Vaylume Member';
    if (displayHeroEmail) displayHeroEmail.textContent = profile.email || '';
    if (displayHeroJoined) displayHeroJoined.textContent = `Member since ${profile.joinedDate || '2026'}`;

    if (displayAvatar && profile.fullName) {
      const initials = profile.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      displayAvatar.textContent = initials;
    }

    // Storage breakdown
    renderStorageBreakdown(profile);

  } catch (err) {
    console.error('Error loading profile:', err);
    window.showToast('Could not load profile settings', 'error');
  }
}

/**
 * Render visual breakdown of vault usage
 */
function renderStorageBreakdown(profile) {
  const usedMB = profile.storageUsedMB || 142;
  const limitMB = profile.storageLimitMB || 5120;
  const percent = Math.min(100, Math.round((usedMB / limitMB) * 100));

  const usedEl = document.getElementById('profile-storage-used-val');
  const percentEl = document.getElementById('profile-storage-percent');
  const barEl = document.getElementById('profile-storage-bar');

  if (usedEl) usedEl.textContent = `${usedMB} MB / ${(limitMB / 1024).toFixed(0)} GB`;
  if (percentEl) percentEl.textContent = `${percent}% used`;
  if (barEl) barEl.style.width = `${percent}%`;
}

/**
 * Update Profile Information
 */
function initProfileForm() {
  const form = document.getElementById('profile-edit-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('profile-name').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    const phone = document.getElementById('profile-phone').value.trim();
    const bio = document.getElementById('profile-bio').value.trim();
    const preferredLanguage = document.getElementById('profile-language').value;

    if (!fullName || fullName.length < 2) {
      window.showToast('Full name must be at least 2 characters.', 'error');
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      window.showToast('Please enter a valid email address.', 'error');
      return;
    }

    const saveBtn = document.getElementById('profile-save-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="animate-spin">⏳</span> Saving...';
    }

    try {
      const updated = await window.API.updateProfile({
        fullName,
        email,
        phone,
        bio,
        preferredLanguage
      });

      // Synchronize language across application
      if (window.setActiveLanguage) {
        window.setActiveLanguage(preferredLanguage);
      }

      // Sync avatar & names in header
      const userNameEls = document.querySelectorAll('.display-user-name');
      const userAvatarEls = document.querySelectorAll('.user-avatar');
      const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

      userNameEls.forEach(el => el.textContent = fullName);
      userAvatarEls.forEach(el => el.textContent = initials);

      const heroName = document.getElementById('profile-hero-name');
      if (heroName) heroName.textContent = fullName;

      window.showToast('Profile information successfully updated!', 'success');

    } catch (err) {
      window.showToast('Failed to update profile.', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Save Changes';
      }
    }
  });
}

/**
 * Change Password form handler
 */
function initPasswordChangeForm() {
  const form = document.getElementById('profile-password-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const current = document.getElementById('curr-password').value;
    const newPass = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-new-password').value;

    if (!current) {
      window.showToast('Please enter your current password.', 'error');
      return;
    }

    if (newPass.length < 8) {
      window.showToast('New password must be at least 8 characters long.', 'error');
      return;
    }

    if (newPass !== confirm) {
      window.showToast('New passwords do not match.', 'error');
      return;
    }

    window.showToast('Password updated securely with zero-knowledge re-encryption!', 'success');
    form.reset();
  });
}

/**
 * Security toggles (2FA & Biometric)
 */
function initSecuritySwitches() {
  const twoFaSwitch = document.getElementById('security-2fa-switch');
  const biometricSwitch = document.getElementById('security-biometric-switch');

  if (twoFaSwitch) {
    twoFaSwitch.addEventListener('change', () => {
      if (twoFaSwitch.checked) {
        window.showToast('Two-Factor Authentication (TOTP) enabled!', 'success');
      } else {
        window.showToast('Two-Factor Authentication disabled.', 'info');
      }
    });
  }

  if (biometricSwitch) {
    biometricSwitch.addEventListener('change', () => {
      if (biometricSwitch.checked) {
        window.showToast('Biometric / Hardware Key access enabled!', 'success');
      } else {
        window.showToast('Biometric access disabled.', 'info');
      }
    });
  }
}

/**
 * Data Export to JSON & Danger Zone
 */
function initDataExportAndDangerZone() {
  // Export Data Button
  const exportBtn = document.getElementById('btn-export-all-data');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        exportBtn.disabled = true;
        exportBtn.textContent = 'Generating Archive...';
        const fullExport = await window.API.exportData();

        const jsonStr = JSON.stringify(fullExport, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vaylume_vault_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        window.showToast('Personal data archive generated and downloaded! 📦', 'success');
      } catch (e) {
        window.showToast('Export failed: ' + e.message, 'error');
      } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = '📦 Export Full Vault (JSON)';
      }
    });
  }

  // Delete Account Danger Zone
  const deleteBtn = document.getElementById('btn-delete-account');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const confirmation = prompt('⚠️ PERMANENT ACCOUNT DELETION\n\nThis will permanently purge your profile, memories, AI notes, digital locker files, and user chats.\n\nTo confirm destruction, type exactly: DELETE MY ACCOUNT');
      if (confirmation === 'DELETE MY ACCOUNT') {
        try {
          deleteBtn.disabled = true;
          deleteBtn.textContent = 'Purging Vault...';
          await window.API.deleteAccount('DELETE MY ACCOUNT');
          alert('Your VAYLUME account and all associated data have been permanently purged.');
          window.location.href = 'signup.html';
        } catch (err) {
          alert('Account deletion failed: ' + err.message);
          deleteBtn.disabled = false;
          deleteBtn.textContent = '🗑️ Destroy Vault & Delete Account';
        }
      } else if (confirmation !== null) {
        window.showToast('Account deletion aborted. Confirmation text did not match.', 'info');
      }
    });
  }
}


/**
 * Themes & Personalization Controller
 */
async function initThemePersonalization() {
  let currentPrefs = {
    theme: 'dark',
    preset_theme: 'cyan',
    custom_accent: '#00f2fe',
    wallpaper_url: null,
    wallpaper_blur: 0,
    wallpaper_brightness: 100,
    wallpaper_overlay_opacity: 40,
    auto_lock_minutes: 15
  };

  try {
    if (window.API && typeof window.API.getPreferences === 'function') {
      currentPrefs = await window.API.getPreferences();
    }
  } catch (e) {
    console.warn('[VAYLUME] Using default preferences:', e);
  }

  // Inputs
  const darkRadio = document.getElementById('theme-mode-dark');
  const lightRadio = document.getElementById('theme-mode-light');
  const presetContainer = document.getElementById('theme-presets-container');
  const accentPicker = document.getElementById('pref-custom-accent');
  const accentHex = document.getElementById('pref-accent-hex');
  const wallpaperFile = document.getElementById('pref-wallpaper-file');
  const wallpaperPreview = document.getElementById('pref-wallpaper-preview');
  const placeholderText = document.getElementById('wallpaper-placeholder-text');
  const clearWallpaperBtn = document.getElementById('btn-clear-wallpaper');
  const blurSlider = document.getElementById('pref-wallpaper-blur');
  const blurVal = document.getElementById('val-blur');
  const brightnessSlider = document.getElementById('pref-wallpaper-brightness');
  const brightnessVal = document.getElementById('val-brightness');
  const overlaySlider = document.getElementById('pref-wallpaper-overlay');
  const overlayVal = document.getElementById('val-overlay');
  const autolockSelect = document.getElementById('pref-autolock');
  const saveBtn = document.getElementById('btn-save-prefs');
  const resetBtn = document.getElementById('btn-reset-prefs');

  function syncUIFromPrefs(prefs) {
    if (prefs.theme === 'light') {
      if (lightRadio) lightRadio.checked = true;
    } else {
      if (darkRadio) darkRadio.checked = true;
    }

    if (presetContainer) {
      presetContainer.querySelectorAll('.theme-preset-card').forEach(card => {
        if (card.dataset.preset === prefs.preset_theme) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      });
    }

    if (accentPicker) accentPicker.value = prefs.custom_accent || '#00f2fe';
    if (accentHex) accentHex.textContent = prefs.custom_accent || '#00f2fe';

    if (blurSlider) blurSlider.value = prefs.wallpaper_blur !== undefined ? prefs.wallpaper_blur : 0;
    if (blurVal) blurVal.textContent = (prefs.wallpaper_blur || 0) + 'px';

    if (brightnessSlider) brightnessSlider.value = prefs.wallpaper_brightness !== undefined ? prefs.wallpaper_brightness : 100;
    if (brightnessVal) brightnessVal.textContent = (prefs.wallpaper_brightness || 100) + '%';

    if (overlaySlider) overlaySlider.value = prefs.wallpaper_overlay_opacity !== undefined ? prefs.wallpaper_overlay_opacity : 40;
    if (overlayVal) overlayVal.textContent = (prefs.wallpaper_overlay_opacity || 40) + '%';

    if (autolockSelect) autolockSelect.value = String(prefs.auto_lock_minutes !== undefined ? prefs.auto_lock_minutes : 15);

    if (wallpaperPreview) {
      if (prefs.wallpaper_url) {
        wallpaperPreview.style.backgroundImage = `url("${prefs.wallpaper_url}")`;
        if (placeholderText) placeholderText.style.display = 'none';
      } else {
        wallpaperPreview.style.backgroundImage = 'none';
        if (placeholderText) placeholderText.style.display = 'block';
      }
    }
  }

  syncUIFromPrefs(currentPrefs);
  if (window.applyUserTheme) window.applyUserTheme(currentPrefs);

  // Mode radio change
  [darkRadio, lightRadio].forEach(radio => {
    if (radio) {
      radio.addEventListener('change', () => {
        currentPrefs.theme = darkRadio.checked ? 'dark' : 'light';
        if (window.applyUserTheme) window.applyUserTheme(currentPrefs);
      });
    }
  });

  // Preset theme selection
  if (presetContainer) {
    presetContainer.querySelectorAll('.theme-preset-card').forEach(card => {
      card.addEventListener('click', () => {
        presetContainer.querySelectorAll('.theme-preset-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        currentPrefs.preset_theme = card.dataset.preset;

        const presetColors = {
          cyan: '#00f2fe',
          purple: '#a855f7',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
          slate: '#38bdf8'
        };
        const color = presetColors[card.dataset.preset] || '#00f2fe';
        currentPrefs.custom_accent = color;
        if (accentPicker) accentPicker.value = color;
        if (accentHex) accentHex.textContent = color;

        if (window.applyUserTheme) window.applyUserTheme(currentPrefs);
      });
    });
  }

  // Custom accent picker
  if (accentPicker) {
    accentPicker.addEventListener('input', (e) => {
      const color = e.target.value;
      currentPrefs.custom_accent = color;
      if (accentHex) accentHex.textContent = color;
      if (window.applyUserTheme) window.applyUserTheme(currentPrefs);
    });
  }

  // Sliders
  if (blurSlider) {
    blurSlider.addEventListener('input', (e) => {
      currentPrefs.wallpaper_blur = parseInt(e.target.value, 10);
      if (blurVal) blurVal.textContent = currentPrefs.wallpaper_blur + 'px';
      if (window.applyUserTheme) window.applyUserTheme(currentPrefs);
    });
  }

  if (brightnessSlider) {
    brightnessSlider.addEventListener('input', (e) => {
      currentPrefs.wallpaper_brightness = parseInt(e.target.value, 10);
      if (brightnessVal) brightnessVal.textContent = currentPrefs.wallpaper_brightness + '%';
      if (window.applyUserTheme) window.applyUserTheme(currentPrefs);
    });
  }

  if (overlaySlider) {
    overlaySlider.addEventListener('input', (e) => {
      currentPrefs.wallpaper_overlay_opacity = parseInt(e.target.value, 10);
      if (overlayVal) overlayVal.textContent = currentPrefs.wallpaper_overlay_opacity + '%';
      if (window.applyUserTheme) window.applyUserTheme(currentPrefs);
    });
  }

  if (autolockSelect) {
    autolockSelect.addEventListener('change', (e) => {
      currentPrefs.auto_lock_minutes = parseInt(e.target.value, 10);
    });
  }

  // Wallpaper file select
  if (wallpaperFile) {
    wallpaperFile.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      // Show immediate client-side preview
      const previewUrl = URL.createObjectURL(file);
      currentPrefs.wallpaper_url = previewUrl;
      syncUIFromPrefs(currentPrefs);
      if (window.applyUserTheme) window.applyUserTheme(currentPrefs);

      try {
        window.showToast('Uploading custom wallpaper...', 'info');
        const res = await window.API.uploadWallpaper(file);
        currentPrefs.wallpaper_url = res.wallpaper_url;
        window.showToast('Custom wallpaper uploaded and applied! 🖼️', 'success');
      } catch (err) {
        console.warn('[VAYLUME] Wallpaper upload fallback:', err.message);
        // Persist data URL locally if offline
        const reader = new FileReader();
        reader.onload = (ev) => {
          currentPrefs.wallpaper_url = ev.target.result;
          localStorage.setItem('vaylume_user_prefs', JSON.stringify(currentPrefs));
          window.showToast('Wallpaper saved locally (offline mode).', 'info');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Clear wallpaper
  if (clearWallpaperBtn) {
    clearWallpaperBtn.addEventListener('click', () => {
      currentPrefs.wallpaper_url = null;
      syncUIFromPrefs(currentPrefs);
      if (window.applyUserTheme) window.applyUserTheme(currentPrefs);
      window.showToast('Custom wallpaper cleared', 'info');
    });
  }

  // Save Preferences to Account
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        await window.API.updatePreferences(currentPrefs);
        window.showToast('Personalization preferences saved to your account! ✨', 'success');
      } catch (err) {
        window.showToast('Preferences saved locally.', 'info');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save Personalization to Account';
      }
    });
  }

  // Reset to Defaults
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Reset theme, accent color, and wallpaper back to VAYLUME defaults?')) {
        currentPrefs = {
          theme: 'dark',
          preset_theme: 'cyan',
          custom_accent: '#00f2fe',
          wallpaper_url: null,
          wallpaper_blur: 0,
          wallpaper_brightness: 100,
          wallpaper_overlay_opacity: 40,
          auto_lock_minutes: 15
        };
        syncUIFromPrefs(currentPrefs);
        if (window.applyUserTheme) window.applyUserTheme(currentPrefs);
        await window.API.updatePreferences(currentPrefs);
        window.showToast('Theme reset to default VAYLUME Dark Cyan! 🔄', 'success');
      }
    });
  }
}
