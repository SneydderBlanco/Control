const express = require('express');
const { 
  getDashboardData, 
  createObligacion, 
  createTransaccion,
  updateObligacion,
  deleteObligacion,
  updateTransaccion,
  deleteTransaccion
} = require('../controllers/dashboardController');

const router = express.Router();

// Rutas de lectura y creación
router.get('/dashboard', getDashboardData);
router.post('/obligaciones', createObligacion);
router.post('/transacciones', createTransaccion);

// Nuevas rutas de actualización (PUT) y eliminación (DELETE)
router.put('/obligaciones/:id', updateObligacion);
router.delete('/obligaciones/:id', deleteObligacion);

router.put('/transacciones/:id', updateTransaccion);
router.delete('/transacciones/:id', deleteTransaccion);

module.exports = router;
