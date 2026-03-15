const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'No autenticado' });
  }
}

function login(usuario, password) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(usuario);
  if (!user) return null;
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return null;
  return { id: user.id, usuario: user.usuario, rol: user.rol };
}

module.exports = { requireAuth, login };
