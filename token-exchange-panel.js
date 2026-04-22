import {
  TOKEN_TYPES,
  TOKEN_TYPE_LABELS,
  performTokenExchange,
  validateExchangeParams,
  exportAsCurl,
  downloadAsJson,
} from "./token-exchange.js";
import { renderTokenCard } from "./token-inspector.js";

function tokenTypeOptions(selectedValue = TOKEN_TYPES.ACCESS_TOKEN) {
  return Object.entries(TOKEN_TYPE_LABELS).map(([value, label]) => `
    <option value="${value}" ${value === selectedValue ? "selected" : ""}>
      ${label} — ${value}
    </option>
  `).join("");
}

export function renderTokenExchangePanel(container, user) {
  container.innerHTML = `

    <!-- ── Input form ──────────────────────────────────── -->
    <div class="debug-panel">
      <div class="te-grid">

        <!-- Subject Token -->
        <div class="te-token-block">
          <div class="te-block-header">
            <h4>Subject Token <span class="te-required">*</span></h4>
            <button
              id="te-use-subject-token"
              class="btn btn-secondary"
              ${!user?.access_token ? "disabled title='No active session'" : ""}
            >
              Use current access token
            </button>
          </div>
          <textarea
            id="te-subject-token"
            class="te-textarea"
            rows="5"
            placeholder="Paste a token here or click 'Use current access token'..."
            spellcheck="false"
          ></textarea>
          <label class="te-label">
            subject_token_type
            <select id="te-subject-token-type" class="te-select">
              ${tokenTypeOptions(TOKEN_TYPES.ACCESS_TOKEN)}
            </select>
          </label>
        </div>

        <!-- Actor Token -->
        <div class="te-token-block">
          <div class="te-block-header">
            <h4>Actor Token <span class="te-optional">(optional)</span></h4>
            <button
              id="te-use-actor-token"
              class="btn btn-secondary"
              ${!user?.access_token ? "disabled title='No active session'" : ""}
            >
              Use current access token
            </button>
          </div>
          <textarea
            id="te-actor-token"
            class="te-textarea"
            rows="5"
            placeholder="Only needed for delegation / impersonation flows..."
            spellcheck="false"
          ></textarea>
          <label class="te-label">
            actor_token_type
            <select id="te-actor-token-type" class="te-select">
              <option value="">— none —</option>
              ${tokenTypeOptions(TOKEN_TYPES.ACCESS_TOKEN)}
            </select>
          </label>
        </div>

        <!-- requested_token_type -->
        <div class="te-field">
          <label class="te-label">
            requested_token_type
            <select id="te-requested-token-type" class="te-select">
              <option value="">— none (server decides) —</option>
              ${tokenTypeOptions("")}
            </select>
          </label>
          <span class="field-hint">
            The type of token you want back. Leave blank to let Zitadel decide.
          </span>
        </div>

        <!-- scope -->
        <div class="te-field">
          <label class="te-label">
            scope
            <input
              id="te-scope"
              type="text"
              class="te-input"
              placeholder="openid profile email"
            />
          </label>
          <span class="field-hint">
            Space-separated. Leave blank to inherit the subject token's scopes.
          </span>
        </div>

        <!-- audience -->
        <div class="te-field">
          <label class="te-label">
            audience
            <input
              id="te-audience"
              type="text"
              class="te-input"
              placeholder="https://my-api.example.com"
            />
          </label>
          <span class="field-hint">
            Target service the exchanged token should be valid for.
          </span>
        </div>

        <!-- resource -->
        <div class="te-field">
          <label class="te-label">
            resource
            <input
              id="te-resource"
              type="text"
              class="te-input"
              placeholder="https://my-api.example.com/resource"
            />
          </label>
          <span class="field-hint">
            URI of the specific resource being requested (RFC 8707).
          </span>
        </div>

      </div>

      <!-- Validation errors -->
      <div id="te-validation-errors" class="result-box result-error" hidden></div>

      <!-- Actions -->
      <div class="action-row" style="margin-top: 1.25rem;">
        <button id="te-btn-exchange" class="btn btn-primary">🔁 Exchange Token</button>
        <button id="te-btn-clear"    class="btn btn-secondary">Clear</button>
      </div>
    </div>

    <!-- ── Request inspector ────────────────────────────── -->
    <div id="te-request-panel" class="debug-panel te-result-panel" hidden>
      <div class="te-result-header">
        <h3>📤 Request</h3>
        <div class="action-row">
          <button id="te-btn-copy-curl"     class="btn btn-secondary">Copy as curl</button>
          <button id="te-btn-download-json" class="btn btn-secondary">⬇ Download JSON</button>
        </div>
      </div>

      <div class="te-meta-row">
        <span class="te-method">POST</span>
        <span id="te-request-url" class="te-url"></span>
      </div>

      <h4 style="margin: 0.75rem 0 0.4rem;">Form body</h4>
      <pre id="te-request-body"></pre>
    </div>

    <!-- ── Response inspector ───────────────────────────── -->
    <div id="te-response-panel" class="debug-panel te-result-panel" hidden>
      <div class="te-result-header">
        <h3>📥 Response</h3>
        <div id="te-response-meta" class="te-meta-row"></div>
      </div>

      <h4 style="margin: 0.75rem 0 0.4rem;">Body</h4>
      <pre id="te-response-body"></pre>

      <div id="te-response-headers-section" style="margin-top: 1rem;">
        <button id="te-btn-toggle-headers" class="btn btn-secondary" style="font-size:0.78rem;">
          Show response headers
        </button>
        <pre id="te-response-headers" hidden></pre>
      </div>
    </div>

    <!-- ── Exchanged token inspector ────────────────────── -->
    <div id="te-token-panel" class="debug-panel te-result-panel" hidden>
      <h3>🪙 Exchanged Token</h3>
      <p class="hint">Decoded from the <code>access_token</code> or <code>id_token</code> in the response.</p>
      <div id="te-exchanged-token-card"></div>
    </div>

  `;

  wireUpPanel(user);
}

function wireUpPanel(user) {

  // "Use current" buttons
  document.getElementById("te-use-subject-token").addEventListener("click", () => {
    document.getElementById("te-subject-token").value = user?.access_token ?? "";
  });

  document.getElementById("te-use-actor-token").addEventListener("click", () => {
    document.getElementById("te-actor-token").value = user?.access_token ?? "";
  });

  // Clear
  document.getElementById("te-btn-clear").addEventListener("click", () => {
    document.getElementById("te-subject-token").value = "";
    document.getElementById("te-actor-token").value = "";
    document.getElementById("te-scope").value = "";
    document.getElementById("te-audience").value = "";
    document.getElementById("te-resource").value = "";
    document.getElementById("te-subject-token-type").selectedIndex = 0;
    document.getElementById("te-actor-token-type").selectedIndex = 0;
    document.getElementById("te-requested-token-type").selectedIndex = 0;
    document.getElementById("te-validation-errors").hidden = true;
    document.getElementById("te-request-panel").hidden = true;
    document.getElementById("te-response-panel").hidden = true;
    document.getElementById("te-token-panel").hidden = true;
  });

  // Exchange
  document.getElementById("te-btn-exchange").addEventListener("click", () =>
    handleExchange()
  );

  // Toggle response headers
  document.getElementById("te-btn-toggle-headers").addEventListener("click", (e) => {
    const headersEl = document.getElementById("te-response-headers");
    const isHidden = headersEl.hidden;
    headersEl.hidden = !isHidden;
    e.target.textContent = isHidden ? "Hide response headers" : "Show response headers";
  });
}

// ── Exchange handler ──────────────────────────────────────


async function handleExchange() {
  const params = readFormValues();

  // Validate
  const errors = validateExchangeParams(params);
  const validationEl = document.getElementById("te-validation-errors");
  if (errors.length) {
    validationEl.innerHTML = errors.map((e) => `<div>⚠️ ${e}</div>`).join("");
    validationEl.hidden = false;
    return;
  }
  validationEl.hidden = true;

  // Disable button + show loading state
  const exchangeBtn = document.getElementById("te-btn-exchange");
  exchangeBtn.disabled = true;
  exchangeBtn.textContent = "⏳ Exchanging...";

  try {
    const result = await performTokenExchange(params);

    renderRequestPanel(result.request);
    renderResponsePanel(result.response);
    renderExchangedTokenPanel(result.response);
    wireUpExportButtons(result);

  } finally {
    exchangeBtn.disabled = false;
    exchangeBtn.textContent = "🔁 Exchange Token";
  }
}

// ── Form reader ─────────────────────────────────────────────

function readFormValues() {
  return {
    subjectToken: document.getElementById("te-subject-token").value,
    subjectTokenType: document.getElementById("te-subject-token-type").value,
    actorToken: document.getElementById("te-actor-token").value,
    actorTokenType: document.getElementById("te-actor-token-type").value,
    requestedTokenType: document.getElementById("te-requested-token-type").value,
    scope: document.getElementById("te-scope").value,
    audience: document.getElementById("te-audience").value,
    resource: document.getElementById("te-resource").value,
  };
}

// ── Request panel ─────────────────────────────────────────

function renderRequestPanel(request) {
  const panel = document.getElementById("te-request-panel");

  document.getElementById("te-request-url").textContent = request.url;

  // Render form body as annotated key: value lines
  const bodyLines = Object.entries(request.body).map(([k, v]) => {
    // Truncate long token values in the display (full value goes to exports)
    const display = isTokenField(k) && v.length > 80
      ? `${v.slice(0, 40)}…${v.slice(-20)}`
      : v;
    return `${k}: ${display}`;
  }).join("\n");

  document.getElementById("te-request-body").textContent = bodyLines;

  panel.hidden = false;
}

// ── Response panel ────────────────────────────────────────

function renderResponsePanel(response) {
  const panel = document.getElementById("te-response-panel");
  const metaEl = document.getElementById("te-response-meta");
  const bodyEl = document.getElementById("te-response-body");
  const headersEl = document.getElementById("te-response-headers");

  // Status badge
  const statusClass = response.ok ? "te-status-ok" : "te-status-error";
  metaEl.innerHTML = `
    <span class="te-status ${statusClass}">${response.status} ${response.statusText}</span>
    <span class="te-duration">${response.durationMs}ms</span>
  `;

  // Body
  const bodyText = typeof response.body === "object"
    ? JSON.stringify(response.body, null, 2)
    : String(response.body);

  bodyEl.textContent = bodyText;
  bodyEl.style.color = response.ok ? "" : "#ff8a8a";

  // Annotate well-known RFC 8693 response fields inline
  if (response.ok && typeof response.body === "object") {
    bodyEl.textContent = annotateResponseBody(response.body);
  }

  // Response headers
  headersEl.textContent = JSON.stringify(response.headers, null, 2);

  // Reset header toggle
  headersEl.hidden = true;
  document.getElementById("te-btn-toggle-headers").textContent = "Show response headers";

  panel.hidden = false;
}

/**
 * Annotate well-known RFC 8693 response fields with inline comments.
 */
function annotateResponseBody(body) {
  const ANNOTATIONS = {
    access_token: "// The exchanged token",
    issued_token_type: "// Type of the returned token (RFC 8693 URN)",
    token_type: "// Always 'Bearer' for access tokens",
    expires_in: "// Seconds until expiry",
    scope: "// Granted scopes (may differ from requested)",
    refresh_token: "// Refresh token (if granted)",
    // Error fields
    error: "// OAuth2 error code",
    error_description: "// Human-readable error detail",
  };

  const lines = JSON.stringify(body, null, 2).split("\n");

  return lines.map((line) => {
    const match = line.match(/^\s*"([^"]+)":/);
    if (match && ANNOTATIONS[match[1]]) {
      return `${line}  ${ANNOTATIONS[match[1]]}`;
    }
    return line;
  }).join("\n");
}

// ── Exchanged token panel ─────────────────────────────────

function renderExchangedTokenPanel(response) {
  const panel = document.getElementById("te-token-panel");
  const cardEl = document.getElementById("te-exchanged-token-card");

  if (!response.ok || typeof response.body !== "object") {
    panel.hidden = true;
    return;
  }

  // Prefer access_token, fall back to id_token
  const token = response.body.access_token ?? response.body.id_token ?? null;
  const label = response.body.access_token ? "Exchanged Access Token" : "Exchanged ID Token";

  renderTokenCard(cardEl, label, token);

  panel.hidden = false;
}

// ── Export wiring ─────────────────────────────────────────

function wireUpExportButtons(result) {

  // Copy as curl
  const curlBtn = document.getElementById("te-btn-copy-curl");
  // Remove old listener by replacing the element clone
  const newCurlBtn = curlBtn.cloneNode(true);
  curlBtn.parentNode.replaceChild(newCurlBtn, curlBtn);

  newCurlBtn.addEventListener("click", async () => {
    const curlCmd = exportAsCurl(result.request);
    await navigator.clipboard.writeText(curlCmd);
    newCurlBtn.textContent = "✅ Copied!";
    setTimeout(() => (newCurlBtn.textContent = "Copy as curl"), 2000);
  });

  // Download JSON
  const jsonBtn = document.getElementById("te-btn-download-json");
  const newJsonBtn = jsonBtn.cloneNode(true);
  jsonBtn.parentNode.replaceChild(newJsonBtn, jsonBtn);

  newJsonBtn.addEventListener("click", () => {
    downloadAsJson(result);
    newJsonBtn.textContent = "✅ Downloading...";
    setTimeout(() => (newJsonBtn.textContent = "⬇ Download JSON"), 2000);
  });
}

// ── Helpers ───────────────────────────────────────────────

function isTokenField(key) {
  return ["subject_token", "actor_token", "access_token",
    "refresh_token", "id_token"].includes(key);
}

