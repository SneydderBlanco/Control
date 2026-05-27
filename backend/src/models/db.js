const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Query inicial de verificación
pool.query('SELECT NOW()')
  .then(res => {
    console.log('Conexión con PostgreSQL establecida exitosamente a las:', res.rows[0].now);
  })
  .catch(err => {
    console.error('Error al conectar con la base de datos PostgreSQL local:', err.message);
  });

module.exports = {
  query: (text, params) => pool.query(text, params),
};
