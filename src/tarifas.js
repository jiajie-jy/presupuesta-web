// Tarifas del servidor (ficticias). El cliente nunca puede modificarlas.
const TARIFAS = Object.freeze({
  landing: 300,               // incluye la primera página
  corporativa: 600,           // incluye la primera página
  paginaAdicional: 50,        // cada página a partir de la segunda
  formularioContacto: 80,
  segundoIdioma: 150,
  moneda: 'EUR',
});

module.exports = { TARIFAS };
