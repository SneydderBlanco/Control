const db = require('../models/db');

const getDashboardData = async (req, res) => {
  const usuario_id = req.user.id;

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
      cuentasRes, // 9. Cuentas desglosadas con saldos
      betplaySaldoRes, // 10. Saldo actual de BetPlay
      betplayPendientesRes, // 11. Suma de apuestas en juego (pendientes)
      betplayRecientesRes // 12. Últimas 3 apuestas para movimientos
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
      ),
      // 10. Saldo actual de BetPlay
      db.query(
        'SELECT COALESCE(saldo_actual, 0)::float AS saldo_actual FROM betplay_saldo WHERE usuario_id = $1 LIMIT 1',
        [usuario_id]
      ),
      // 11. Suma de apuestas en juego (pendientes)
      db.query(
        "SELECT COALESCE(SUM(valor_apostado), 0)::float AS total_jugando FROM betplay_apuestas WHERE usuario_id = $1 AND estado = 'pendiente'",
        [usuario_id]
      ),
      // 12. Últimas 3 apuestas para movimientos
      db.query(
        "SELECT id, evento, pronostico, cuota::float, valor_apostado::float, estado, retorno_real::float, TO_CHAR(fecha_registro, 'DD Mon, HH12:MI AM') AS fecha FROM betplay_apuestas WHERE usuario_id = $1 ORDER BY fecha_registro DESC LIMIT 3",
        [usuario_id]
      )
    ]);

    const saldoBetplay = betplaySaldoRes.rows[0] ? betplaySaldoRes.rows[0].saldo_actual : 0.00;
    const totalJugando = betplayPendientesRes.rows[0] ? betplayPendientesRes.rows[0].total_jugando : 0.00;
    const totalInversionBetplay = saldoBetplay + totalJugando;

    const balanceTotal = balanceRes.rows[0].balance_total + totalInversionBetplay;
    const deudasTotales = deudasRes.rows[0].deudas_totales;
    const proximosPagos = proximosPagosRes.rows;
    const deudasTabla = deudasTablaRes.rows;
    const actividadReciente = transaccionesRes.rows;
    const pagosMesTotal = pagosMesRes.rows[0].pagos_mes_total;
    const pagosMesPendientesCount = pagosMesRes.rows[0].pagos_mes_pendientes_count;
    const obligaciones = obligacionesRes.rows;
    const transaccionesHistorial = transaccionesHistorialRes.rows;
    const cuentas = cuentasRes.rows;

    // Añadir la cuenta virtual de BetPlay al desglose
    cuentas.push({
      id: 'betplay',
      nombre: 'Inversiones (BetPlay)',
      balance_actual: totalInversionBetplay
    });

    // Añadir las apuestas recientes formateadas al historial para que se vean en la cuenta virtual
    const betplayRecientes = betplayRecientesRes.rows;
    betplayRecientes.forEach(b => {
      let desc = '';
      let monto = b.valor_apostado;
      let tipo_movimiento = 'egreso';
      
      if (b.estado === 'pendiente') {
        desc = `Jugando: ${b.evento} (${b.pronostico})`;
        monto = b.valor_apostado;
        tipo_movimiento = 'egreso';
      } else if (b.estado === 'ganada') {
        desc = `Ganada: ${b.evento} (${b.pronostico})`;
        monto = b.retorno_real !== null && b.retorno_real !== undefined ? b.retorno_real : (b.valor_apostado * b.cuota);
        tipo_movimiento = 'ingreso';
      } else if (b.estado === 'perdida') {
        desc = `Perdida: ${b.evento} (${b.pronostico})`;
        monto = b.valor_apostado;
        tipo_movimiento = 'egreso';
      }
      
      transaccionesHistorial.push({
        id: `bp-${b.id}`,
        descripcion: desc,
        monto: monto,
        tipo_movimiento: tipo_movimiento,
        cuenta_id: 'betplay',
        fecha: b.fecha
      });
    });

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
  const usuario_id = req.user.id;
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
  const usuario_id = req.user.id;

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

    // 3. Si la transacción está ligada a una obligación del tipo 'deuda', actualizar el saldo restante de la deuda
    if (obligacion_id) {
      const oblQuery = await db.query('SELECT tipo, monto_restante FROM obligaciones WHERE id = $1 AND usuario_id = $2', [obligacion_id, usuario_id]);
      if (oblQuery.rows.length > 0 && oblQuery.rows[0].tipo === 'deuda') {
        const nuevoRestante = Math.max(0, oblQuery.rows[0].monto_restante - Math.abs(monto));
        const nuevoEstado = nuevoRestante === 0 ? 'pagado' : 'activo';
        await db.query(
          'UPDATE obligaciones SET monto_restante = $1, estado = $2 WHERE id = $3 AND usuario_id = $4',
          [nuevoRestante, nuevoEstado, obligacion_id, usuario_id]
        );
      }
    }

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
  const usuario_id = req.user.id;
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
  const usuario_id = req.user.id;

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
  const usuario_id = req.user.id;

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
  const usuario_id = req.user.id;

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

// ==========================================
// MÓDULO DE INVERSIONES (APUESTAS - BETPLAY)
// ==========================================

const getInversionesData = async (req, res) => {
  const usuario_id = req.user.id;
  try {
    const [saldoRes, apuestasRes, estadisticasRes] = await Promise.all([
      // 1. Obtener saldo actual
      db.query('SELECT COALESCE(saldo_actual, 0)::float AS saldo_actual FROM betplay_saldo WHERE usuario_id = $1 LIMIT 1', [usuario_id]),
      // 2. Obtener todas las apuestas ordenadas por fecha de registro descendente (incluyendo retorno_real)
      db.query("SELECT id, evento, pronostico, cuota::float, valor_apostado::float, estado, retorno_real::float, TO_CHAR(fecha_registro, 'DD Mon YYYY, HH12:MI AM') AS fecha FROM betplay_apuestas WHERE usuario_id = $1 ORDER BY fecha_registro DESC", [usuario_id]),
      // 3. Obtener estadísticas agregadas (teniendo en cuenta retorno_real)
      db.query(`
        SELECT 
          COALESCE(COUNT(*), 0)::int AS total_apuestas,
          COALESCE(SUM(CASE WHEN estado = 'ganada' THEN 1 ELSE 0 END), 0)::int AS apuestas_ganadas,
          COALESCE(SUM(CASE WHEN estado = 'perdida' THEN 1 ELSE 0 END), 0)::int AS apuestas_perdidas,
          COALESCE(SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END), 0)::int AS apuestas_pendientes,
          COALESCE(SUM(CASE WHEN estado = 'ganada' THEN COALESCE(retorno_real, valor_apostado * cuota) - valor_apostado WHEN estado = 'perdida' THEN -valor_apostado ELSE 0 END), 0)::float AS beneficio_neto,
          COALESCE(SUM(valor_apostado), 0)::float AS total_invertido
        FROM betplay_apuestas 
        WHERE usuario_id = $1
      `, [usuario_id])
    ]);

    const saldoActual = saldoRes.rows[0] ? saldoRes.rows[0].saldo_actual : 0.00;
    const apuestas = apuestasRes.rows;
    const stats = estadisticasRes.rows[0];

    // Calcular tasa de acierto (Win Rate)
    const resueltas = stats.apuestas_ganadas + stats.apuestas_perdidas;
    const winRate = resueltas > 0 ? (stats.apuestas_ganadas / resueltas) * 100 : 0;
    
    // Calcular Yield (Retorno sobre inversión)
    const yieldPercentage = stats.total_invertido > 0 ? (stats.beneficio_neto / stats.total_invertido) * 100 : 0;

    res.json({
      saldoActual,
      apuestas,
      estadisticas: {
        ...stats,
        winRate: Math.round(winRate),
        yield: Math.round(yieldPercentage * 100) / 100
      }
    });
  } catch (error) {
    console.error('Error al obtener datos de inversiones:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar inversiones' });
  }
};

const actualizarSaldoBetPlay = async (req, res) => {
  const { monto, tipo_movimiento, cuenta_id } = req.body;
  const usuario_id = req.user.id;

  if (monto === undefined || !tipo_movimiento || !cuenta_id) {
    return res.status(400).json({ error: 'Monto, tipo de movimiento y cuenta_id son requeridos' });
  }

  const valor = tipo_movimiento === 'deposito' ? Math.abs(monto) : -Math.abs(monto);

  try {
    await db.query('BEGIN');

    // 1. Obtener saldo actual de BetPlay
    const saldoRes = await db.query('SELECT saldo_actual FROM betplay_saldo WHERE usuario_id = $1 FOR UPDATE', [usuario_id]);
    
    if (saldoRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Registro de saldo de BetPlay no encontrado' });
    }

    const nuevoSaldo = parseFloat(saldoRes.rows[0].saldo_actual) + valor;

    if (nuevoSaldo < 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'Saldo insuficiente en BetPlay para realizar el retiro' });
    }

    // 2. Manejo de cuenta de origen/destino financiera real
    const cuentaRes = await db.query('SELECT nombre_cuenta, balance_actual::float FROM cuentas WHERE id = $1 AND usuario_id = $2 FOR UPDATE', [cuenta_id, usuario_id]);
    if (cuentaRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Cuenta financiera seleccionada no encontrada' });
    }

    const nombreCuenta = cuentaRes.rows[0].nombre_cuenta;
    const balanceCuentaActual = cuentaRes.rows[0].balance_actual;

    if (tipo_movimiento === 'deposito') {
      // Depósito en BetPlay = Dinero sale de la cuenta real (Egreso)
      if (balanceCuentaActual < monto) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: `Saldo insuficiente en ${nombreCuenta} ($${balanceCuentaActual}) para recargar BetPlay` });
      }

      // Descontar saldo de la cuenta real
      await db.query('UPDATE cuentas SET balance_actual = balance_actual - $1 WHERE id = $2 AND usuario_id = $3', [monto, cuenta_id, usuario_id]);

      // Registrar transacción en el historial financiero
      await db.query(
        `INSERT INTO transacciones (usuario_id, descripcion, monto, tipo_movimiento, cuenta_id, fecha_registro) 
         VALUES ($1, $2, $3, 'egreso', $4, NOW())`,
        [usuario_id, `Inversión: Recarga BetPlay`, monto, cuenta_id]
      );
    } else {
      // Retiro de BetPlay = Dinero entra a la cuenta real (Ingreso)
      // Aumentar saldo de la cuenta real
      await db.query('UPDATE cuentas SET balance_actual = balance_actual + $1 WHERE id = $2 AND usuario_id = $3', [monto, cuenta_id, usuario_id]);

      // Registrar transacción en el historial financiero
      await db.query(
        `INSERT INTO transacciones (usuario_id, descripcion, monto, tipo_movimiento, cuenta_id, fecha_registro) 
         VALUES ($1, $2, $3, 'ingreso', $4, NOW())`,
        [usuario_id, `Inversión: Retiro BetPlay`, monto, cuenta_id]
      );
    }

    // 3. Actualizar saldo en BetPlay
    const updateRes = await db.query(
      'UPDATE betplay_saldo SET saldo_actual = $1, fecha_actualizacion = NOW() WHERE usuario_id = $2 RETURNING saldo_actual::float',
      [nuevoSaldo, usuario_id]
    );

    await db.query('COMMIT');
    res.json({ saldoActual: updateRes.rows[0].saldo_actual });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error al actualizar saldo de BetPlay:', error);
    res.status(500).json({ error: 'Error interno del servidor al actualizar saldo' });
  }
};

const crearApuesta = async (req, res) => {
  const { evento, pronostico, cuota, valor_apostado } = req.body;
  const usuario_id = req.user.id;

  if (!evento || !pronostico || !cuota || !valor_apostado) {
    return res.status(400).json({ error: 'Faltan campos requeridos para registrar la apuesta' });
  }

  try {
    await db.query('BEGIN');

    // 1. Verificar si hay saldo suficiente
    const saldoRes = await db.query('SELECT saldo_actual FROM betplay_saldo WHERE usuario_id = $1 FOR UPDATE', [usuario_id]);
    if (saldoRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Registro de saldo no encontrado' });
    }

    const saldoActual = parseFloat(saldoRes.rows[0].saldo_actual);
    if (saldoActual < parseFloat(valor_apostado)) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'Saldo insuficiente en BetPlay para colocar esta apuesta' });
    }

    // 2. Descontar valor apostado del saldo de BetPlay
    const nuevoSaldo = saldoActual - parseFloat(valor_apostado);
    await db.query('UPDATE betplay_saldo SET saldo_actual = $1, fecha_actualizacion = NOW() WHERE usuario_id = $2', [nuevoSaldo, usuario_id]);

    // 3. Crear la apuesta
    const insertQuery = `
      INSERT INTO betplay_apuestas (usuario_id, evento, pronostico, cuota, valor_apostado, estado)
      VALUES ($1, $2, $3, $4, $5, 'pendiente')
      RETURNING *, TO_CHAR(fecha_registro, 'DD Mon YYYY, HH12:MI AM') AS fecha
    `;
    const result = await db.query(insertQuery, [usuario_id, evento, pronostico, cuota, valor_apostado]);

    await db.query('COMMIT');
    res.status(201).json({ apuesta: result.rows[0], saldoActual: nuevoSaldo });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error al registrar apuesta:', error);
    res.status(500).json({ error: 'Error interno del servidor al crear apuesta' });
  }
};

const actualizarEstadoApuesta = async (req, res) => {
  const { id } = req.params;
  const { nuevoEstado, retorno_real } = req.body; // 'ganada' o 'perdida'
  const usuario_id = req.user.id;

  if (nuevoEstado !== 'ganada' && nuevoEstado !== 'perdida') {
    return res.status(400).json({ error: 'El estado de resolución debe ser ganada o perdida' });
  }

  try {
    await db.query('BEGIN');

    // 1. Obtener la apuesta y verificar su estado actual
    const apuestaRes = await db.query('SELECT * FROM betplay_apuestas WHERE id = $1 AND usuario_id = $2 FOR UPDATE', [id, usuario_id]);
    if (apuestaRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Apuesta no encontrada' });
    }

    const apuesta = apuestaRes.rows[0];
    if (apuesta.estado !== 'pendiente') {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'Esta apuesta ya ha sido resuelta previamente' });
    }

    // 2. Si es ganada, acreditar al saldo simulado: valor_apostado * cuota o retorno_real si se provee
    let saldoActualizado = null;
    let retornoRealValue = null;
    if (nuevoEstado === 'ganada') {
      const gananciaTotal = retorno_real !== undefined && retorno_real !== null 
        ? parseFloat(retorno_real) 
        : parseFloat(apuesta.valor_apostado) * parseFloat(apuesta.cuota);
      
      retornoRealValue = gananciaTotal;
      const saldoRes = await db.query('SELECT saldo_actual FROM betplay_saldo WHERE usuario_id = $1 FOR UPDATE', [usuario_id]);
      const nuevoSaldo = parseFloat(saldoRes.rows[0].saldo_actual) + gananciaTotal;
      
      const updateSaldoRes = await db.query('UPDATE betplay_saldo SET saldo_actual = $1, fecha_actualizacion = NOW() WHERE usuario_id = $2 RETURNING saldo_actual::float', [nuevoSaldo, usuario_id]);
      saldoActualizado = updateSaldoRes.rows[0].saldo_actual;
    } else {
      // Si es perdida, el saldo ya fue debitado al crear la apuesta, no hacemos nada en saldo
      const saldoRes = await db.query('SELECT saldo_actual::float FROM betplay_saldo WHERE usuario_id = $1', [usuario_id]);
      saldoActualizado = saldoRes.rows[0].saldo_actual;
    }

    // 3. Actualizar estado de la apuesta y retorno_real
    const updateApuestaRes = await db.query(
      "UPDATE betplay_apuestas SET estado = $1, retorno_real = $2 WHERE id = $3 AND usuario_id = $4 RETURNING *, retorno_real::float AS retorno_real, TO_CHAR(fecha_registro, 'DD Mon YYYY, HH12:MI AM') AS fecha",
      [nuevoEstado, retornoRealValue, id, usuario_id]
    );

    await db.query('COMMIT');
    res.json({ apuesta: updateApuestaRes.rows[0], saldoActual: saldoActualizado });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error al resolver apuesta:', error);
    res.status(500).json({ error: 'Error interno del servidor al resolver la apuesta' });
  }
};

const eliminarApuesta = async (req, res) => {
  const { id } = req.params;
  const usuario_id = req.user.id;

  try {
    await db.query('BEGIN');

    // 1. Obtener la apuesta para saber si estaba resuelta o pendiente
    const apuestaRes = await db.query('SELECT * FROM betplay_apuestas WHERE id = $1 AND usuario_id = $2 FOR UPDATE', [id, usuario_id]);
    if (apuestaRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Apuesta no encontrada' });
    }

    const apuesta = apuestaRes.rows[0];

    // 2. Si la apuesta estaba PENDIENTE, devolvemos el dinero al saldo (ya que se elimina)
    let saldoActualizado = null;
    if (apuesta.estado === 'pendiente') {
      const saldoRes = await db.query('SELECT saldo_actual FROM betplay_saldo WHERE usuario_id = $1 FOR UPDATE', [usuario_id]);
      const nuevoSaldo = parseFloat(saldoRes.rows[0].saldo_actual) + parseFloat(apuesta.valor_apostado);
      
      const updateSaldoRes = await db.query('UPDATE betplay_saldo SET saldo_actual = $1, fecha_actualizacion = NOW() WHERE usuario_id = $2 RETURNING saldo_actual::float', [nuevoSaldo, usuario_id]);
      saldoActualizado = updateSaldoRes.rows[0].saldo_actual;
    } else {
      const saldoRes = await db.query('SELECT saldo_actual::float FROM betplay_saldo WHERE usuario_id = $1', [usuario_id]);
      saldoActualizado = saldoRes.rows[0].saldo_actual;
    }

    // 3. Eliminar la apuesta
    await db.query('DELETE FROM betplay_apuestas WHERE id = $1 AND usuario_id = $2', [id, usuario_id]);

    await db.query('COMMIT');
    res.json({ message: 'Apuesta eliminada con éxito', id, saldoActual: saldoActualizado });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error al eliminar apuesta:', error);
    res.status(500).json({ error: 'Error interno del servidor al eliminar la apuesta' });
  }
};

const processSubscriptions = async (req, res) => {
  const cronKey = req.headers['x-cron-key'];
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || !cronKey || cronKey !== expectedSecret) {
    return res.status(403).json({ error: 'Acceso denegado: X-Cron-Key inválida o no configurada.' });
  }

  try {
    const hoy = new Date();
    const diaHoy = hoy.getDate();
    const mesHoy = hoy.getMonth() + 1; // 1-12
    const anioHoy = hoy.getFullYear();

    console.log(`[CRON] Iniciando procesamiento de suscripciones para el día del mes: ${diaHoy}`);

    // 1. Obtener todas las obligaciones activas de tipo suscripción cuyo día de vencimiento coincida con hoy
    const subQuery = `
      SELECT id, usuario_id, entidad, monto_total::float, fecha_vencimiento
      FROM obligaciones
      WHERE tipo = 'suscripcion'
        AND EXTRACT(DAY FROM fecha_vencimiento) = $1
    `;
    const subRes = await db.query(subQuery, [diaHoy]);
    const suscripciones = subRes.rows;

    console.log(`[CRON] Se encontraron ${suscripciones.length} suscripciones programadas para hoy.`);

    const report = {
      dia: diaHoy,
      total_procesadas: suscripciones.length,
      creadas: [],
      omitidas: []
    };

    for (const sub of suscripciones) {
      // 2. Verificar si ya se registró el pago este mes
      const txCheckQuery = `
        SELECT id FROM transacciones
        WHERE usuario_id = $1
          AND (obligacion_id = $2 OR descripcion ILIKE $3)
          AND EXTRACT(MONTH FROM fecha_registro) = $4
          AND EXTRACT(YEAR FROM fecha_registro) = $5
      `;
      const providerPattern = `%${sub.entidad}%`;
      const txCheckRes = await db.query(txCheckQuery, [
        sub.usuario_id,
        sub.id,
        providerPattern,
        mesHoy,
        anioHoy
      ]);

      if (txCheckRes.rows.length > 0) {
        console.log(`[CRON] Omitiendo suscripción "${sub.entidad}" (Usuario ID ${sub.usuario_id}): ya fue pagada este mes.`);
        report.omitidas.push({
          entidad: sub.entidad,
          usuario_id: sub.usuario_id,
          razon: 'ya_pagada'
        });
        continue;
      }

      // 3. Obtener la cuenta de 'Nequi' por defecto para este usuario
      let accountQuery = `
        SELECT id, nombre_cuenta FROM cuentas
        WHERE usuario_id = $1 AND nombre_cuenta ILIKE '%nequi%'
        LIMIT 1
      `;
      let accountRes = await db.query(accountQuery, [sub.usuario_id]);
      let cuentaId;
      let nombreCuentaUsed;

      if (accountRes.rows.length > 0) {
        cuentaId = accountRes.rows[0].id;
        nombreCuentaUsed = accountRes.rows[0].nombre_cuenta;
      } else {
        // Asegurar la cuenta 'Nequi' por defecto creándola con saldo 0.00
        try {
          const insertCuentaQuery = `
            INSERT INTO cuentas (usuario_id, nombre_cuenta, balance_actual)
            VALUES ($1, 'Nequi', 0.00)
            RETURNING id, nombre_cuenta
          `;
          const newCuentaRes = await db.query(insertCuentaQuery, [sub.usuario_id]);
          cuentaId = newCuentaRes.rows[0].id;
          nombreCuentaUsed = newCuentaRes.rows[0].nombre_cuenta;
          console.log(`[CRON] Se creó la cuenta 'Nequi' por defecto para el Usuario ID ${sub.usuario_id}.`);
        } catch (cuentaErr) {
          console.error(`[CRON] Error al crear la cuenta 'Nequi' por defecto para el Usuario ID ${sub.usuario_id}:`, cuentaErr.message);
          // Fallback a la primera cuenta del usuario en caso de error
          const fallbackRes = await db.query(
            'SELECT id, nombre_cuenta FROM cuentas WHERE usuario_id = $1 ORDER BY id LIMIT 1',
            [sub.usuario_id]
          );
          if (fallbackRes.rows.length > 0) {
            cuentaId = fallbackRes.rows[0].id;
            nombreCuentaUsed = fallbackRes.rows[0].nombre_cuenta;
          } else {
            console.warn(`[CRON] No se encontraron cuentas registradas para el Usuario ID ${sub.usuario_id}.`);
            report.omitidas.push({
              entidad: sub.entidad,
              usuario_id: sub.usuario_id,
              razon: 'sin_cuentas'
            });
            continue;
          }
        }
      }

      // 4. Registrar cobro de forma atómica
      try {
        await db.query('BEGIN');

        // Insertar transacción de egreso
        const insertTxQuery = `
          INSERT INTO transacciones (usuario_id, cuenta_id, descripcion, monto, tipo_movimiento, fecha_registro, obligacion_id)
          VALUES ($1, $2, $3, $4, 'egreso', NOW(), $5)
          RETURNING id
        `;
        const descripcionFinal = `Pago mensual - ${sub.entidad}`;
        await db.query(insertTxQuery, [
          sub.usuario_id,
          cuentaId,
          descripcionFinal,
          -sub.monto_total, 
          sub.id
        ]);

        // Restar balance de la cuenta
        const updateAccountQuery = `
          UPDATE cuentas
          SET balance_actual = balance_actual - $1
          WHERE id = $2 AND usuario_id = $3
        `;
        await db.query(updateAccountQuery, [sub.monto_total, cuentaId, sub.usuario_id]);

        await db.query('COMMIT');

        console.log(`[CRON] Pago automático procesado con éxito para "${sub.entidad}" (Usuario ID ${sub.usuario_id}) desde la cuenta "${nombreCuentaUsed}".`);
        report.creadas.push({
          entidad: sub.entidad,
          usuario_id: sub.usuario_id,
          monto: sub.monto_total,
          cuenta: nombreCuentaUsed
        });
      } catch (errTx) {
        await db.query('ROLLBACK');
        console.error(`[CRON] Error al procesar transacción atómica de "${sub.entidad}":`, errTx.message);
        report.omitidas.push({
          entidad: sub.entidad,
          usuario_id: sub.usuario_id,
          razon: 'error_db',
          error: errTx.message
        });
      }
    }

    res.json(report);
  } catch (error) {
    console.error('[CRON] Error general en processSubscriptions:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar suscripciones automáticas' });
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
  getInversionesData,
  actualizarSaldoBetPlay,
  crearApuesta,
  actualizarEstadoApuesta,
  eliminarApuesta,
  processSubscriptions
};
