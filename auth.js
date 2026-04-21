import { UserManager, WebStorageStateStore } from "oidc-client-ts";
import { getConfig } from "./config.js";

export function createUserManager() {
  const config = getConfig();

  return new UserManager({
    authority: config.issuer,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    post_logout_redirect_uri: config.postLogoutRedirectUri,
    scope: config.scope,

    response_type: "code",
    automaticSilentRenew: false,
    filterProtocolClaims: false,

    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  });
}

export async function getUser() {
  const mgr = createUserManager();
  const user = await mgr.getUser();
  if (!user || user.expired) return null;
  return user;
}

export async function login({ scope, prompt, loginHint, acrValues } = {}) {
  const mgr = createUserManager();

  const extraQueryParams = {};
  if (acrValues) extraQueryParams.acr_values = acrValues;
  await mgr.signinRedirect({
    ...(scope && { scope }),
    ...(prompt && { prompt }),
    ...(loginHint && { login_hint: loginHint }),
    ...(Object.keys(extraQueryParams).length && { extraQueryParams }),
  });
}

export async function handleCallback() {
  const mgr = createUserManager();
  return await mgr.signinRedirectCallback();
}

export async function refreshTokens() {
  const mgr = createUserManager();
  return await mgr.signinSilent();
}

export async function revokeAccessToken() {
  const mgr = createUserManager();
  const user = await mgr.getUser();
  if (!user) throw new Error("No active session to revoke.");
  await mgr.revokeTokens(["access_token"]);
}

export async function revokeRefreshToken() {
  const mgr = createUserManager();
  const user = await mgr.getUser();
  if (!user) throw new Error("No active session to revoke.");
  await mgr.revokeTokens(["refresh_token"]);
}

export async function logoutLocal() {
  const mgr = createUserManager();
  await mgr.removeUser();
}

export async function logoutSSO() {
  const mgr = createUserManager();
  await mgr.signoutRedirect();
}
