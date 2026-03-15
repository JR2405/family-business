// redirect if logged
fetch('/api/me')
  .then(r => r.json())
  .then(d => {
    if (d && d.usuario) window.location.href = '/dashboard';
  })
  .catch(() => {});

document.getElementById('password').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

document.getElementById('loginBtn').addEventListener('click', doLogin);

async function doLogin() {
  const usuario = document.getElementById('usuario').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('errorMsg');

  if (!usuario || !password) {
    err.style.display = 'block';
    err.textContent = 'Completa todos los campos';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  err.style.display = 'none';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password })
    });

    const data = await res.json();

    if (data.ok) {
      window.location.href = '/dashboard';
    } else {
      err.style.display = 'block';
      err.textContent = data.error || 'Credenciales incorrectas';
      btn.disabled = false;
      btn.innerHTML = 'Entrar';
    }

  } catch {
    err.style.display = 'block';
    err.textContent = 'Error de conexión';
    btn.disabled = false;
    btn.innerHTML = 'Entrar';
  }
}