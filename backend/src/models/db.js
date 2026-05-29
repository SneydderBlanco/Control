const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(process.env.DATABASE_URL ? {} : {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
  }),
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Query inicial de verificación y migración automática de la tabla de usuarios
pool.query('SELECT NOW()')
  .then(async (res) => {
    console.log('Conexión con PostgreSQL establecida exitosamente a las:', res.rows[0].now);
    
    // Crear la tabla usuarios si no existe
    const createTableDDL = `
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    try {
      await pool.query(createTableDDL);
      console.log('Tabla "usuarios" verificada/creada exitosamente.');
    } catch (err) {
      console.error('Error al inicializar la tabla "usuarios":', err.message);
    }
  })
  .catch(err => {
    console.error('Error al conectar con la base de datos PostgreSQL local:', err.message);
  });

module.exports = {
  query: (text, params) => pool.query(text, params),
};
