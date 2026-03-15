# 💼 Mi Negocio — Sistema de Gestión Familiar

Sistema mobile-first para gestión de negocio familiar con lotería, máquina, clientes y caja.

## 📁 Estructura del Proyecto

```
family-business/
├── backend/
│   ├── server.js        # Servidor Express + rutas API
│   ├── database.js      # Conexión y migración SQLite
│   └── auth.js          # Middleware de autenticación
├── frontend/
│   ├── index.html       # Página de login
│   ├── dashboard.html   # Panel principal
│   ├── loteria.html     # Gestión de lotería
│   ├── maquina.html     # Ingresos de máquina
│   ├── clientes.html    # Clientes y deudas
│   ├── caja.html        # Historial de movimientos
│   ├── css/style.css    # Estilos mobile-first
│   └── js/app.js        # Utilidades compartidas
├── database/
│   ├── init.sql         # SQL de inicialización manual
│   └── database.sqlite  # Base de datos (generada automáticamente)
└── package.json
```

## 🚀 Instalación y uso

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor (crea la BD automáticamente)
npm start

# 3. Abrir en el navegador
http://localhost:3000
```

## 🔑 Credenciales por defecto

| Usuario | Contraseña |
|---------|-----------|
| admin   | admin123  |

> **⚠️ Cambia la contraseña en producción.** Puedes crear usuarios manualmente insertando en la tabla `usuarios` con un hash bcrypt.

## 📱 Páginas

| Ruta | Función |
|------|---------|
| `/` | Login |
| `/dashboard` | Resumen del negocio |
| `/loteria` | Registrar ventas y premios de lotería |
| `/maquina` | Registrar ingresos de máquina |
| `/clientes` | Gestión de clientes y deudas |
| `/caja` | Historial completo de movimientos |

## 💡 Lógica de negocio

**Lotería:**
- `ganancia_usuario = ventas × 15%`
- `saldo_dueño = ventas - ganancia_usuario - premios`
- El saldo del dueño puede ser negativo si los premios son altos

## 🛡️ Seguridad
- Contraseñas hasheadas con bcrypt (10 rounds)
- Sesiones con express-session
- Todas las rutas API protegidas con middleware `requireAuth`
- Redirección automática al login si no hay sesión

## 🔧 Crear usuarios manualmente

```js
// En Node.js REPL o script separado:
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('mi_contraseña', 10);
console.log(hash);
// Luego: INSERT INTO usuarios (usuario, password_hash, rol) VALUES ('nombre', 'HASH', 'user');
```
