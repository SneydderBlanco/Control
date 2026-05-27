const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Si no hay DATABASE_URL en el entorno, cae en la configuración local
  ...(process.env.DATABASE_URL ? {} : {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
  }),
  // Las bases de datos en la nube requieren SSL activo
  ssl: isProduction ? { rejectUnauthorized: false } : false
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
