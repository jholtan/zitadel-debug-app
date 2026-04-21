export function decodeJwt(token) {
  if (!token) return null;

  try {
    const [headerB64, payloadB64] = token.split(".");
    return {
      header: JSON.parse(atob(padBase64(headerB64))),
      payload: JSON.parse(atob(padBase64(payloadB64))),
    };
  } catch (err) {
    console.warn("[token-inspector] Failed to decode JWT:", err);
    return null;
  }
}

function padBase64(str) {
  return str.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    str.length + ((4 - (str.length % 4)) % 4), "="
  );
}

export function formatExpiry(expTimestamp) {
  if (!expTimestamp) return "Never";
  const secondsLeft = Math.floor(expTimestamp - Date.now() / 1000);
  if (secondsLeft <= 0) return "⚠️ Expired";

  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function renderTokenCard(container, label, rawToken) {
  container.innerHTML = "";

  if (!rawToken) {
    container.innerHTML = `<p class="token-absent">— not present —</p>`;
    return;
  }

  const decoded = decodeJwt(rawToken);
  const isJwt = decoded !== null;
  const exp = decoded?.payload?.exp ?? null;

  container.innerHTML = `
    <div class="token-card">

      <div class="token-card-header">
        <span class="token-label">${label}</span>
        <span class="token-expiry" data-exp="${exp ?? ""}">
          ${exp ? `Expires in: ${formatExpiry(exp)}` : "No expiry claim"}
        </span>
        <button class="btn-copy" data-token="${encodeURIComponent(rawToken)}">
          Copy raw token
        </button>
      </div>

      ${isJwt ? `
        <div class="token-section">
          <h4>Header</h4>
          <pre>${JSON.stringify(decoded.header, null, 2)}</pre>
        </div>
        <div class="token-section">
          <h4>Payload</h4>
          <pre>${renderPayload(decoded.payload)}</pre>
        </div>
      ` : `
        <div class="token-section">
          <h4>Raw value (opaque token)</h4>
          <pre class="opaque">${rawToken}</pre>
        </div>
      `}

    </div>
  `;

  // Wire up copy button
  container.querySelector(".btn-copy").addEventListener("click", (e) => {
    const token = decodeURIComponent(e.target.dataset.token);
    navigator.clipboard.writeText(token);
    e.target.textContent = "Copied!";
    setTimeout(() => (e.target.textContent = "Copy raw token"), 2000);
  });
}

function renderPayload(payload) {
  const KNOWN_CLAIMS = {
    sub: "Subject (user ID)",
    iss: "Issuer",
    aud: "Audience",
    exp: "Expires at",
    iat: "Issued at",
    nbf: "Not before",
    email: "Email",
    name: "Name",
  };

  const annotated = Object.fromEntries(
    Object.entries(payload).map(([k, v]) => {
      const label = KNOWN_CLAIMS[k] ? ` // ${KNOWN_CLAIMS[k]}` : "";
      const value = ["exp", "iat", "nbf"].includes(k) && typeof v === "number"
        ? `${v}  // ${new Date(v * 1000).toISOString()}`
        : v;
      return [`${k}${label}`, value];
    })
  );

  return JSON.stringify(annotated, null, 2);
}

export function startExpiryCountdowns() {
  return setInterval(() => {
    document.querySelectorAll(".token-expiry[data-exp]").forEach((el) => {
      const exp = parseInt(el.dataset.exp, 10);
      if (!exp) return;
      el.textContent = `Expires in: ${formatExpiry(exp)}`;
    });
  }, 1000);
}

