// ── UTILITIES ──────────────────────────────────────────────────

const fmt = (n) => {
  const num = parseFloat(n) || 0;
  return (num < 0 ? '-$' : '$') + Math.abs(num).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const today = () => new Date().toISOString().slice(0, 10);

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (res.status === 401) {
    window.location.href = '/';
    return;
  }
  return res.json();
}

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
    background:${type === 'success' ? '#4ade80' : '#f87171'};
    color:#0f0f13;padding:10px 20px;border-radius:8px;font-weight:700;
    font-family:Syne,sans-serif;font-size:13px;z-index:9999;
    white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.4);
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// Close modal on backdrop click
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', (e) => {
    if (e.target === el) closeModal(el.id);
  });
});

async function checkAuth() {
  try {
    const data = await api('GET', '/api/me');
    if (!data || data.error) { window.location.href = '/'; }
    return data;
  } catch {
    window.location.href = '/';
  }
}

// Set active nav link
document.querySelectorAll('.nav a').forEach(a => {
  if (a.href.includes(window.location.pathname.replace('/', ''))) {
    a.classList.add('active');
  }
});
