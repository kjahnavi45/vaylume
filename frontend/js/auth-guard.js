/**
 * ==========================================================================
 * VAYLUME - Route Guard (auth-guard.js)
 * ==========================================================================
 * C7 FIX: Protects all authenticated pages.
 * Include this script FIRST (before main.js) on all app pages
 * (dashboard, memories, notes, locker, profile).
 *
 * Public pages (index, login, signup) must NOT include this script.
 */

(function () {
  'use strict';

  const TOKEN_KEY  = 'vaylume_auth_token';
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    // No token — redirect to login preserving the intended destination
    const dest = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace('login.html?redirect=' + dest);
  }

  // If we have a mock token (offline demo), we skip server validation.
  // If we have a real token, its validity is checked server-side on each API call.
})();
