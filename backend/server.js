require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { initDb, getDb } = require('./database');
const { requireAuth, login } = require('./auth');

const app = express();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Demasiados intentos, intenta luego" }
});
const PORT = process.env.PORT || 3000;

// Init DB
initDb();

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "dev_secret",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 } // 24h
}));

const frontendPath = path.join(__dirname, 'frontend');

app.use(express.static(frontendPath));


// ─── AUTH ROUTES ──────────────────────────────────────────────
app.post('/api/login', loginLimiter, (req, res) => {
  const { usuario, password } = req.body;
  const user = login(usuario, password);
  if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  req.session.userId = user.id;
  req.session.usuario = user.usuario;
  req.session.rol = user.rol;
  res.json({ ok: true, usuario: user.usuario, rol: user.rol });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ usuario: req.session.usuario, rol: req.session.rol });
});

// ─── DASHBOARD ────────────────────────────────────────────────
app.get('/api/dashboard', requireAuth, (req, res) => {
  const db = getDb();
  const today = new Date().toLocaleDateString('en-CA');
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const todayLoteria = db.prepare("SELECT COALESCE(SUM(ganancia_usuario),0) as g, COALESCE(SUM(saldo_dueno),0) as s FROM loteria WHERE fecha = ?").get(today);
  const weekLoteria = db.prepare("SELECT COALESCE(SUM(ganancia_usuario),0) as g FROM loteria WHERE fecha >= ?").get(weekAgo);
  const ownerBalance = db.prepare("SELECT COALESCE(SUM(saldo_dueno),0) as total FROM loteria").get();
  const maquinaTotal = db.prepare("SELECT COALESCE(SUM(monto),0) as total FROM maquina").get();
  const clientDebt = db.prepare("SELECT COALESCE(SUM(saldo),0) as total FROM clientes WHERE saldo > 0").get();

  res.json({
    ganancia_hoy: todayLoteria.g,
    saldo_dueno_hoy: todayLoteria.s,
    ganancia_semana: weekLoteria.g,
    saldo_dueno_total: ownerBalance.total,
    maquina_total: maquinaTotal.total,
    deuda_clientes: clientDebt.total
  });
});

// ─── ESTADÍSTICAS ─────────────────────────────────────────────
app.get('/api/stats', requireAuth, (req, res) => {

  const db = getDb();

  const today = new Date().toISOString().slice(0,10);

  // ── HOY
  const hoy = db.prepare(`
    SELECT 
      COALESCE(SUM(ganancia_usuario),0) as loteria,
      COALESCE(SUM(saldo_dueno),0) as dueno
    FROM loteria
    WHERE fecha = ?
  `).get(today);

  const maquinaHoy = db.prepare(`
    SELECT COALESCE(SUM(monto),0) as total
    FROM maquina
    WHERE fecha = ?
  `).get(today);

  // ── SEMANA (7 días)
  const semana = db.prepare(`
    SELECT COALESCE(SUM(ganancia_usuario),0) as total
    FROM loteria
    WHERE fecha >= date('now','-6 days')
  `).get();

  // ── MES REAL
  const mesLoteria = db.prepare(`
    SELECT COALESCE(SUM(ganancia_usuario),0) as total
    FROM loteria
    WHERE strftime('%Y-%m', fecha) = strftime('%Y-%m','now')
  `).get();

  const mesMaquina = db.prepare(`
    SELECT COALESCE(SUM(monto),0) as total
    FROM maquina
    WHERE strftime('%Y-%m', fecha) = strftime('%Y-%m','now')
  `).get();

  res.json({
    hoy_loteria: hoy.loteria,
    hoy_dueno: hoy.dueno,
    hoy_maquina: maquinaHoy.total,
    semana_loteria: semana.total,
    mes_loteria: mesLoteria.total,
    mes_maquina: mesMaquina.total
  });

});

// ─── LOTERIA ──────────────────────────────────────────────────
app.get('/api/loteria', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM loteria ORDER BY fecha DESC, id DESC').all();
  res.json(rows);
});

app.post('/api/loteria', requireAuth, (req, res) => {
  const db = getDb();
  let { fecha, ventas, premios } = req.body;
  ventas = parseFloat(ventas);
  premios = parseFloat(premios);

  if (isNaN(ventas) || ventas < 0 || isNaN(premios) || premios < 0) {
    return res.status(400).json({ error: "Valores inválidos" });
  }
  const ganancia_usuario = ventas * 0.15;
  const saldo_dueno = ventas - ganancia_usuario - premios;
  const result = db.prepare('INSERT INTO loteria (fecha, ventas, premios, ganancia_usuario, saldo_dueno) VALUES (?, ?, ?, ?, ?)')
    .run(fecha, ventas, premios, ganancia_usuario, saldo_dueno);
  res.json({ id: result.lastInsertRowid, fecha, ventas, premios, ganancia_usuario, saldo_dueno });
});

app.put('/api/loteria/:id', requireAuth, (req, res) => {
  const db = getDb();
  let { fecha, ventas, premios } = req.body;
  ventas = parseFloat(ventas) || 0;
  premios = parseFloat(premios) || 0;
  const ganancia_usuario = ventas * 0.15;
  const saldo_dueno = ventas - ganancia_usuario - premios;
  db.prepare('UPDATE loteria SET fecha=?, ventas=?, premios=?, ganancia_usuario=?, saldo_dueno=? WHERE id=?')
    .run(fecha, ventas, premios, ganancia_usuario, saldo_dueno, req.params.id);
  res.json({ ok: true, ganancia_usuario, saldo_dueno });
});

app.delete('/api/loteria/:id', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM loteria WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── MAQUINA ──────────────────────────────────────────────────
app.get('/api/maquina', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM maquina ORDER BY fecha DESC, id DESC').all();
  res.json(rows);
});

app.post('/api/maquina', requireAuth, (req, res) => {
  const db = getDb();
  let { fecha, monto, nota } = req.body;

  monto = parseFloat(monto);

  if (isNaN(monto) || monto <= 0) {
    return res.status(400).json({ error: "Monto inválido" });
  }

  const result = db.prepare(
    'INSERT INTO maquina (fecha, monto, nota) VALUES (?, ?, ?)'
  ).run(fecha, monto, nota || '');

  res.json({
    id: result.lastInsertRowid,
    fecha,
    monto,
    nota
  });
});

app.put('/api/maquina/:id', requireAuth, (req, res) => {
  const db = getDb();
  let { fecha, monto, nota } = req.body;
  monto = parseFloat(monto);

  if (isNaN(monto) || monto <= 0) {
    return res.status(400).json({ error: "Monto inválido" });
  }
  db.prepare('UPDATE maquina SET fecha=?, monto=?, nota=? WHERE id=?').run(fecha, monto, nota || '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/maquina/:id', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM maquina WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── CLIENTES ─────────────────────────────────────────────────
app.get('/api/clientes', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM clientes ORDER BY nombre ASC').all();
  res.json(rows);
});

app.post(
  '/api/clientes',
  requireAuth,
  body('nombre').isLength({ min: 2, max: 100 }).trim().escape(),
  (req, res) => {

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ error: "Nombre inválido" });
  }

  const db = getDb();
  const { nombre } = req.body;

  const result = db.prepare(
    'INSERT INTO clientes (nombre, saldo) VALUES (?, 0)'
  ).run(nombre);

  res.json({
    id: result.lastInsertRowid,
    nombre,
    saldo: 0
  });

});

app.put('/api/clientes/:id', requireAuth, (req, res) => {
  const db = getDb();
  const { nombre } = req.body;
  db.prepare('UPDATE clientes SET nombre=? WHERE id=?').run(nombre, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/clientes/:id', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM clientes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── MOVIMIENTOS CLIENTES ─────────────────────────────────────
app.get('/api/clientes/:id/movimientos', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM movimientos_clientes WHERE cliente_id = ? ORDER BY fecha DESC, id DESC').all(req.params.id);
  res.json(rows);
});

app.post('/api/clientes/:id/movimientos', requireAuth, (req, res) => {

  const db = getDb();

  let { tipo, monto, fecha } = req.body;

  monto = parseFloat(monto);

  if (isNaN(monto) || monto <= 0) {
    return res.status(400).json({ error: "Monto inválido" });
  }

  if (tipo !== 'deuda' && tipo !== 'pago') {
    return res.status(400).json({ error: "Tipo inválido" });
  }

  if (!fecha) {
    return res.status(400).json({ error: "Fecha requerida" });
  }

  const cliente_id = parseInt(req.params.id);

  const cliente = db.prepare(
    'SELECT id, saldo FROM clientes WHERE id = ?'
  ).get(cliente_id);

  if (!cliente) {
    return res.status(404).json({ error: "Cliente no existe" });
  }

  if (tipo === 'pago' && monto > cliente.saldo) {
    return res.status(400).json({ error: "Pago mayor que la deuda" });
  }

  const result = db.prepare('INSERT INTO movimientos_clientes (cliente_id, tipo, monto, fecha) VALUES (?, ?, ?, ?)')
    .run(cliente_id, tipo, monto, fecha);

  // Update client balance
  if (tipo === 'deuda') {
    db.prepare('UPDATE clientes SET saldo = saldo + ? WHERE id = ?').run(monto, cliente_id);
  } else if (tipo === 'pago') {
    db.prepare('UPDATE clientes SET saldo = saldo - ? WHERE id = ?').run(monto, cliente_id);
  }

  const clienteActualizado = db.prepare('SELECT saldo FROM clientes WHERE id = ?').get(cliente_id);
  res.json({ id: result.lastInsertRowid, saldo: clienteActualizado.saldo });
});

app.delete('/api/movimientos_clientes/:id', requireAuth, (req, res) => {
  const db = getDb();
  const mov = db.prepare('SELECT * FROM movimientos_clientes WHERE id = ?').get(req.params.id);
  if (!mov) return res.status(404).json({ error: 'No encontrado' });

  // Reverse balance
  if (mov.tipo === 'deuda') {
    db.prepare('UPDATE clientes SET saldo = saldo - ? WHERE id = ?').run(mov.monto, mov.cliente_id);
  } else if (mov.tipo === 'pago') {
    db.prepare('UPDATE clientes SET saldo = saldo + ? WHERE id = ?').run(mov.monto, mov.cliente_id);
  }
  db.prepare('DELETE FROM movimientos_clientes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── CAJA ─────────────────────────────────────────────────────
app.get('/api/caja', requireAuth, (req, res) => {

  const db = getDb();

  const rows = db.prepare(`

    SELECT fecha, 'Lotería' as tipo, 'Ganancia Lotería' as descripcion,
           ganancia_usuario as entrada, 0 as salida
    FROM loteria

    UNION ALL

    SELECT fecha, 'Máquina' as tipo, 'Ingreso Máquina' as descripcion,
           monto as entrada, 0 as salida
    FROM maquina

    UNION ALL

    SELECT m.fecha,
           'Cliente' as tipo,
           CASE 
             WHEN m.tipo='pago' THEN 'Pago Cliente: ' || c.nombre
             ELSE 'Deuda Cliente: ' || c.nombre
           END as descripcion,
           CASE WHEN m.tipo='pago' THEN m.monto ELSE 0 END as entrada,
           CASE WHEN m.tipo='deuda' THEN m.monto ELSE 0 END as salida

    FROM movimientos_clientes m
    JOIN clientes c ON m.cliente_id = c.id

    ORDER BY fecha DESC

  `).all();

  let balance = 0;

  const resultado = rows.map(r => {
    balance += r.entrada - r.salida;
    return {
      ...r,
      balance
    };
  });

  res.json(resultado);

});



app.get('/api/caja-resumen', requireAuth, (req, res) => {

  const db = getDb();

  const today = new Date().toISOString().slice(0,10);

  const loteria = db.prepare(`
    SELECT COALESCE(SUM(ganancia_usuario),0) as total
    FROM loteria
    WHERE fecha = ?
  `).get(today);

  const maquina = db.prepare(`
    SELECT COALESCE(SUM(monto),0) as total
    FROM maquina
    WHERE fecha = ?
  `).get(today);

  const pagos = db.prepare(`
    SELECT COALESCE(SUM(monto),0) as total
    FROM movimientos_clientes
    WHERE tipo='pago' AND fecha = ?
  `).get(today);

  const premios = db.prepare(`
    SELECT COALESCE(SUM(premios),0) as total
    FROM loteria
    WHERE fecha = ?
  `).get(today);

  const total = loteria.total + maquina.total - pagos.total - premios.total;

  res.json({
    loteria: loteria.total,
    maquina: maquina.total,
    pagos: pagos.total,
    premios: premios.total,
    total
  });

});

// ─── BACKUP MANUAL ───────────────────────────────────────────
app.get('/api/backup', requireAuth, (req, res) => {

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  const src = path.join(__dirname, 'database/database.sqlite');
  const dest = path.join(__dirname, `database/manual-backup-${timestamp}.sqlite`);

  fs.copyFileSync(src, dest);

  res.json({ ok: true, archivo: dest });

});

// ─── SERVE HTML ───────────────────────────────────────────────
const pages = ['dashboard', 'loteria', 'maquina', 'clientes', 'caja' ];
pages.forEach(page => {
  app.get(`/${page}`, requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, `frontend/${page}.html`));
  });
});

// ─── ERROR HANDLER GLOBAL ───────────────────────────────────

app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    res.redirect('/dashboard');
  } else {
    res.sendFile(path.join(__dirname, 'frontend/index.html'));
  }
});

const backupDir = path.join(__dirname, 'database');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

setInterval(() => {

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  const src = path.join(__dirname, 'database/database.sqlite');
  const dest = path.join(__dirname, `database/backup-${timestamp}.sqlite`);

  fs.copyFileSync(src, dest);

  // eliminar backups viejos
  const files = fs.readdirSync(path.join(__dirname, 'database'))
    .filter(f => f.startsWith("backup-"))
    .sort();

  if (files.length > 20) {
    const oldest = files[0];
    fs.unlinkSync(path.join(__dirname, 'database', oldest));
  }

  console.log("Backup automático creado:", dest);

}, 6 * 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
