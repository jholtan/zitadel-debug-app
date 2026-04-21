const DEFAULTS = {
  issuer: "https://auth.example.com",
  clientId: "123123123123123123",
  redirectUri: `${window.location.origin}/callback.html`,
  postLogoutRedirectUri: window.location.origin,
  scope: "openid profile email",
};

/**
 * Priority order:
 *  1. localStorage overrides  (set via Config Panel)
 *  2. window.__ZITADEL_CONFIG__ (injected at container start from env vars)
 *  3. DEFAULTS (hardcoded fallback)
 */
export function getConfig() {
  const injected = window.__ZITADEL_CONFIG__ ?? {};
  const overrides = JSON.parse(localStorage.getItem("zitadel_debug_config") || "{}");
  return { ...DEFAULTS, ...injected, ...overrides };
}

export function saveConfig(overrides) {
  localStorage.setItem("zitadel_debug_config", JSON.stringify(overrides));
}

export function resetConfig() {
  localStorage.removeItem("zitadel_debug_config");
}

