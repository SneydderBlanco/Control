const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_5tM0emCiqSrg@ep-super-cake-apn1gs1i.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected successfully');

    console.log('Running query 1 (saldo)...');
    const q1 = await client.query('SELECT COALESCE(saldo_actual, 0)::float AS saldo_actual FROM betplay_saldo WHERE usuario_id = $1 LIMIT 1', [1]);
    console.log('Query 1 success:', q1.rows);

    console.log('Running query 2 (apuestas)...');
    const q2 = await client.query("SELECT id, evento, pronostico, cuota::float, valor_apostado::float, estado, TO_CHAR(fecha_registro, 'DD Mon YYYY, HH12:MI AM') AS fecha FROM betplay_apuestas WHERE usuario_id = $1 ORDER BY fecha_registro DESC", [1]);
    console.log('Query 2 success, count:', q2.rowCount);

    console.log('Running query 3 (stats)...');
    const q3 = await client.query(`
      SELECT 
        COALESCE(COUNT(*), 0)::int AS total_apuestas,
        COALESCE(SUM(CASE WHEN estado = 'ganada' THEN 1 ELSE 0 END), 0)::int AS apuestas_ganadas,
        COALESCE(SUM(CASE WHEN estado = 'perdida' THEN 1 ELSE 0 END), 0)::int AS apuestas_perdidas,
        COALESCE(SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END), 0)::int AS apuestas_pendientes,
        COALESCE(SUM(CASE WHEN estado = 'ganada' THEN valor_apostado * (cuota - 1) WHEN estado = 'perdida' THEN -valor_apostado ELSE 0 END), 0)::float AS beneficio_neto,
        COALESCE(SUM(valor_apostado), 0)::float AS total_invertido
      FROM betplay_apuestas 
      WHERE usuario_id = $1
    `, [1]);
    console.log('Query 3 success:', q3.rows);

  } catch (err) {
    console.error('FAILED IN QUERY:', err.message);
    console.error(err.stack);
  } finally {
    await client.end();
  }
}

run();
