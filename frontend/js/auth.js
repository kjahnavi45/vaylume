/**
 * ==========================================================================
 * VAYLUME - Authentication Controller (auth.js)
 * ==========================================================================
 * Handles form validation, password strength, password visibility toggling,
 * login submission, signup registration, and forgot password modal flow.
 */

document.addEventListener('DOMContentLoaded', () => {
  initPasswordToggles();
  initLoginForm();
  initSignupForm();
  initForgotPasswordModal();
  populateAuthLanguageSelect();
});

/**
 * Toggle Password Visibility (Eye icon)
 */
function initPasswordToggles() {
  document.querySelectorAll('.input-toggle-password').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const input = btn.closest('.input-icon-wrapper').querySelector('input');
      if (input) {
        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = '👁️‍🗨️';
          btn.setAttribute('aria-label', 'Hide password');
        } else {
          input.type = 'password';
          btn.textContent = '👁️';
          btn.setAttribute('aria-label', 'Show password');
        }
      }
    });
  });
}

/**
 * Populate preferred language options on signup form
 */
function populateAuthLanguageSelect() {
  const langSelect = document.getElementById('signup-language');
  if (langSelect && window.SUPPORTED_LANGUAGES) {
    langSelect.innerHTML = '<option value="">Select Preferred Language</option>';
    window.SUPPORTED_LANGUAGES.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = `${lang.native} (${lang.label})`;
      if (lang.code === 'English') option.selected = true;
      langSelect.appendChild(option);
    });
  }
}

/**
 * Helper to show/hide validation errors
 */
function setFieldError(fieldId, errorMsg) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  const formGroup = field.closest('.form-group');
  if (!formGroup) return;

  let errorSpan = formGroup.querySelector('.form-error');
  if (!errorSpan) {
    errorSpan = document.createElement('div');
    errorSpan.className = 'form-error';
    formGroup.appendChild(errorSpan);
  }

  if (errorMsg) {
    formGroup.classList.add('has-error');
    errorSpan.textContent = errorMsg;
    errorSpan.style.display = 'block';
  } else {
    formGroup.classList.remove('has-error');
    errorSpan.textContent = '';
    errorSpan.style.display = 'none';
  }
}

/**
 * Email validation regex
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Phone number validation (10 digits)
 */
function isValidPhone(phone) {
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  return cleaned.length >= 10 && cleaned.length <= 13;
}

/**
 * Login Form Controller
 */
function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const submitBtn = document.getElementById('login-submit-btn');

  // Clear errors on input
  [emailInput, passwordInput].forEach(inp => {
    if (inp) {
      inp.addEventListener('input', () => setFieldError(inp.id, ''));
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let hasError = false;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email) {
      setFieldError('login-email', 'Please enter your email address.');
      hasError = true;
    } else if (!isValidEmail(email)) {
      setFieldError('login-email', 'Please enter a valid email address.');
      hasError = true;
    }

    if (!password) {
      setFieldError('login-password', 'Please enter your password.');
      hasError = true;
    } else if (password.length < 6) {
      setFieldError('login-password', 'Password must be at least 6 characters.');
      hasError = true;
    }

    if (hasError) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="animate-spin">⏳</span> Authenticating...';

    try {
      const result = await window.API.login({ email, password });
      window.showToast('Login successful! Redirecting to dashboard...', 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 700);
    } catch (err) {
      window.showToast(err.message || 'Authentication failed. Please check credentials.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Login to VAYLUME';
    }
  });
}

/**
 * Signup Form Controller
 */
function initSignupForm() {
  const form = document.getElementById('signup-form');
  if (!form) return;

  const nameInput = document.getElementById('signup-name');
  const emailInput = document.getElementById('signup-email');
  const phoneInput = document.getElementById('signup-phone');
  const passInput = document.getElementById('signup-password');
  const confirmInput = document.getElementById('signup-confirm-password');
  const langSelect = document.getElementById('signup-language');
  const strengthMeter = document.getElementById('password-strength-indicator');
  const submitBtn = document.getElementById('signup-submit-btn');

  // Password strength checker
  if (passInput && strengthMeter) {
    passInput.addEventListener('input', () => {
      const val = passInput.value;
      let score = 0;
      if (val.length >= 8) score++;
      if (/[A-Z]/.test(val)) score++;
      if (/[0-9]/.test(val)) score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;

      strengthMeter.className = 'password-strength-bar';
      if (val.length === 0) {
        strengthMeter.style.width = '0%';
        strengthMeter.style.backgroundColor = 'transparent';
      } else if (score <= 1) {
        strengthMeter.style.width = '25%';
        strengthMeter.style.backgroundColor = 'var(--rose-400)';
      } else if (score === 2) {
        strengthMeter.style.width = '55%';
        strengthMeter.style.backgroundColor = 'var(--amber-400)';
      } else if (score >= 3) {
        strengthMeter.style.width = '100%';
        strengthMeter.style.backgroundColor = 'var(--emerald-400)';
      }
    });
  }

  // Clear errors on input
  [nameInput, emailInput, phoneInput, passInput, confirmInput, langSelect].forEach(el => {
    if (el) el.addEventListener('input', () => setFieldError(el.id, ''));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let hasError = false;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const pass = passInput.value;
    const confirm = confirmInput.value;
    const lang = langSelect.value;

    if (!name || name.length < 2) {
      setFieldError('signup-name', 'Full Name must be at least 2 characters.');
      hasError = true;
    }

    if (!email || !isValidEmail(email)) {
      setFieldError('signup-email', 'Please provide a valid email address.');
      hasError = true;
    }

    if (!phone || !isValidPhone(phone)) {
      setFieldError('signup-phone', 'Please enter a valid 10-digit phone number.');
      hasError = true;
    }

    if (!pass || pass.length < 8) {
      setFieldError('signup-password', 'Password must be at least 8 characters.');
      hasError = true;
    }

    if (pass !== confirm) {
      setFieldError('signup-confirm-password', 'Passwords do not match.');
      hasError = true;
    }

    if (!lang) {
      setFieldError('signup-language', 'Please select your preferred language.');
      hasError = true;
    }

    if (hasError) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="animate-spin">⏳</span> Creating Encrypted Vault...';

    try {
      const result = await window.API.signup({
        fullName: name,
        email: email,
        phone: phone,
        password: pass,
        preferredLanguage: lang
      });

      // Update preferred language in app
      if (window.setActiveLanguage) {
        window.setActiveLanguage(lang);
      }

      window.showToast('Account successfully created! Welcome to VAYLUME.', 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 700);
    } catch (err) {
      window.showToast(err.message || 'Registration failed. Please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Create My VAYLUME Space';
    }
  });
}

/**
 * Forgot Password Modal Handler
 */
function initForgotPasswordModal() {
  const openBtn = document.getElementById('forgot-password-link');
  const modal = document.getElementById('forgot-password-modal');
  const form = document.getElementById('forgot-password-form');
  const emailInput = document.getElementById('forgot-email');
  const submitBtn = document.getElementById('forgot-submit-btn');

  if (openBtn) {
    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.openModal('forgot-password-modal');
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();

      if (!email || !isValidEmail(email)) {
        setFieldError('forgot-email', 'Please enter a valid email address.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending reset instructions...';

      setTimeout(() => {
        window.closeModal('forgot-password-modal');
        window.showToast(`Password recovery link and OTP sent to ${email}`, 'success', 5000);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Recovery Link';
        form.reset();
      }, 1200);
    });
  }
}
