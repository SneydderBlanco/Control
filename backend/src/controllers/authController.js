const db = require('../models/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'aura_secret_key_2026';

const register = async (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (nombre, email, password)' });
  }

  try {
    // 1. Verificar si el usuario ya existe
    const userExistQuery = 'SELECT id FROM usuarios WHERE email = $1';
    const userExistRes = await db.query(userExistQuery, [email.toLowerCase().trim()]);

    if (userExistRes.rows.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya se encuentra registrado' });
    }

    // 2. Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Insertar usuario en la base de datos
    const insertUserQuery = `
      INSERT INTO usuarios (nombre, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, nombre, email, fecha_registro
    `;
    const newUserRes = await db.query(insertUserQuery, [
      nombre.trim(),
      email.toLowerCase().trim(),
      passwordHash
    ]);

    const user = newUserRes.rows[0];

    // 4. Generar token JWT para iniciar sesión inmediatamente
    const token = jwt.sign(
      { id: user.id, email: user.email, nombre: user.nombre },
      JWT_SECRET,
      { expiresIn: '7d' } // Expira en 7 días
    );

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      user
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar el registro' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  }

  try {
    // 1. Buscar usuario por correo
    const userQuery = 'SELECT * FROM usuarios WHERE email = $1';
    const userRes = await db.query(userQuery, [email.toLowerCase().trim()]);

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'El correo electrónico o la contraseña son incorrectos' });
    }

    const user = userRes.rows[0];

    // 2. Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'El correo electrónico o la contraseña son incorrectos' });
    }

    // 3. Generar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, nombre: user.nombre },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ error: 'Error interno del servidor al iniciar sesión' });
  }
};

const getMe = async (req, res) => {
  try {
    const userQuery = 'SELECT id, nombre, email, fecha_registro FROM usuarios WHERE id = $1';
    const userRes = await db.query(userQuery, [req.user.id]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(userRes.rows[0]);
  } catch (error) {
    console.error('Error al obtener perfil del usuario:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud de perfil' });
  }
};

module.exports = {
  register,
  login,
  getMe
};
