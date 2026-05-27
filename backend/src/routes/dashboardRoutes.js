const express = require('express');
const { 
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
  eliminarApuesta
} = require('../controllers/dashboardController');

const router = express.Router();

// ==========================================
// MÓDULO FINANCIERO (PATRIMONIO)
// ==========================================
router.get('/dashboard', getDashboardData);
router.post('/obligaciones', createObligacion);
router.post('/transacciones', createTransaccion);

router.put('/obligaciones/:id', updateObligacion);
router.delete('/obligaciones/:id', deleteObligacion);

router.put('/transacciones/:id', updateTransaccion);
router.delete('/transacciones/:id', deleteTransaccion);

// ==========================================
// MÓDULO DE INVERSIONES (APUESTAS - BETPLAY)
// ==========================================
router.get('/inversiones', getInversionesData);
router.post('/inversiones/saldo', actualizarSaldoBetPlay);
router.post('/inversiones/apuestas', crearApuesta);
router.put('/inversiones/apuestas/:id/estado', actualizarEstadoApuesta);
router.delete('/inversiones/apuestas/:id', eliminarApuesta);

module.exports = router;

