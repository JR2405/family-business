-- SQL de inicialización para SQLite
-- Archivo: database/init.sql
-- Uso: sqlite3 database/database.sqlite < database/init.sql

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
  tipo TEXT NOT NULL,   -- 'deuda' | 'pago'
  monto REAL NOT NULL,
  fecha TEXT NOT NULL,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Para crear usuarios manualmente (reemplazar 'HASH_AQUI' con bcrypt hash):
-- INSERT INTO usuarios (usuario, password_hash, rol) VALUES ('admin', 'HASH_AQUI', 'admin');
-- INSERT INTO usuarios (usuario, password_hash, rol) VALUES ('empleado', 'HASH_AQUI', 'user');

-- El servidor crea automáticamente el usuario admin/admin123 al iniciar.
