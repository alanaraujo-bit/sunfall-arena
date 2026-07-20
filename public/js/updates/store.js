// ============================================================
// NOVIDADES — estado local e coleta de informações do sistema
// localStorage: identidade anônima (reações de convidado), notas
// lidas (selo NOVO) e cache de favoritos. Também coleta os dados
// técnicos usados pelo formulário de bug (plataforma, resolução,
// GPU, FPS medido na hora e log de erros da sessão).
// ============================================================

const KEY_ANON = 'sf_anon_id';
const KEY_READ = 'sf_pn_read';
const KEY_FAV = 'sf_pn_fav';

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// UUID estável por navegador — permite a convidados reagir/favoritar
// sem conta, mantendo unicidade por pessoa no servidor.
export function anonId() {
  let id = localStorage.getItem(KEY_ANON);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    try { localStorage.setItem(KEY_ANON, id); } catch {}
  }
  return id;
}

// ---- notas lidas (controla o selo NOVO) ----
export function getReadSet() { return new Set(readJson(KEY_READ, [])); }
export function markRead(id) {
  const set = getReadSet();
  if (set.has(id)) return false;
  set.add(id);
  writeJson(KEY_READ, [...set]);
  return true;
}

// ---- cache local de favoritos (UI instantânea; servidor é a verdade) ----
export function getLocalFavs() { return readJson(KEY_FAV, []); }
export function setLocalFavs(list) { writeJson(KEY_FAV, list); }

// ---- coleta de dados técnicos (reporte de bug) ----

export function detectPlatform() {
  const ua = navigator.userAgent;
  let os = 'Desconhecido';
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  let browser = 'Navegador';
  let m;
  if ((m = ua.match(/Edg\/([\d.]+)/))) browser = `Edge ${m[1].split('.')[0]}`;
  else if ((m = ua.match(/OPR\/([\d.]+)/))) browser = `Opera ${m[1].split('.')[0]}`;
  else if ((m = ua.match(/Chrome\/([\d.]+)/))) browser = `Chrome ${m[1].split('.')[0]}`;
  else if ((m = ua.match(/Firefox\/([\d.]+)/))) browser = `Firefox ${m[1].split('.')[0]}`;
  else if ((m = ua.match(/Version\/([\d.]+).*Safari/))) browser = `Safari ${m[1].split('.')[0]}`;
  return `${os} · ${browser}`;
}

export function getGpuInfo() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 'WebGL indisponível';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const raw = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    // limpa o wrapper ANGLE do Chrome/Edge: "ANGLE (Vendor, GPU..., Driver)"
    const angle = String(raw).match(/^ANGLE \((.+)\)$/);
    return angle ? angle[1].split(',').slice(0, 2).join(',').trim() : String(raw);
  } catch { return 'GPU não identificada'; }
}

export function collectSysInfo() {
  const dpr = window.devicePixelRatio || 1;
  const cores = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} núcleos` : '';
  const mem = navigator.deviceMemory ? `${navigator.deviceMemory}GB RAM` : '';
  return {
    platform: detectPlatform(),
    resolution: `${Math.round(innerWidth * dpr)}×${Math.round(innerHeight * dpr)}`,
    monitor: `${screen.width}×${screen.height} @${dpr}x`,
    hardware: [getGpuInfo(), cores, mem].filter(Boolean).join(' · ')
  };
}

// Mede o FPS real agora, contando frames por ~1 segundo
export function measureFps(ms = 1000) {
  return new Promise(resolve => {
    let frames = 0;
    const start = performance.now();
    function tick(now) {
      frames++;
      if (now - start >= ms) resolve(Math.round(frames * 1000 / (now - start)));
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

// Erros de runtime da sessão (o jogo já acumula em #errlog)
export function getErrorLogs() {
  const text = document.getElementById('errlog')?.textContent || '';
  return text.trim().slice(-3000);
}
