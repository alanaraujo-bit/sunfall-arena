// ============================================================
// NOVIDADES — cliente da API da Central da Comunidade
// Reações/favoritos (funcionam logado ou como convidado, via
// header x-sf-anon) e envio de sugestões/bugs.
// ============================================================
import { anonId } from './store.js';

const API_HOST = window.SF_API_HOST || location.host;
const API_BASE = `${location.protocol === 'https:' ? 'https' : 'http'}://${API_HOST}/api`;

let getAuth = () => null;
export function bindAuth(fn) { getAuth = fn; }

function headers(hasBody) {
  const h = { 'x-sf-anon': anonId() };
  const auth = getAuth();
  if (auth?.token) h.Authorization = `Bearer ${auth.token}`;
  if (hasBody) h['Content-Type'] = 'application/json';
  return h;
}

async function request(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: headers(!!body),
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'request_failed'), { code: data.error, status: res.status });
  return data;
}

export const fetchSocial = () => request('GET', '/patchnotes/social');
export const react = (patchId, emoji, on) => request('POST', `/patchnotes/${encodeURIComponent(patchId)}/react`, { emoji, on });
export const favorite = (patchId, on) => request('POST', `/patchnotes/${encodeURIComponent(patchId)}/favorite`, { on });
export const sendSuggestion = data => request('POST', '/community/suggestion', data);
export const sendBug = data => request('POST', '/community/bug', data);
