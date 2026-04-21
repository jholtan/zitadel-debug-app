import { handleCallback } from "./auth.js";

const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const detailEl = document.getElementById("detail");

detailEl.textContent = `Callback URL:\n${window.location.href}`;

try {
  const user = await handleCallback();

  statusEl.textContent = "✅ Login successful! Redirecting...";

  await new Promise((resolve) => setTimeout(resolve, 800));
  window.location.replace("/");
} catch (err) {
  statusEl.textContent = "❌ Login failed!";
  errorEl.textContent = formatError(err);
  console.error("[callback] Token exchange failed:", err);
}

function formatError(err) {
  const lines = [];

  if (err?.error) lines.push(`error:             ${err.error}`);
  if (err?.error_description) lines.push(`error_description: ${err.error_description}`);

  lines.push(`message: ${err?.message ?? "Unknown error"}`);

  if (err?.stack) lines.push(`\nstack:\n${err.stack}`);

  return lines.join("\n");
}
