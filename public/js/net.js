// ============================================================
// Camada de rede do cliente (WebSocket + JSON + API REST)
// ============================================================
const API_HOST = window.SF_API_HOST || location.host;
const API_BASE = `${location.protocol === 'https:' ? 'https' : 'http'}://${API_HOST}/api`;

export async function api(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'request_failed'), { code: data.error, status: res.status });
  return data;
}

export async function apiGet(path, token) {
  return apiAuth('GET', path, token);
}

export async function apiAuth(method, path, token, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'request_failed'), { code: data.error, status: res.status });
  return data;
}

export class Net {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
    this.open = false;
  }

  on(type, fn) { this.handlers.set(type, fn); }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${API_HOST}`);
    this.ws.onopen = () => {
      this.open = true;
      const h = this.handlers.get('_open');
      if (h) h();
    };
    this.ws.onmessage = ev => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      const h = this.handlers.get(msg.t);
      if (h) h(msg);
    };
    this.ws.onclose = () => {
      this.open = false;
      const h = this.handlers.get('_close');
      if (h) h();
    };
  }

  send(obj) {
    if (this.open && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }
}
