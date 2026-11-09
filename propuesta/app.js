const express = require('express');
const { Router } = express;
const OpenAI = require('openai');
const PDFDocument = require('pdfkit');

const router = Router();
const CATALOGO = Object.freeze([
  { id: 'landing', nombre: 'Web landing', descripcion: 'Web de una página para presentar el negocio.', precio: 300, tipo: 'base' },
  { id: 'corporativa', nombre: 'Web corporativa', descripcion: 'Web corporativa; incluye la primera página.', precio: 600, tipo: 'base' },
  { id: 'paginaAdicional', nombre: 'Página adicional', descripcion: 'Cada página de contenido a partir de la segunda.', precio: 50, tipo: 'cantidad' },
  { id: 'formularioContacto', nombre: 'Formulario de contacto', descripcion: 'Formulario de contacto o solicitud sencillo.', precio: 80, tipo: 'opcional' },
  { id: 'segundoIdioma', nombre: 'Segundo idioma', descripcion: 'Adaptación de la web a un segundo idioma.', precio: 150, tipo: 'opcional' },
]);
const porId = new Map(CATALOGO.map((s) => [s.id, s]));
const LIMITE_DESCRIPCION = 4000;

function validarTexto(body) {
  const errores = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return ['El cuerpo debe ser un objeto JSON.'];
  if (typeof body.cliente !== 'string' || !body.cliente.trim() || body.cliente.trim().length > 120) errores.push('Indica el nombre del cliente o empresa (máximo 120 caracteres).');
  if (typeof body.descripcion !== 'string' || !body.descripcion.trim()) errores.push('La descripción del proyecto no puede estar vacía.');
  else if (body.descripcion.trim().length > LIMITE_DESCRIPCION) errores.push(`La descripción no puede superar ${LIMITE_DESCRIPCION} caracteres.`);
  return errores;
}

function clienteOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error('La API de OpenAI no está configurada en el servidor.');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

router.get('/catalogo', (req, res) => res.json({ servicios: CATALOGO }));

router.post('/analizar', async (req, res) => {
  const errores = validarTexto(req.body);
  if (errores.length) return res.status(400).json({ error: 'Solicitud incorrecta', detalles: errores });
  try {
    const openai = clienteOpenAI();
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Eres un asistente que prepara borradores de propuestas web. Usa solo los IDs del catálogo recibido; no inventes servicios, precios ni plazos. Devuelve JSON con las claves resumen (string), servicios (array de objetos {id, justificacion}), aclaraciones (array de strings) y necesidadesNoOfrecidas (array de strings). Expresa como aclaración cualquier dato incierto o no incluido. No supongas que una integración avanzada está incluida en un formulario sencillo.' },
        { role: 'user', content: JSON.stringify({ descripcion: req.body.descripcion.trim(), catalogo: CATALOGO.map(({ id, nombre, descripcion }) => ({ id, nombre, descripcion })) }) },
      ],
      temperature: 0.2,
    });
    const raw = completion.choices?.[0]?.message?.content;
    const propuesta = JSON.parse(raw || '{}');
    if (typeof propuesta.resumen !== 'string' || !Array.isArray(propuesta.servicios) || !Array.isArray(propuesta.aclaraciones) || !Array.isArray(propuesta.necesidadesNoOfrecidas)) throw new Error('La respuesta del modelo no cumple el formato esperado.');
    const servicios = [];
    for (const item of propuesta.servicios) {
      if (!item || !porId.has(item.id)) continue;
      const servicio = porId.get(item.id);
      if (!servicios.some((s) => s.id === item.id)) servicios.push({ id: item.id, nombre: servicio.nombre, descripcion: servicio.descripcion, justificacion: typeof item.justificacion === 'string' ? item.justificacion.slice(0, 500) : '' });
    }
    res.json({ resumen: propuesta.resumen.slice(0, 1200), servicios, aclaraciones: propuesta.aclaraciones.filter((x) => typeof x === 'string').map((x) => x.slice(0, 500)).slice(0, 12), necesidadesNoOfrecidas: propuesta.necesidadesNoOfrecidas.filter((x) => typeof x === 'string').map((x) => x.slice(0, 500)).slice(0, 12) });
  } catch (error) {
    console.error('Error al analizar propuesta:', error.message);
    res.status(502).json({ error: 'No se pudo obtener la propuesta de OpenAI. Comprueba la configuración y vuelve a intentarlo.' });
  }
});

function calcular(body) {
  const errores = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { errores: ['El cuerpo debe ser un objeto JSON.'] };
  if (typeof body.cliente !== 'string' || !body.cliente.trim() || body.cliente.trim().length > 120) errores.push('Indica el nombre del cliente o empresa (máximo 120 caracteres).');
  if (typeof body.resumen !== 'string' || !body.resumen.trim() || body.resumen.length > 1200) errores.push('Falta un resumen válido del proyecto.');
  const ids = body.servicios;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !porId.has(id))) errores.push('La selección contiene servicios no disponibles.');
  else if (new Set(ids).size !== ids.length) errores.push('La selección contiene servicios duplicados.');
  const paginas = body.paginas;
  if (!Number.isInteger(paginas) || paginas < 1 || paginas > 20) errores.push('Indica entre 1 y 20 páginas.');
  if (errores.length) return { errores };
  const baseIds = ids.filter((id) => porId.get(id).tipo === 'base');
  if (baseIds.length !== 1) return { errores: ['Selecciona exactamente un tipo de web: landing o corporativa.'] };
  if (ids.includes('paginaAdicional') !== (paginas > 1)) return { errores: ['La partida de páginas adicionales debe coincidir con el número de páginas.'] };
  const partidas = ids.map((id) => {
    const s = porId.get(id);
    const cantidad = id === 'paginaAdicional' ? paginas - 1 : 1;
    return { id, nombre: s.nombre, descripcion: s.descripcion, cantidad, precioUnitario: s.precio, importe: s.precio * cantidad };
  });
  return { presupuesto: { cliente: body.cliente.trim(), resumen: body.resumen.trim(), fecha: new Date().toLocaleDateString('es-ES'), servicios: partidas, aclaraciones: Array.isArray(body.aclaraciones) ? body.aclaraciones.filter((x) => typeof x === 'string').map((x) => x.slice(0, 500)).slice(0, 12) : [], total: partidas.reduce((n, p) => n + p.importe, 0), moneda: 'EUR' } };
}

router.post('/presupuesto', (req, res) => {
  const resultado = calcular(req.body);
  if (resultado.errores) return res.status(400).json({ error: 'Solicitud incorrecta', detalles: resultado.errores });
  res.json(resultado.presupuesto);
});

router.post('/pdf', (req, res) => {
  const resultado = calcular(req.body);
  if (resultado.errores) return res.status(400).json({ error: 'Solicitud incorrecta', detalles: resultado.errores });
  const p = resultado.presupuesto;
  const doc = new PDFDocument({ size: 'A4', margin: 52 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="presupuesto-web.pdf"');
  doc.pipe(res);
  doc.fontSize(22).fillColor('#244c65').text('Presupuesta mi web');
  doc.moveDown(0.4).fontSize(18).fillColor('#17212b').text('Propuesta de presupuesto');
  doc.moveDown().fontSize(11).text(`Cliente: ${p.cliente}`).text(`Fecha: ${p.fecha}`);
  doc.moveDown().fontSize(13).fillColor('#244c65').text('Resumen del proyecto');
  doc.moveDown(0.3).fontSize(11).fillColor('#17212b').text(p.resumen, { lineGap: 3 });
  doc.moveDown().fontSize(13).fillColor('#244c65').text('Servicios y desglose');
  doc.moveDown(0.5);
  for (const item of p.servicios) {
    doc.fontSize(11).fillColor('#17212b').text(`${item.nombre}${item.cantidad > 1 ? ` × ${item.cantidad}` : ''} — ${item.importe} €`, { continued: false });
    doc.fontSize(9).fillColor('#52636d').text(item.descripcion);
    doc.moveDown(0.5);
  }
  doc.moveDown().fontSize(15).fillColor('#244c65').text(`TOTAL: ${p.total} €`);
  if (p.aclaraciones.length) {
    doc.moveDown().fontSize(13).fillColor('#244c65').text('Aclaraciones y aspectos pendientes');
    doc.moveDown(0.3).fontSize(10).fillColor('#17212b');
    p.aclaraciones.forEach((x) => doc.text(`• ${x}`, { indent: 8, lineGap: 2 }));
  }
  doc.moveDown().fontSize(9).fillColor('#687780').text('Documento orientativo. Alcance y necesidades pendientes sujetos a confirmación.');
  doc.end();
});

module.exports = router;
