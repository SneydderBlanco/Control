const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'aura_secret_key_2026', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Sesión inválida o expirada. Por favor inicia sesión nuevamente.' });
    }
    req.user = user;
    next();
  });
};

module.exports = {
  authenticateToken
};
