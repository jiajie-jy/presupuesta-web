const test = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');

let server, base;
test.before(async () => {
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

const post = (body) => fetch(`${base}/api/presupuesto`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const ok = { tipo: 'corporativa', paginas: 4, formulario: true, segundoIdioma: false };

test('GET /api/estado', async () => {
  const res = await fetch(`${base}/api/estado`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await res.json(), { status: 'ok' });
});

test('GET /api/tarifas', async () => {
  const res = await fetch(`${base}/api/tarifas`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).corporativa, 600);
});

const validos = [
  [1, { tipo: 'landing', paginas: 1, formulario: false, segundoIdioma: false }, 300],
  [2, ok, 830],
  [3, { tipo: 'landing', paginas: 2, formulario: true, segundoIdioma: true }, 580],
  [4, { tipo: 'landing', paginas: 20, formulario: false, segundoIdioma: false }, 1250],
];
for (const [n, body, total] of validos) {
  test(`Caso ${n}: 200 y total ${total}`, async () => {
    const res = await post(body);
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).total, total);
  });
}

const invalidos = [
  [5, { ...ok, paginas: 0 }],
  [6, { ...ok, paginas: 21 }],
  [7, { ...ok, paginas: 2.5 }],
  [8, { ...ok, tipo: 'tienda' }],
  [9, { ...ok, formulario: 'false' }],
];
for (const [n, body] of invalidos) {
  test(`Caso ${n}: 400`, async () => {
    const res = await post(body);
    assert.strictEqual(res.status, 400);
  });
}

test('Ignora propiedades adicionales (total impuesto)', async () => {
  const res = await post({ ...ok, total: 1, base: 0 });
  assert.strictEqual((await res.json()).total, 830);
});
