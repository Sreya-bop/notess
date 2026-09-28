/**
 * api.js
 *
 * Thin wrapper around the backend API. Keeps the fetch/error-shape logic
 * in one place so components stay focused on rendering.
 */

/**
 * Works out the backend's base URL.
 *  - If VITE_API_BASE_URL is set at build time, always use that.
 *  - Otherwise, if we're running inside a GitHub Codespace's forwarded
 *    frontend URL (e.g. "my-codespace-5173.app.github.dev"), derive the
 *    matching backend URL by swapping the port number in the hostname
 *    (e.g. "my-codespace-5050.app.github.dev"). Codespaces gives each
 *    forwarded port its own subdomain following this exact pattern.
 *  - Otherwise, fall back to plain localhost for normal local development.
 */
function inferApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  const { hostname, protocol } = window.location;
  const codespacesPortMatch = hostname.match(/^(.*)-5173(\..+)$/);
  if (codespacesPortMatch) {
    const [, prefix, suffix] = codespacesPortMatch;
    return `${protocol}//${prefix}-5050${suffix}`;
  }

  return 'http://localhost:5050';
}

const API_BASE_URL = inferApiBaseUrl();

/**
 * Uploads a PDF file and returns the generated study pack.
 * @param {File} file
 * @returns {Promise<object>} study pack: { fileName, pageCount, sections, keyConcepts, flashcards, meta }
 */
export async function processPdf(file) {
  const formData = new FormData();
  formData.append('pdf', file);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/process`, {
      method: 'POST',
      body: formData,
    });
  } catch (networkErr) {
    throw new Error(
      `Could not reach the backend at ${API_BASE_URL}. Make sure the server is running.`
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('The server returned an unexpected response.');
  }

  if (!response.ok) {
    throw new Error(payload.error || 'Something went wrong while processing your PDF.');
  }

  return payload;
}

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
