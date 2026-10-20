const TIPOS = ['landing', 'corporativa'];
const CAMPOS = ['tipo', 'paginas', 'formulario', 'segundoIdioma'];

// Devuelve un array de errores (vacío si la solicitud es válida).
function validarSolicitud(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return ['El cuerpo debe ser un objeto JSON.'];
  }

  const errores = [];

  for (const campo of CAMPOS) {
    if (!(campo in body)) errores.push(`Falta el campo obligatorio "${campo}".`);
  }
  if (errores.length > 0) return errores;

  if (!TIPOS.includes(body.tipo)) {
    errores.push('"tipo" debe ser "landing" o "corporativa".');
  }
  if (typeof body.paginas !== 'number' || !Number.isInteger(body.paginas) ||
      body.paginas < 1 || body.paginas > 20) {
    errores.push('"paginas" debe ser un número entero entre 1 y 20.');
  }
  if (typeof body.formulario !== 'boolean') {
    errores.push('"formulario" debe ser un booleano (true o false).');
  }
  if (typeof body.segundoIdioma !== 'boolean') {
    errores.push('"segundoIdioma" debe ser un booleano (true o false).');
  }

  return errores;
}

module.exports = { validarSolicitud };
