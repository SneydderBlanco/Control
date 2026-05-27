const db = require('../models/db');

const getDashboardData = async (req, res) => {
  const usuario_id = 1; // ID temporal de Christian

  try {
    // Ejecutar consultas en paralelo para máxima eficiencia
    const [
      balanceRes,
      deudasRes,
      proximosPagosRes,
      deudasTablaRes,
      transaccionesRes,
      pagosMesRes, // 6. Suma de pagos del mes en curso
      obligacionesRes, // 7. Todas las obligaciones del usuario sin límite
      transaccionesHistorialRes, // 8. Historial completo de transacciones
      cuentasRes // 9. Cuentas desglosadas con saldos
    ] = await Promise.all([
      // 1. Suma de balances en 'cuentas' (columna: balance_actual)
      db.query(
        'SELECT COALESCE(SUM(balance_actual), 0)::float AS balance_total FROM cuentas WHERE usuario_id = $1',
        [usuario_id]
      ),
      // 2. Suma de deudas de obligaciones
      db.query(
        "SELECT COALESCE(SUM(monto_restante), 0)::float AS deudas_totales FROM obligaciones WHERE usuario_id = $1 AND tipo = 'deuda' AND estado != 'pagado'",
        [usuario_id]
      ),
      // 3. Próximos 5 pagos (Suscripciones inteligentes: fecha al mes siguiente si ya pasó, estado dinámico según pago este mes)
      db.query(
        `SELECT 
           id, 
           entidad, 
           monto_total::float, 
           monto_restante::float, 
           CASE 
             WHEN tipo = 'suscripcion' THEN 
               CASE 
                 WHEN EXTRACT(DAY FROM fecha_vencimiento) < EXTRACT(DAY FROM CURRENT_DATE) THEN 
                   TO_CHAR(fecha_vencimiento, 'DD') || ' ' || TO_CHAR(CURRENT_DATE + INTERVAL '1 month', 'Mon')
                 ELSE 
                   TO_CHAR(fecha_vencimiento, 'DD') || ' ' || TO_CHAR(CURRENT_DATE, 'Mon')
               END
             ELSE TO_CHAR(fecha_vencimiento, 'DD Mon') 
           END AS fecha, 
           CASE 
             WHEN tipo = 'suscripcion' THEN
               CASE 
                 WHEN EXISTS (
                   SELECT 1 FROM transacciones 
                   WHERE usuario_id = o.usuario_id 
                     AND (obligacion_id = o.id OR descripcion ILIKE '%' || o.entidad || '%')
                     AND EXTRACT(MONTH FROM fecha_registro) = EXTRACT(MONTH FROM CURRENT_DATE)
                     AND EXTRACT(YEAR FROM fecha_registro) = EXTRACT(YEAR FROM CURRENT_DATE)
                 ) THEN 'pagado'
                 ELSE 'pendiente'
               END
             ELSE estado
           END AS estado,
           categoria_icono,
           tipo
         FROM obligaciones o
         WHERE usuario_id = $1 
           AND estado != 'pagado'
           AND (
             (tipo != 'suscripcion' 
               AND EXTRACT(MONTH FROM fecha_vencimiento) = EXTRACT(MONTH FROM CURRENT_DATE) 
               AND EXTRACT(YEAR FROM fecha_vencimiento) = EXTRACT(YEAR FROM CURRENT_DATE))
             OR 
             (tipo = 'suscripcion')
           )
         ORDER BY 
           CASE 
             WHEN tipo = 'suscripcion' AND EXTRACT(DAY FROM fecha_vencimiento) < EXTRACT(DAY FROM CURRENT_DATE) THEN EXTRACT(DAY FROM fecha_vencimiento) + 100
             ELSE EXTRACT(DAY FROM fecha_vencimiento)
           END ASC 
         LIMIT 5`,
        [usuario_id]
      ),
      // 4. Deudas detalladas de la tabla
      db.query(
        "SELECT id, entidad, monto_total::float, monto_restante::float, TO_CHAR(fecha_vencimiento, 'DD Mon') AS fecha, estado FROM obligaciones WHERE usuario_id = $1 AND tipo = 'deuda' AND estado != 'pagado'",
        [usuario_id]
      ),
      // 5. Últimas 4 transacciones
      db.query(
        "SELECT id, descripcion, monto::float, tipo_movimiento, TO_CHAR(fecha_registro, 'DD Mon, HH12:MI AM') AS fecha FROM transacciones WHERE usuario_id = $1 ORDER BY fecha_registro DESC LIMIT 4",
        [usuario_id]
      ),
      // 6. Pagos del mes actual (Si el día ya pasó, pertenece estrictamente al mes siguiente y se excluye de las métricas del mes actual)
      db.query(
        `SELECT 
           COALESCE(SUM(monto_restante), 0)::float AS pagos_mes_total,
           COALESCE(COUNT(*), 0)::int AS pagos_mes_pendientes_count
         FROM obligaciones o
         WHERE usuario_id = $1
           AND (
             -- Deudas ordinarias pendientes en el mes actual
             (tipo != 'suscripcion'
               AND estado != 'pagado'
               AND EXTRACT(MONTH FROM fecha_vencimiento) = EXTRACT(MONTH FROM CURRENT_DATE)
               AND EXTRACT(YEAR FROM fecha_vencimiento) = EXTRACT(YEAR FROM CURRENT_DATE))
             -- Suscripciones del mes actual que no se han pagado Y cuyo día de pago no ha pasado aún
             OR (tipo = 'suscripcion'
               AND EXTRACT(DAY FROM fecha_vencimiento) >= EXTRACT(DAY FROM CURRENT_DATE)
               AND NOT EXISTS (
                 SELECT 1 FROM transacciones 
                 WHERE usuario_id = o.usuario_id 
                   AND (obligacion_id = o.id OR descripcion ILIKE '%' || o.entidad || '%')
                   AND EXTRACT(MONTH FROM fecha_registro) = EXTRACT(MONTH FROM CURRENT_DATE)
                   AND EXTRACT(YEAR FROM fecha_registro) = EXTRACT(YEAR FROM CURRENT_DATE)
               ))
           )`,
        [usuario_id]
      ),
      // 7. Todas las obligaciones del usuario sin filtros de fecha
      db.query(
        'SELECT id, entidad, monto_total::float, monto_restante::float, TO_CHAR(fecha_vencimiento, \'YYYY-MM-DD\') AS fecha_vencimiento, tipo, estado, categoria_icono FROM obligaciones WHERE usuario_id = $1',
        [usuario_id]
      ),
      // 8. Historial completo de transacciones ordenadas por fecha de registro de forma descendente
      db.query(
        'SELECT id, descripcion, monto::float, tipo_movimiento, cuenta_id, TO_CHAR(fecha_registro, \'DD Mon YYYY, HH12:MI AM\') AS fecha FROM transacciones WHERE usuario_id = $1 ORDER BY fecha_registro DESC',
        [usuario_id]
      ),
      // 9. Cuentas y saldos desglosados
      db.query(
        'SELECT id, nombre_cuenta AS nombre, balance_actual::float FROM cuentas WHERE usuario_id = $1 ORDER BY id',
        [usuario_id]
      )
    ]);

    const balanceTotal = balanceRes.rows[0].balance_total;
    const deudasTotales = deudasRes.rows[0].deudas_totales;
    const proximosPagos = proximosPagosRes.rows;
    const deudasTabla = deudasTablaRes.rows;
    const actividadReciente = transaccionesRes.rows;
    const pagosMesTotal = pagosMesRes.rows[0].pagos_mes_total;
    const pagosMesPendientesCount = pagosMesRes.rows[0].pagos_mes_pendientes_count;
    const obligaciones = obligacionesRes.rows;
    const transaccionesHistorial = transaccionesHistorialRes.rows;
    const cuentas = cuentasRes.rows;

    res.json({
      balanceTotal,
      deudasTotales,
      proximosPagos,
      deudasTabla,
      actividadReciente,
      pagosMesTotal,
      pagosMesPendientesCount,
      obligaciones,
      transaccionesHistorial,
      cuentas
    });
  } catch (error) {
    console.error('Error al obtener datos del dashboard:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar el dashboard' });
  }
};

const createObligacion = async (req, res) => {
  const { entidad, monto_total, fecha_vencimiento, tipo, categoria_icono } = req.body;
  const usuario_id = 1; // ID temporal de Christian
  const monto_restante = monto_total; // Inicializar monto_restante igual al total
  const estado = 'pendiente'; // Estado inicial siempre pendiente

  // Validación básica
  if (!entidad || !monto_total || !fecha_vencimiento || !tipo || !categoria_icono) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para registrar la obligación' });
  }

  try {
    const insertQuery = `
      INSERT INTO obligaciones 
      (usuario_id, entidad, monto_total, monto_restante, fecha_vencimiento, tipo, estado, categoria_icono) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      usuario_id,
      entidad,
      monto_total,
      monto_restante,
      fecha_vencimiento,
      tipo,
      estado,
      categoria_icono
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear la nueva obligación:', error);
    res.status(500).json({ error: 'Error interno del servidor al guardar la obligación' });
  }
};

const createTransaccion = async (req, res) => {
  const { descripcion, monto, tipo_movimiento, cuenta_id, categoria, obligacion_id } = req.body;
  const usuario_id = 1; // ID temporal de Christian

  // Validación básica
  if (!descripcion || !monto || !tipo_movimiento || !cuenta_id) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para registrar la transacción' });
  }

  if (tipo_movimiento !== 'ingreso' && tipo_movimiento !== 'egreso') {
    return res.status(400).json({ error: 'El tipo de movimiento debe ser ingreso o egreso' });
  }

  // Determinar el monto con signo para la base de datos
  const valorMonto = tipo_movimiento === 'ingreso' ? Math.abs(monto) : -Math.abs(monto);
  
  // Guardar la descripción incluyendo la categoría si existe y es diferente de la descripción (ej: "Parqueadero Moto - Parqueadero")
  const descripcionFinal = (categoria && descripcion !== categoria) ? `${descripcion} - ${categoria}` : descripcion;

  try {
    // Iniciar transacción SQL en Postgres
    await db.query('BEGIN');

    // 1. Insertar la transacción en la tabla 'transacciones' (guardando obligacion_id si existe)
    const insertTxQuery = `
      INSERT INTO transacciones 
      (usuario_id, cuenta_id, descripcion, monto, tipo_movimiento, fecha_registro, obligacion_id) 
      VALUES ($1, $2, $3, $4, $5, NOW(), $6) 
      RETURNING *
    `;
    const txResult = await db.query(insertTxQuery, [
      usuario_id,
      cuenta_id,
      descripcionFinal,
      valorMonto,
      tipo_movimiento,
      obligacion_id || null
    ]);

    // 2. Actualizar el balance_actual en la tabla 'cuentas' específicamente para la cuenta seleccionada
    const updateAccountQuery = `
      UPDATE cuentas 
      SET balance_actual = balance_actual + $1 
      WHERE id = $2 AND usuario_id = $3
    `;
    await db.query(updateAccountQuery, [
      valorMonto,
      cuenta_id,
      usuario_id
    ]);

    // Confirmar transacción SQL
    await db.query('COMMIT');

    res.status(201).json(txResult.rows[0]);
  } catch (error) {
    // Deshacer cambios en caso de error
    await db.query('ROLLBACK');
    console.error('Error al registrar flujo de caja:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar la transacción' });
  }
};

// ==========================================
// NUEVAS FUNCIONALIDADES: PUT Y DELETE ENDPOINTS
// ==========================================

const updateObligacion = async (req, res) => {
  const { id } = req.params;
  const { entidad, monto_total, fecha_vencimiento, tipo, categoria_icono } = req.body;
  const usuario_id = 1; // ID temporal de Christian
  const monto_restante = monto_total; // Restablecer monto restante en edición simple

  if (!entidad || !monto_total || !fecha_vencimiento || !tipo || !categoria_icono) {
    return res.status(400).json({ error: 'Faltan campos requeridos para la actualización' });
  }

  try {
    const updateQuery = `
      UPDATE obligaciones 
      SET entidad = $1, monto_total = $2, monto_restante = $3, fecha_vencimiento = $4, tipo = $5, categoria_icono = $6 
      WHERE id = $7 AND usuario_id = $8 
      RETURNING *
    `;
    const result = await db.query(updateQuery, [
      entidad,
      monto_total,
      monto_restante,
      fecha_vencimiento,
      tipo,
      categoria_icono,
      id,
      usuario_id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Obligación no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar obligación:', error);
    res.status(500).json({ error: 'Error interno del servidor al actualizar obligación' });
  }
};

const deleteObligacion = async (req, res) => {
  const { id } = req.params;
  const usuario_id = 1;

  try {
    const deleteQuery = `DELETE FROM obligaciones WHERE id = $1 AND usuario_id = $2 RETURNING *`;
    const result = await db.query(deleteQuery, [id, usuario_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Obligación no encontrada' });
    }

    res.json({ message: 'Obligación eliminada con éxito', item: result.rows[0] });
  } catch (error) {
    console.error('Error al eliminar obligación:', error);
    res.status(500).json({ error: 'Error interno del servidor al eliminar obligación' });
  }
};

const updateTransaccion = async (req, res) => {
  const { id } = req.params;
  const { descripcion, monto, tipo_movimiento, cuenta_id, categoria } = req.body;
  const usuario_id = 1;

  if (!descripcion || !monto || !tipo_movimiento || !cuenta_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos para actualizar la transacción' });
  }

  try {
    // 1. Obtener la transacción previa de forma segura
    const prevTxRes = await db.query('SELECT cuenta_id, monto FROM transacciones WHERE id = $1 AND usuario_id = $2', [id, usuario_id]);
    if (prevTxRes.rows.length === 0) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    const prevMonto = prevTxRes.rows[0].monto; // Ya tiene el signo correcto (+ o -)
    const prevCuentaId = prevTxRes.rows[0].cuenta_id;

    // Calcular nuevos valores
    const newMonto = tipo_movimiento === 'ingreso' ? Math.abs(monto) : -Math.abs(monto);
    const descripcionFinal = (categoria && descripcion !== categoria) ? `${descripcion} - ${categoria}` : descripcion;

    // Iniciar transacción SQL para garantizar consistencia atómica del balance
    await db.query('BEGIN');

    // A. Revertir el impacto de la transacción previa
    await db.query(
      'UPDATE cuentas SET balance_actual = balance_actual - $1 WHERE id = $2 AND usuario_id = $3',
      [prevMonto, prevCuentaId, usuario_id]
    );

    // B. Actualizar el registro de la transacción
    const updateTxQuery = `
      UPDATE transacciones 
      SET descripcion = $1, monto = $2, tipo_movimiento = $3, cuenta_id = $4 
      WHERE id = $5 AND usuario_id = $6 
      RETURNING *
    `;
    const txResult = await db.query(updateTxQuery, [
      descripcionFinal,
      newMonto,
      tipo_movimiento,
      cuenta_id,
      id,
      usuario_id
    ]);

    // C. Aplicar el impacto de la nueva transacción
    await db.query(
      'UPDATE cuentas SET balance_actual = balance_actual + $1 WHERE id = $2 AND usuario_id = $3',
      [newMonto, cuenta_id, usuario_id]
    );

    await db.query('COMMIT');

    res.json(txResult.rows[0]);
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error al actualizar transacción y balance:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar la actualización' });
  }
};

const deleteTransaccion = async (req, res) => {
  const { id } = req.params;
  const usuario_id = 1;

  try {
    // 1. Obtener la transacción previa para conocer su impacto
    const prevTxRes = await db.query('SELECT cuenta_id, monto FROM transacciones WHERE id = $1 AND usuario_id = $2', [id, usuario_id]);
    if (prevTxRes.rows.length === 0) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    const prevMonto = prevTxRes.rows[0].monto;
    const prevCuentaId = prevTxRes.rows[0].cuenta_id;

    // Iniciar transacción SQL para revertir y eliminar atómicamente
    await db.query('BEGIN');

    // A. Revertir el saldo en la cuenta
    await db.query(
      'UPDATE cuentas SET balance_actual = balance_actual - $1 WHERE id = $2 AND usuario_id = $3',
      [prevMonto, prevCuentaId, usuario_id]
    );

    // B. Eliminar la transacción
    const deleteQuery = `DELETE FROM transacciones WHERE id = $1 AND usuario_id = $2 RETURNING *`;
    const deleteResult = await db.query(deleteQuery, [id, usuario_id]);

    await db.query('COMMIT');

    res.json({ message: 'Transacción eliminada con éxito y balance recalculado', item: deleteResult.rows[0] });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error al eliminar transacción y balance:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar la eliminación' });
  }
};

module.exports = {
  getDashboardData,
  createObligacion,
  createTransaccion,
  updateObligacion,
  deleteObligacion,
  updateTransaccion,
  deleteTransaccion,
};
