// ============================================================
// Camada de rede do cliente (WebSocket + JSON)
// ============================================================
export class Net {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
    this.open = false;
  }

  on(type, fn) { this.handlers.set(type, fn); }

  connect(name) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}`);
    this.ws.onopen = () => {
      this.open = true;
      this.send({ t: 'join', name });
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
