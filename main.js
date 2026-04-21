import { getUser, login, logoutLocal, logoutSSO, refreshTokens, revokeAccessToken, revokeRefreshToken } from "./auth.js";
import { renderTokenCard, startExpiryCountdowns } from "./token-inspector.js";
import { renderAccessControlDebugger } from "./access-control-debugger.js";
import { renderConfigPanel } from "./config-panel.js";

// ── Element refs ──────────────────────────────────────────
const sessionStatus = document.getElementById("session-status");
const btnLogin = document.getElementById("btn-login");
const btnLogoutLocal = document.getElementById("btn-logout-local");
const btnLogoutSSO = document.getElementById("btn-logout-sso");
const btnToggleConfig = document.getElementById("btn-toggle-config");
const configFlyout = document.getElementById("config-panel-flyout");
const appSection = document.getElementById("app");
const loggedOutMsg = document.getElementById("logged-out-msg");
const actionResult = document.getElementById("action-result");

const idTokenCard = document.getElementById("id-token-card");
const accessTokenCard = document.getElementById("access-token-card");
const refreshTokenCard = document.getElementById("refresh-token-card");
const claimsContainer = document.getElementById("claims-table-container");

// ── State ─────────────────────────────────────────────────
let countdownInterval = null;

// ── Boot ──────────────────────────────────────────────────
async function init() {
  renderConfigPanel(
    document.getElementById("config-panel-container"),
    onConfigSaved,
  );

  const user = await getUser();
  user ? renderLoggedIn(user) : renderLoggedOut();
}

// ── Config saved callback ─────────────────────────────────
// Called by the Config Panel after a save or reset.
// Re-checks the session with the new config in place.
async function onConfigSaved() {
  // Re-render the config panel itself so the badge updates
  renderConfigPanel(
    document.getElementById("config-panel-container"),
    onConfigSaved,
  );

  // Re-check session — a new clientId/issuer means the stored
  // session is likely invalid, so we'll land on logged-out state
  const user = await getUser();
  user ? renderLoggedIn(user) : renderLoggedOut();
}

// ── Render: logged in ─────────────────────────────────────
function renderLoggedIn(user) {
  const email = user.profile?.email ?? user.profile?.sub ?? "Unknown user";

  sessionStatus.textContent = `✅ Signed in as ${email}`;
  btnLogin.hidden = true;
  btnLogoutLocal.hidden = false;
  btnLogoutSSO.hidden = false;
  appSection.hidden = false;
  loggedOutMsg.hidden = true;

  if (countdownInterval) clearInterval(countdownInterval);

  renderTokenCard(idTokenCard, "ID Token", user.id_token);
  renderTokenCard(accessTokenCard, "Access Token", user.access_token);
  renderTokenCard(refreshTokenCard, "Refresh Token", user.refresh_token ?? null);

  renderClaimsTable(user.profile);

  renderAccessControlDebugger(
    document.getElementById("access-control-container"),
    user,
  );

  countdownInterval = startExpiryCountdowns();
}

// ── Render: logged out ────────────────────────────────────
function renderLoggedOut() {
  sessionStatus.textContent = "🔒 Not signed in";
  btnLogin.hidden = false;
  btnLogoutLocal.hidden = true;
  btnLogoutSSO.hidden = true;
  appSection.hidden = true;
  loggedOutMsg.hidden = false;

  if (countdownInterval) clearInterval(countdownInterval);
}

// ── Claims table ──────────────────────────────────────────
function renderClaimsTable(profile) {
  if (!profile || Object.keys(profile).length === 0) {
    claimsContainer.innerHTML = "<p>No claims found in ID token.</p>";
    return;
  }

  const rows = Object.entries(profile).map(([claim, value]) => {
    const display = typeof value === "object"
      ? `<pre>${JSON.stringify(value, null, 2)}</pre>`
      : String(value);
    return `<tr><td class="claim-key">${claim}</td><td>${display}</td></tr>`;
  }).join("");

  claimsContainer.innerHTML = `
    <table class="claims-table">
      <thead><tr><th>Claim</th><th>Value</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ── Action result helper ──────────────────────────────────
function showResult(message, isError = false) {
  actionResult.textContent = message;
  actionResult.className = `result-box ${isError ? "result-error" : "result-ok"}`;
  actionResult.hidden = false;
  setTimeout(() => (actionResult.hidden = true), 4000);
}

// ── Button handlers ───────────────────────────────────────
btnLogin.addEventListener("click", () => login());

btnLogoutLocal.addEventListener("click", async () => {
  await logoutLocal();
  renderLoggedOut();
});

btnLogoutSSO.addEventListener("click", async () => {
  await logoutSSO();
});

btnToggleConfig.addEventListener("click", () => {
  const isHidden = configFlyout.hidden;
  configFlyout.hidden = !isHidden;
  btnToggleConfig.textContent = isHidden ? "✕ Close config" : "⚙️ Config";
});

document.getElementById("btn-refresh").addEventListener("click", async () => {
  try {
    const user = await refreshTokens();
    renderLoggedIn(user);
    showResult("✅ Tokens refreshed successfully.");
  } catch (err) {
    showResult(`❌ Refresh failed: ${err.message}`, true);
  }
});

document.getElementById("btn-revoke-access").addEventListener("click", async () => {
  try {
    await revokeAccessToken();
    showResult("✅ Access token revoked.");
  } catch (err) {
    showResult(`❌ Revocation failed: ${err.message}`, true);
  }
});

document.getElementById("btn-revoke-refresh").addEventListener("click", async () => {
  try {
    await revokeRefreshToken();
    showResult("✅ Refresh token revoked.");
  } catch (err) {
    showResult(`❌ Revocation failed: ${err.message}`, true);
  }
});

// ── Start ─────────────────────────────────────────────────
init();
