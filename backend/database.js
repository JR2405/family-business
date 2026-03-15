const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '../database/database.sqlite');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`

    CREATE TABLE IF NOT EXISTS caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT UNIQUE NOT NULL,
      caja_inicial REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS loteria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      ventas REAL NOT NULL DEFAULT 0,
      premios REAL NOT NULL DEFAULT 0,
      ganancia_usuario REAL NOT NULL DEFAULT 0,
      saldo_dueno REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS maquina (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      monto REAL NOT NULL DEFAULT 0,
      nota TEXT
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      saldo REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS movimientos_clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      monto REAL NOT NULL,
      fecha TEXT NOT NULL,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
    );
  `);

  // Create default admin user if none exists
  const existing = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get('admin');
  if (!existing) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO usuarios (usuario, password_hash, rol) VALUES (?, ?, ?)').run('admin', hash, 'admin');
    console.log('✅ Usuario admin creado: admin / admin123');
  }

  console.log('✅ Base de datos inicializada');
  return db;
}

module.exports = { getDb, initDb };
