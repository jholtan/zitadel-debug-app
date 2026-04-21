import { getConfig, saveConfig, resetConfig } from "./config.js";

/**
 * Render the Config Panel into a container element.
 *
 * @param {HTMLElement} container
 * @param {Function}    onSave  - Callback fired after config is saved.
 *                                Use this to re-initialise auth with new settings.
 */
export function renderConfigPanel(container, onSave) {
  const config = getConfig();
  const isOverridden = !!localStorage.getItem("zitadel_debug_config");

  container.innerHTML = `
    <div class="debug-panel">

      <div class="config-panel-header">
        <p class="hint" style="margin: 0;">
          Changes are saved to <code>localStorage</code> and take effect immediately.
          They override the defaults in <code>config.js</code> without a redeployment.
        </p>
        ${isOverridden
      ? `<span class="config-badge config-badge-override">⚠️ Using local overrides</span>`
      : `<span class="config-badge config-badge-default">✅ Using defaults</span>`
    }
      </div>

      <div class="field-grid" style="margin-top: 1.25rem;">

        <label>
          Issuer URL
          <input id="cfg-issuer" type="text" value="${config.issuer}" />
          <span class="field-hint">Your Zitadel domain, e.g. https://auth.example.com</span>
        </label>

        <label>
          Client ID
          <input id="cfg-client-id" type="text" value="${config.clientId}" />
          <span class="field-hint">From your Zitadel PKCE application</span>
        </label>

        <label>
          Redirect URI
          <input id="cfg-redirect-uri" type="text" value="${config.redirectUri}" />
          <span class="field-hint">Must match exactly what's configured in Zitadel</span>
        </label>

        <label>
          Post-Logout Redirect URI
          <input id="cfg-post-logout-uri" type="text" value="${config.postLogoutRedirectUri}" />
          <span class="field-hint">Where Zitadel sends the user after SSO logout</span>
        </label>

        <label style="grid-column: 1 / -1;">
          Default Scopes
          <input id="cfg-scope" type="text" value="${config.scope}" />
          <span class="field-hint">
            Space-separated. These are used for regular logins.
            The Scope Tester lets you override per-login.
          </span>
        </label>

      </div>

      <!-- OIDC Discovery preview -->
      <div style="margin-top: 1.5rem;">
        <button id="btn-fetch-discovery" class="btn btn-secondary">
          🔍 Fetch OIDC Discovery Document
        </button>
        <div id="discovery-result" hidden style="margin-top: 1rem;">
          <h4 style="margin-bottom: 0.5rem;">
            <code>${config.issuer}/.well-known/openid-configuration</code>
          </h4>
          <pre id="discovery-output"></pre>
        </div>
      </div>

      <!-- Actions -->
      <div class="action-row" style="margin-top: 1.5rem;">
        <button id="btn-save-config"  class="btn btn-primary">Save & Apply</button>
        <button id="btn-reset-config" class="btn btn-danger">Reset to defaults</button>
      </div>

      <div id="config-result" class="result-box" hidden></div>

    </div>
  `;

  wireUpConfigPanel(onSave);
}

// ── Wiring ────────────────────────────────────────────────

function wireUpConfigPanel(onSave) {
  const resultBox = document.getElementById("config-result");

  // ── Save ──
  document.getElementById("btn-save-config").addEventListener("click", () => {
    const issuer = document.getElementById("cfg-issuer").value.trim();
    const clientId = document.getElementById("cfg-client-id").value.trim();
    const redirectUri = document.getElementById("cfg-redirect-uri").value.trim();
    const postLogoutUri = document.getElementById("cfg-post-logout-uri").value.trim();
    const scope = document.getElementById("cfg-scope").value.trim();

    const errors = validateConfig({ issuer, clientId, redirectUri, postLogoutUri, scope });
    if (errors.length) {
      showResult(resultBox, "❌ " + errors.join(" · "), true);
      return;
    }

    saveConfig({
      issuer,
      clientId,
      redirectUri,
      postLogoutRedirectUri: postLogoutUri,
      scope,
    });

    showResult(resultBox, "✅ Config saved. Re-initialising...");

    // Short delay so the user sees the confirmation, then hand control
    // back to main.js to re-check the session with the new config.
    setTimeout(() => onSave(), 800);
  });

  // ── Reset ──
  document.getElementById("btn-reset-config").addEventListener("click", () => {
    if (!confirm("Reset to defaults? Your local overrides will be lost.")) return;
    resetConfig();
    showResult(resultBox, "✅ Reset to defaults.");
    setTimeout(() => onSave(), 800);
  });

  // ── OIDC Discovery ──
  document.getElementById("btn-fetch-discovery").addEventListener("click", async () => {
    const issuer = document.getElementById("cfg-issuer").value.trim();
    const resultDiv = document.getElementById("discovery-result");
    const outputPre = document.getElementById("discovery-output");

    outputPre.textContent = "⏳ Fetching...";
    outputPre.style.color = "";
    resultDiv.hidden = false;

    try {
      const res = await fetch(`${issuer}/.well-known/openid-configuration`);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const json = await res.json();

      outputPre.textContent = JSON.stringify(json, null, 2);

      // Highlight key endpoints for quick reference
      showResult(
        resultBox,
        `✅ Discovery OK · endpoints found: ${countEndpoints(json)}`,
      );
    } catch (err) {
      outputPre.style.color = "#ff8a8a";
      outputPre.textContent = `Error: ${err.message}\n\nCheck that the Issuer URL is correct and reachable.`;
    }
  });
}

// ── Helpers ───────────────────────────────────────────────

function validateConfig({ issuer, clientId, redirectUri, postLogoutUri, scope }) {
  const errors = [];
  if (!issuer) errors.push("Issuer URL is required.");
  if (!issuer.startsWith("https://") && !issuer.startsWith("http://localhost"))
    errors.push("Issuer URL must start with https:// (or http://localhost for dev).");
  if (!clientId) errors.push("Client ID is required.");
  if (!redirectUri) errors.push("Redirect URI is required.");
  if (!postLogoutUri) errors.push("Post-Logout URI is required.");
  if (!scope) errors.push("Scope is required.");
  if (!scope.includes("openid")) errors.push("Scope must include 'openid'.");
  return errors;
}

function countEndpoints(discovery) {
  return Object.keys(discovery).filter((k) => k.endsWith("_endpoint")).length;
}

function showResult(el, message, isError = false) {
  el.textContent = message;
  el.className = `result-box ${isError ? "result-error" : "result-ok"}`;
  el.hidden = false;
  setTimeout(() => (el.hidden = true), 5000);
}
