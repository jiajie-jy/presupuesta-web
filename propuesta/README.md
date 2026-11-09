# Flujo separado de propuesta

Este directorio contiene la interfaz nueva. Se abre en `/propuesta` y usa rutas `/api/propuesta/*`; la calculadora existente y `/api/presupuesto` se conservan.

## Configuración local

Usa Node 18 o superior. Copia `propuesta/.env.example` a `.env` en la raíz del proyecto y añade `OPENAI_API_KEY`. La clave solo se lee desde el servidor y `.env` está ignorado por Git. En Vercel configura esa clave como variable de entorno. Arranca con `npm start` y visita `http://localhost:3000/propuesta`.

Sin clave, el flujo de propuesta devuelve un error claro y permite reintentar. No se ofrece una respuesta ficticia que parezca generada por IA.

## Flujo

1. `POST /api/propuesta/analizar`: valida cliente y descripción, envía catálogo y descripción al modelo y valida su JSON e identificadores.
2. El cliente modifica la lista sugerida y completa páginas en el borrador. La UI muestra una vista previa del contenido del presupuesto.
3. `POST /api/propuesta/presupuesto`: el servidor valida la selección, obtiene nombres y tarifas del catálogo y calcula cada partida.
4. `POST /api/propuesta/pdf`: vuelve a calcular con la misma lógica del servidor y transmite el PDFKit resultante.

La base debe ser `landing` o `corporativa`. Las páginas adicionales se cobran desde la segunda; el formulario y el segundo idioma son extras opcionales. El PDF no utiliza importes enviados por el navegador.

## Librerías PDF consideradas

- **PDFKit (elegida):** genera un PDF en Node y permite transmitirlo directamente en la respuesta HTTP. Es adecuada para un presupuesto con texto y tabla sencilla; el diseño y los saltos de página se programan en JavaScript.
- **pdfmake:** su definición declarativa y las tablas son cómodas para documentos con estilos, cabeceras y pies de página. Su API se adapta bien a documentos repetibles, pero añade su propio modelo de definición de contenido y tipografías.
- **Puppeteer:** imprime HTML/CSS real y es útil si la plantilla de clase ya existe como página web. Necesita Chromium y aumenta el tamaño y los requisitos del despliegue; conviene comprobar que el hosting permite ejecutar ese navegador.

Referencias: [PDFKit](https://pdfkit.org/docs/getting_started.html), [pdfmake](https://pdfmake.github.io/docs/0.1/), [Puppeteer](https://pptr.dev/api).
