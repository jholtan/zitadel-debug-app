import { login } from "./auth.js";
import { getConfig } from "./config.js";

export async function introspectToken(token) {
  const config = getConfig();
  const introspectionUrl = `${config.issuer}/oauth/v2/introspect`;

  const body = new URLSearchParams({
    token,
    client_id: config.clientId,
  });

  const response = await fetch(introspectionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Introspection request failed (${response.status}): ${text}`);
  }

  return response.json();
}

export function renderAccessControlDebugger(container, user) {
  const config = getConfig();

  container.innerHTML = `

    <!-- ── Scope & Login Tester ───────────────────────────── -->
    <div class="debug-panel">
      <h3>🧪 Scope & Login Tester</h3>
      <p class="hint">
        Re-login with custom parameters without changing your config.
        Compare the resulting tokens to see how scopes and prompts affect claims.
      </p>

      <div class="field-grid">

        <label>
          Scopes
          <input
            id="debug-scope"
            type="text"
            value="${config.scope}"
            placeholder="openid profile email"
          />
          <span class="field-hint">Space-separated. Try adding: urn:zitadel:iam:org:project:roles</span>
        </label>

        <label>
          Prompt
          <select id="debug-prompt">
            <option value="">— none —</option>
            <option value="login">login (force re-auth)</option>
            <option value="none">none (silent check)</option>
            <option value="consent">consent</option>
            <option value="select_account">select_account</option>
          </select>
          <span class="field-hint">Controls Zitadel's login UI behaviour</span>
        </label>

        <label>
          Login Hint
          <input
            id="debug-login-hint"
            type="text"
            placeholder="user@example.com"
          />
          <span class="field-hint">Pre-fills the username field at Zitadel</span>
        </label>

        <label>
          ACR Values
          <input
            id="debug-acr"
            type="text"
            placeholder="urn:zitadel:iam:org:id:123456"
          />
          <span class="field-hint">Request specific authentication context (e.g. org restriction, MFA)</span>
        </label>

      </div>

      <div class="action-row" style="margin-top: 1rem;">
        <button id="btn-debug-login" class="btn btn-primary">Login with these params</button>
        <button id="btn-reset-scope" class="btn btn-secondary">Reset to config defaults</button>
      </div>

      <div id="scope-result" class="result-box" hidden></div>
    </div>

    <!-- ── Introspection Viewer ───────────────────────────── -->
    <div class="debug-panel" style="margin-top: 2rem;">
      <h3>🔍 Token Introspection</h3>
      <p class="hint">
        Calls <code>${config.issuer}/oauth/v2/introspect</code> with the current
        access token. Useful for verifying server-side token validity and viewing
        claims Zitadel returns for opaque tokens.
      </p>

      <div class="field-grid">
        <label>
          Token to introspect
          <textarea
            id="debug-introspect-token"
            rows="4"
            placeholder="Paste a token here, or leave blank to use the current access token"
          ></textarea>
        </label>
      </div>

      <div class="action-row" style="margin-top: 1rem;">
        <button id="btn-introspect" class="btn btn-secondary">Introspect</button>
        <button id="btn-use-access-token" class="btn btn-secondary">Use current access token</button>
      </div>

      <div id="introspect-result" hidden>
        <h4 style="margin: 1rem 0 0.5rem;">Response</h4>
        <pre id="introspect-output"></pre>
      </div>
    </div>

    <!-- ── Roles Viewer ───────────────────────────────────── -->
    <div class="debug-panel" style="margin-top: 2rem;">
      <h3>🎭 Roles & Custom Claims</h3>
      <div id="roles-container"></div>
    </div>

  `;

  // Wire up buttons
  wireUpScopeTester(config, user);
  wireUpIntrospection(user);
  renderRoles(user);
}

function wireUpScopeTester(config, user) {
  const scopeInput = document.getElementById("debug-scope");
  const promptSelect = document.getElementById("debug-prompt");
  const loginHintInput = document.getElementById("debug-login-hint");
  const acrInput = document.getElementById("debug-acr");
  const scopeResult = document.getElementById("scope-result");

  // Pre-fill login hint from current user if available
  if (user?.profile?.email) {
    loginHintInput.placeholder = user.profile.email;
  }

  document.getElementById("btn-reset-scope").addEventListener("click", () => {
    scopeInput.value = config.scope;
    promptSelect.value = "";
    loginHintInput.value = "";
    acrInput.value = "";
  });

  document.getElementById("btn-debug-login").addEventListener("click", async () => {
    const scope = scopeInput.value.trim() || undefined;
    const prompt = promptSelect.value || undefined;
    const loginHint = loginHintInput.value.trim() || undefined;
    const acrValues = acrInput.value.trim() || undefined;

    if (!scope) {
      showScopeResult("⚠️ Scope cannot be empty — must include at least: openid", true);
      return;
    }

    if (!scope.includes("openid")) {
      showScopeResult("⚠️ Warning: scope does not include 'openid'. The ID token may not be returned.", true);
      // Don't block — let them test it
      await new Promise((r) => setTimeout(r, 2000));
    }

    try {
      await login({ scope, prompt, loginHint, acrValues });
      // Page will redirect — no further UI update needed
    } catch (err) {
      showScopeResult(`❌ Login failed: ${err.message}`, true);
    }
  });

  function showScopeResult(msg, isError = false) {
    scopeResult.textContent = msg;
    scopeResult.className = `result-box ${isError ? "result-error" : "result-ok"}`;
    scopeResult.hidden = false;
    setTimeout(() => (scopeResult.hidden = true), 4000);
  }
}

// ── Introspection ─────────────────────────────────────────

function wireUpIntrospection(user) {
  const tokenInput = document.getElementById("debug-introspect-token");
  const resultContainer = document.getElementById("introspect-result");
  const outputPre = document.getElementById("introspect-output");

  document.getElementById("btn-use-access-token").addEventListener("click", () => {
    tokenInput.value = user?.access_token ?? "";
  });

  document.getElementById("btn-introspect").addEventListener("click", async () => {
    const token = tokenInput.value.trim() || user?.access_token;

    if (!token) {
      outputPre.textContent = "No token available. Log in first or paste a token above.";
      resultContainer.hidden = false;
      return;
    }

    outputPre.textContent = "⏳ Introspecting...";
    resultContainer.hidden = false;

    try {
      const result = await introspectToken(token);
      outputPre.textContent = JSON.stringify(result, null, 2);

      // Highlight inactive tokens clearly
      if (result.active === false) {
        outputPre.style.color = "#ff8a8a";
        outputPre.textContent = "// ⚠️ Token is NOT active (expired or revoked)\n\n"
          + JSON.stringify(result, null, 2);
      } else {
        outputPre.style.color = "";
      }
    } catch (err) {
      outputPre.style.color = "#ff8a8a";
      outputPre.textContent = `Error: ${err.message}`;
    }
  });
}

// ── Roles viewer ──────────────────────────────────────────

/**
 * Zitadel returns roles in the access token under a claim like:
 * "urn:zitadel:iam:org:project:roles" → { "role-name": { "orgId": "orgName" } }
 *
 * This renders all role-like claims in a human readable table.
 */
function renderRoles(user) {
  const container = document.getElementById("roles-container");

  if (!user) {
    container.innerHTML = `<p class="hint">Log in to view roles.</p>`;
    return;
  }

  // Collect all claims that look like Zitadel role claims
  const allClaims = {
    ...user.profile,
    // Access token payload claims (if it's a JWT we decoded)
  };

  const roleClaims = Object.entries(allClaims).filter(([key]) =>
    key.includes("role") || key.includes("zitadel")
  );

  if (roleClaims.length === 0) {
    container.innerHTML = `
      <p class="hint">
        No role claims found in the ID token. To see roles, re-login with scope:<br/>
        <code>openid profile email urn:zitadel:iam:org:project:roles</code><br/><br/>
        Make sure your user has roles assigned in the Zitadel project.
      </p>
    `;
    return;
  }

  const rows = roleClaims.map(([claim, value]) => {
    const isRoleObject = typeof value === "object" && value !== null;

    // Zitadel role format: { "roleName": { "orgId": "orgName" } }
    const roleRows = isRoleObject
      ? Object.entries(value).map(([role, orgs]) => `
          <tr>
            <td class="claim-key">${role}</td>
            <td><pre>${JSON.stringify(orgs, null, 2)}</pre></td>
          </tr>
        `).join("")
      : `<tr><td class="claim-key">${claim}</td><td>${String(value)}</td></tr>`;

    return `
      <div style="margin-bottom: 1.5rem;">
        <h4 style="color: #4f8ef7; margin-bottom: 0.5rem;">${claim}</h4>
        <table class="claims-table">
          <thead><tr><th>Role</th><th>Org assignment</th></tr></thead>
          <tbody>${roleRows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  container.innerHTML = rows;
}

