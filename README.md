# Presupuesta mi web

API REST (Node.js + Express) que valida las características de un proyecto web y devuelve un presupuesto desglosado. Los precios y el cálculo son siempre del servidor.

## Requisitos
- Node.js 18 o superior

## Instalación y ejecución
```bash
npm install
npm start
```
El servidor escucha en el **puerto 3000** (`http://localhost:3000`). Se puede cambiar con la variable `PORT` (`PORT=4000 npm start`).

## Página de pruebas
Con el servidor arrancado, abre **http://localhost:3000** en el navegador. Desde ahí puedes probar `GET /api/estado`, `GET /api/tarifas`, calcular un presupuesto con un formulario, enviar JSON a mano (para probar tipos incorrectos como `"false"`) y ejecutar los 9 casos de la actividad, que se rellenan solos con el resultado obtenido.

## Estructura
```
src/tarifas.js   Tarifas del servidor
src/validar.js   Validación de la solicitud
src/calculo.js   Función de cálculo (independiente de la ruta)
src/app.js       Rutas Express
src/server.js    Arranque del servidor
public/index.html  Página para probar la API desde el navegador
test/            Pruebas automáticas
```

## Rutas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/estado` | Devuelve `{"status":"ok"}` |
| GET | `/api/tarifas` | Devuelve las tarifas del servidor |
| POST | `/api/presupuesto` | Valida y calcula el presupuesto (`Content-Type: application/json`) |

Cuerpo de `POST /api/presupuesto`:
```json
{ "tipo": "corporativa", "paginas": 4, "formulario": true, "segundoIdioma": false }
```
Respuesta 200:
```json
{ "base": 600, "paginasAdicionales": 150, "formulario": 80, "segundoIdioma": 0, "total": 830, "moneda": "EUR" }
```
Respuesta 400 (solicitud incorrecta):
```json
{ "error": "Solicitud incorrecta", "detalles": ["\"paginas\" debe ser un número entero entre 1 y 20."] }
```

## Ejemplos con curl
```bash
curl http://localhost:3000/api/estado
curl http://localhost:3000/api/tarifas
curl -X POST http://localhost:3000/api/presupuesto \
  -H "Content-Type: application/json" \
  -d '{"tipo":"corporativa","paginas":4,"formulario":true,"segundoIdioma":false}'
```
(En Windows PowerShell usa `curl.exe` y comillas dobles escapadas, o Postman/Thunder Client.)

## Pruebas
Automáticas: `npm test` (con la API no hace falta tenerla arrancada).

Tabla de pruebas (en los casos inválidos el resto de campos son correctos):

| Caso | Solicitud | Esperado | Obtenido |
|---|---|---|---|
| 1 | landing, 1 pág., sin extras | 200 · 300 € | |
| 2 | corporativa, 4 pág., formulario | 200 · 830 € | |
| 3 | landing, 2 pág., ambos extras | 200 · 580 € | |
| 4 | landing, 20 pág., sin extras | 200 · 1250 € | |
| 5 | `paginas: 0` | 400 | |
| 6 | `paginas: 21` | 400 | |
| 7 | `paginas: 2.5` | 400 | |
| 8 | `tipo: "tienda"` | 400 | |
| 9 | `formulario: "false"` | 400 | |

Además: `GET /api/estado` → 200 `{"status":"ok"}` y `GET /api/tarifas` → 200 con las tarifas.
