import { getConfig } from "./config.js";

export const TOKEN_TYPES = {
  ACCESS_TOKEN: "urn:ietf:params:oauth:token-type:access_token",
  REFRESH_TOKEN: "urn:ietf:params:oauth:token-type:refresh_token",
  ID_TOKEN: "urn:ietf:params:oauth:token-type:id_token",
  SAML1: "urn:ietf:params:oauth:token-type:saml1",
  SAML2: "urn:ietf:params:oauth:token-type:saml2",
  JWT: "urn:ietf:params:oauth:token-type:jwt",
};

export const TOKEN_TYPE_LABELS = {
  [TOKEN_TYPES.ACCESS_TOKEN]: "Access Token",
  [TOKEN_TYPES.REFRESH_TOKEN]: "Refresh Token",
  [TOKEN_TYPES.ID_TOKEN]: "ID Token",
  [TOKEN_TYPES.SAML1]: "SAML 1.1",
  [TOKEN_TYPES.SAML2]: "SAML 2.0",
  [TOKEN_TYPES.JWT]: "JWT",
};

export const GRANT_TYPE = "urn:ietf:params:oauth:grant-type:token-exchange";

export function buildRequestBody(params) {
  const config = getConfig();

  const body = new URLSearchParams();

  // Always required
  body.set("grant_type", GRANT_TYPE);
  body.set("client_id", config.clientId);
  body.set("subject_token", params.subjectToken.trim());
  body.set("subject_token_type", params.subjectTokenType);

  // Optional — only append if provided
  if (params.actorToken?.trim())
    body.set("actor_token", params.actorToken.trim());
  if (params.actorTokenType?.trim())
    body.set("actor_token_type", params.actorTokenType.trim());
  if (params.requestedTokenType?.trim())
    body.set("requested_token_type", params.requestedTokenType.trim());
  if (params.scope?.trim())
    body.set("scope", params.scope.trim());
  if (params.audience?.trim())
    body.set("audience", params.audience.trim());
  if (params.resource?.trim())
    body.set("resource", params.resource.trim());

  return body;
}

export async function performTokenExchange(params) {
  const config = getConfig();
  const url = `${config.issuer}/oauth/v2/token`;
  const body = buildRequestBody(params);

  const requestHeaders = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  // Snapshot the request before sending — we want to record it
  // exactly as sent, even if the request fails
  const requestSnapshot = {
    url,
    method: "POST",
    headers: requestHeaders,
    body: Object.fromEntries(body.entries()),
  };

  const startTime = performance.now();

  let rawResponse;
  try {
    rawResponse = await fetch(url, {
      method: "POST",
      headers: requestHeaders,
      body,
    });
  } catch (networkErr) {
    // Network-level failure (DNS, CORS, offline)
    return {
      request: requestSnapshot,
      response: {
        status: 0,
        statusText: "Network Error",
        durationMs: Math.round(performance.now() - startTime),
        headers: {},
        body: `Network error: ${networkErr.message}`,
        ok: false,
      },
    };
  }

  const durationMs = Math.round(performance.now() - startTime);

  // Capture response headers
  const responseHeaders = {};
  rawResponse.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  // Parse body — always attempt JSON, fall back to text
  let responseBody;
  const contentType = rawResponse.headers.get("content-type") ?? "";
  try {
    responseBody = contentType.includes("json")
      ? await rawResponse.json()
      : await rawResponse.text();
  } catch {
    responseBody = "[Failed to parse response body]";
  }

  return {
    request: requestSnapshot,
    response: {
      status: rawResponse.status,
      statusText: rawResponse.statusText,
      durationMs,
      headers: responseHeaders,
      body: responseBody,
      ok: rawResponse.ok,
    },
  };
}

export function validateExchangeParams(params) {
  const errors = [];

  if (!params.subjectToken?.trim())
    errors.push("Subject token is required.");

  if (!params.subjectTokenType?.trim())
    errors.push("Subject token type is required.");

  // If an actor token is provided, its type must also be provided
  if (params.actorToken?.trim() && !params.actorTokenType?.trim())
    errors.push("Actor token type is required when an actor token is provided.");

  if (params.actorTokenType?.trim() && !params.actorToken?.trim())
    errors.push("Actor token is required when an actor token type is provided.");

  return errors;
}

export function exportAsCurl(requestSnapshot) {
  const { url, body } = requestSnapshot;

  const flags = Object.entries(body).map(
    ([k, v]) => `  -d "${k}=${escapeShell(v)}"`
  );

  return [
    `curl -X POST "${url}" \\`,
    `  -H "Content-Type: application/x-www-form-urlencoded" \\`,
    ...flags.slice(0, -1).map((f) => f + " \\"),
    flags[flags.length - 1],
  ].join("\n");
}

function escapeShell(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function downloadAsJson(result) {
  const bundle = {
    timestamp: new Date().toISOString(),
    tool: "Zitadel Debug Tool — RFC 8693 Token Exchange",
    request: result.request,
    response: result.response,
  };

  const blob = new Blob(
    [JSON.stringify(bundle, null, 2)],
    { type: "application/json" }
  );

  const filename = `token-exchange-${Date.now()}.json`;

  triggerDownload(blob, filename);
}

/**
 * Programmatically trigger a file download in the browser.
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
