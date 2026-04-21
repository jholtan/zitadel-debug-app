#!/bin/sh
set -e

# Write runtime config into a JS file that index.html will load.
# Environment variables are injected here by Kubernetes (via ConfigMap/Secrets).
cat <<EOF > /usr/share/nginx/html/config.runtime.js
window.__ZITADEL_CONFIG__ = {
  issuer:               "${ZITADEL_ISSUER:-}",
  clientId:             "${ZITADEL_CLIENT_ID:-}",
  redirectUri:          "${ZITADEL_REDIRECT_URI:-}",
  postLogoutRedirectUri:"${ZITADEL_POST_LOGOUT_URI:-}",
  scope:                "${ZITADEL_SCOPE:-openid profile email}"
};
EOF

exec nginx -g "daemon off;"
