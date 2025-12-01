// ===== FORCE RESET USING VERSION =====
const RESET_VERSION = "v2";  // 👉 force logoutto "v2", "v3"...
try {
  const currentVersion = localStorage.getItem("reset_version");
  if (currentVersion !== RESET_VERSION) {
    console.log("🔄 Resetting user localStorage due to version change...");

    localStorage.removeItem("redirect_email");
    localStorage.removeItem("redirect_url");
    localStorage.removeItem("redirect_last");

    localStorage.setItem("reset_version", RESET_VERSION);

    location.reload();
  }
} catch (e) {}
// =====================================


// ====== CONFIG (edit these if needed) ======
const CLIENT_ID = '224714556804-81spvp5794l9rfrslif4o27k4u5fr1ig.apps.googleusercontent.com';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzhGqwlkWCJOJBXNRQ0qD-KC_Ws02UQ3Nti8b9x8_EEb7wMSxTMgXRc4GkHlYpkZ5OCTg/exec';
const FALLBACK_URL = 'https://www.google.com';
const CACHE_DURATION = 4320 * 60 * 60 * 1000; // 4320 hours(1 year)
// ===========================================

const statusEl = () => document.getElementById('status');

function setStatus(msg) {
  const el = statusEl();
  if (el) el.textContent = msg;
}

function storeEmail(email) {
  try {
    localStorage.setItem('redirect_email', email);
    localStorage.setItem('redirect_last', String(Date.now()));
  } catch (e) {}
}

function parseEmailFromIdToken(idToken) {
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    return payload && payload.email ? String(payload.email) : null;
  } catch (_) {
    return null;
  }
}

function redirectUsingToken(idToken) {
  setStatus('Verifying account…');
  fetch(`${GAS_URL}?id_token=${encodeURIComponent(idToken)}`)
    .then(r => r.json())
    .then(data => {
      if (!data || !data.ok || !data.url || data.url === FALLBACK_URL) throw new Error(data && data.error || 'Bad response');
      try {
        localStorage.setItem('redirect_url', data.url);
      } catch (e) {}
      window.location.replace(data.url);
    })
    .catch(err => {
      console.error('Redirect error:', err);
      setStatus('Retrying verification…');
      fetch(`${GAS_URL}?id_token=${encodeURIComponent(idToken)}`)
        .then(r => r.json())
        .then(data => {
          if (!data || !data.ok || !data.url || data.url === FALLBACK_URL) throw new Error(data && data.error || 'Bad response');
          try {
            localStorage.setItem('redirect_url', data.url);
          } catch (e) {}
          window.location.replace(data.url);
        })
        .catch(err => {
          console.error('Retry failed:', err);
          setStatus('Automatic redirect failed. Opening default…');
          window.location.replace(FALLBACK_URL);
        });
    });
}

function handleCredentialResponse(response) {
  const idToken = response && response.credential;
  if (!idToken) {
    setStatus('No credential received. Please sign in.');
    return;
  }

  const email = parseEmailFromIdToken(idToken);
  if (email) {
    const storedEmail = localStorage.getItem('redirect_email');
    const storedLast = parseInt(localStorage.getItem('redirect_last') || '0', 10);
    const storedUrl = localStorage.getItem('redirect_url');

    if (email === storedEmail && Date.now() - storedLast < CACHE_DURATION && storedUrl) {
      setStatus('Redirecting from cache…');
      window.location.replace(storedUrl);
      return;
    }

    storeEmail(email);
  }

  redirectUsingToken(idToken);
}

function init() {
  setStatus('Contacting Google…');

  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: true,
  });

  const btn = document.getElementById('gbtn');
  if (btn) {
    google.accounts.id.renderButton(btn, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'pill',
    });
  }

  const saved = localStorage.getItem('redirect_email');
  if (saved) {
    setStatus(`Welcome back${saved ? `, ${saved}` : ''}… waiting for Google.`);
  } else {
    google.accounts.id.prompt();
  }
}

const storedLast = parseInt(localStorage.getItem('redirect_last') || '0', 10);
const storedUrl = localStorage.getItem('redirect_url');
if (Date.now() - storedLast < CACHE_DURATION && storedUrl) {
  window.location.replace(storedUrl);
}

// ====== FIX: Wait until Google lib is ready ======
function waitForGoogleLib(callback) {
  if (typeof google !== "undefined" && google.accounts && google.accounts.id) {
    callback();
  } else {
    console.log("Google lib not ready, retrying…");
    setTimeout(() => waitForGoogleLib(callback), 200);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  waitForGoogleLib(init);
});
