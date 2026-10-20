const path = require('path');
const express = require('express');
const { TARIFAS } = require('./tarifas');
const { validarSolicitud } = require('./validar');
const { calcularPresupuesto } = require('./calculo');

const app = express();
app.use(express.json());

// Página de pruebas en http://localhost:3000
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/estado', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/tarifas', (req, res) => {
  res.json({
    landing: TARIFAS.landing,
    corporativa: TARIFAS.corporativa,
    paginaAdicional: TARIFAS.paginaAdicional,
    formularioContacto: TARIFAS.formularioContacto,
    segundoIdioma: TARIFAS.segundoIdioma,
    moneda: TARIFAS.moneda,
  });
});

app.post('/api/presupuesto', (req, res) => {
  const errores = validarSolicitud(req.body);
  if (errores.length > 0) {
    return res.status(400).json({ error: 'Solicitud incorrecta', detalles: errores });
  }
  // Solo se pasan los cuatro campos conocidos: cualquier otra propiedad se ignora.
  const { tipo, paginas, formulario, segundoIdioma } = req.body;
  res.status(200).json(calcularPresupuesto({ tipo, paginas, formulario, segundoIdioma }));
});

// JSON mal formado u otros errores de parseo -> 400
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.status === 400) {
    return res.status(400).json({ error: 'Solicitud incorrecta', detalles: ['El JSON enviado no es válido.'] });
  }
  res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;
