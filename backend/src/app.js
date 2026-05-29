require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dashboardRoutes = require('./routes/dashboardRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', authRoutes); // Registrar rutas de autenticación
app.use('/api', dashboardRoutes); // Registrar rutas del dashboard financiero

// Basic Root Endpoint
app.get('/', (req, res) => {
  res.json({ status: 'API Online' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Servidor Express corriendo en el puerto ${PORT}`);
});
