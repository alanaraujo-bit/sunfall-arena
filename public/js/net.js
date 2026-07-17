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

export async function apiPublicGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'request_failed'), { code: data.error, status: res.status });
  return data;
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
    this._retries = 0;
    this._maxRetries = 20;
    this._reconnecting = false;
    this._reconnectTimer = null;
  }

  on(type, fn) { this.handlers.set(type, fn); }

  connect() {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${API_HOST}`);
    this.ws.onopen = () => {
      this.open = true;
      this._retries = 0;
      this._reconnecting = false;
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
      this._autoReconnect();
    };
    this.ws.onerror = () => {}; // onclose will fire after onerror
  }

  _autoReconnect() {
    if (this._reconnecting) return;
    if (this._retries >= this._maxRetries) {
      const h = this.handlers.get('_reconnect_failed');
      if (h) h();
      return;
    }
    this._reconnecting = true;
    this._retries++;
    // exponential backoff: 1s, 2s, 4s, 8s, max 15s + small jitter
    const delay = Math.min(15000, 1000 * Math.pow(2, this._retries - 1)) + Math.random() * 500;
    const h = this.handlers.get('_reconnect_status');
    if (h) h({ attempt: this._retries, max: this._maxRetries, delay });
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => {
      this._reconnecting = false;
      this.connect();
    }, delay);
  }

  send(obj) {
    if (this.open && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }
}
