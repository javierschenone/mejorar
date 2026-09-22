#!/usr/bin/env node
//
// Prueba estadística de temporización de los caminos de no-revelación
// — T-13 de la feature 002 (ADR-025 "Verificación" puntos 1 y 2; plan §6, fila
// "No-revelación"; criterios CA-02, CA-04, CA-06, CA-15 y CA-17).
//
// QUÉ DEFIENDE
// El sistema responde lo mismo exista o no la cuenta. Si además no tarda lo
// mismo, el tiempo es el oráculo: con un cronómetro y una lista de CUILes
// cualquiera averigua quién tiene una cuenta en una plataforma de gestión de
// deudas. Eso es una inferencia sobre la situación patrimonial de una persona,
// y por eso acá el umbral rompe la construcción.
//
// QUÉ MIDE
// Para cada camino, N muestras del caso "existe" y N del caso "no existe",
// **intercaladas** (a, b, a, b, ...). La intercalación no es un detalle: un
// ejecutor compartido se va poniendo más lento o más rápido durante la
// corrida, y medir primero una serie entera y después la otra convierte esa
// deriva en una diferencia falsa.
//
// Se verifican tres cosas por camino:
//   1. Igualdad de la respuesta (ADR-025, verificación 1): mismo código, mismo
//      cuerpo y mismas cabeceras, normalizando identificadores de correlación
//      y cabeceras que varían por naturaleza (fecha).
//   2. |Δ mediana| <= 15 ms y |Δ p95| <= 40 ms (plan §6 y ADR-025 con N = 1000).
//   3. El piso de latencia existe: la mediana de las dos ramas no puede estar
//      por debajo del piso de 400 ms de ADR-025 §3. Un camino que responde en
//      120 ms puede tener Δ = 0 y aun así no tener presupuesto de latencia:
//      el día que el trabajo real cambie, la diferencia aparece.
//
// CÓMO SE EJECUTA
//   URL_BASE_API=http://127.0.0.1:3001 node scripts/ci/prueba-temporizacion.mjs
//
// Sin `URL_BASE_API` alcanzable, informa y termina bien: los endpoints son de
// T-05/T-06 y todavía pueden no existir.
//
// DATOS DE PRUEBA
// Los identificadores "existentes" los siembra el entorno de pruebas y son
// **inventados**. El script se niega a correr contra un identificador que no
// esté en un dominio de prueba y contra un servidor que no sea local, salvo
// declaración explícita: apuntar esto a producción sería cronometrar las
// cuentas de personas reales (CLAUDE.md §4 regla 4 del mandato de `cicd`).

import { appendFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const URL_BASE = (process.env.URL_BASE_API ?? '').replace(/\/+$/, '');
const PREFIJO = process.env.API_PREFIX ?? 'api';

// N = 1000 es lo que fija ADR-025 para la corrida completa (nocturna y previa
// a cada despliegue). En un PR se usa una muestra menor: con un piso de 400 ms
// por petición, 1000 × 2 × 5 caminos son horas de ejecutor. Con N = 200 el
// error estándar de la mediana frente al ruido uniforme de 0–80 ms de ADR-025
// es de ~2 ms, muy por debajo del umbral de 15 ms: alcanza de sobra para
// detectar una diferencia real, y la corrida completa con N = 1000 queda para
// el job programado.
const N = Number(process.env.MUESTRAS_TEMPORIZACION ?? 200);

const UMBRAL_DELTA_MEDIANA_MS = Number(process.env.UMBRAL_DELTA_MEDIANA_MS ?? 15);
const UMBRAL_DELTA_P95_MS = Number(process.env.UMBRAL_DELTA_P95_MS ?? 40);
const PISO_ESPERADO_MS = Number(process.env.PISO_LATENCIA_MS ?? 400);
// Tolerancia sobre el piso: el reloj del cliente mide un poco menos que el del
// servidor por redondeo y por el momento en que se cierra la respuesta.
const TOLERANCIA_PISO_MS = Number(process.env.TOLERANCIA_PISO_MS ?? 20);

const ARCHIVO_SALIDA = process.env.ARCHIVO_SALIDA_TEMPORIZACION ?? 'prueba-temporizacion.json';

// Identificadores sembrados por el entorno de pruebas. Inventados, siempre.
const CORREO_EXISTENTE = process.env.CORREO_EXISTENTE ?? 'temporizacion.existente@ejemplo.test';
// CUIT con dígito verificador válido y DNI 00000000: no es de nadie.
const CUIT_EXISTENTE = process.env.CUIT_EXISTENTE ?? '20000000001';
const CONTRASENA_INCORRECTA = `no-es-la-contrasena-${randomBytes(9).toString('base64url')}`;
// Sólo para CA-17: enlace de recuperación ya usado de una cuenta que existe.
// Si el entorno no lo siembra, el caso se salta **a la vista**, no en silencio.
const TOKEN_RECUPERACION_USADO = process.env.TOKEN_RECUPERACION_USADO ?? '';

const VERSION_INFO_ART6 = process.env.VERSION_INFORMACION_ARTICULO6 ?? '1.0.0';
const VERSION_DOCUMENTOS = process.env.VERSION_DOCUMENTOS_ACEPTABLES ?? '1.0.0';
const HASH_DEL_TEXTO = process.env.HASH_DEL_TEXTO_ACEPTADO ?? '0'.repeat(64);

const DOMINIOS_DE_PRUEBA = ['.test', '.invalid', '.example', 'example.com', 'ejemplo.test', 'localhost'];

function resumen(texto) {
  console.log(texto);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${texto}\n`);
  }
}

function pendiente(motivo) {
  console.log(`::notice::Prueba de temporización no ejecutada: ${motivo}`);
  resumen('## Prueba de temporización de la no-revelación (ADR-025)');
  resumen('');
  resumen(`Pendiente: ${motivo}`);
  process.exit(0);
}

function abortar(motivo) {
  console.log(`::error::Prueba de temporización mal configurada: ${motivo}`);
  resumen('## Prueba de temporización de la no-revelación (ADR-025)');
  resumen('');
  resumen(`**No se pudo medir**: ${motivo}`);
  resumen('');
  resumen('No se reporta "verde" una prueba que no llegó a medir nada.');
  process.exit(1);
}

// ── Guardas de seguridad del propio script ──────────────────────────────────

if (!URL_BASE) {
  pendiente('no se definió `URL_BASE_API`: no hay API levantada contra la cual medir (T-05 / T-06).');
}

const destino = new URL(URL_BASE);
const esLocal = ['localhost', '127.0.0.1', '[::1]', '::1', 'api', 'host.docker.internal'].includes(destino.hostname);
if (!esLocal && process.env.PERMITIR_HOST_REMOTO !== 'si') {
  abortar(
    `\`URL_BASE_API\` apunta a ${destino.hostname}, que no es local. Esta prueba manda miles de peticiones y ` +
      'cronometra cuentas: contra un entorno con personas reales está prohibida. Si el destino es un entorno de ' +
      'pruebas remoto con datos sembrados, declararlo con PERMITIR_HOST_REMOTO=si.',
  );
}

for (const [nombre, valor] of [['CORREO_EXISTENTE', CORREO_EXISTENTE]]) {
  if (!DOMINIOS_DE_PRUEBA.some((d) => valor.toLowerCase().includes(d))) {
    abortar(
      `${nombre} = "${valor}" no está en un dominio de prueba (${DOMINIOS_DE_PRUEBA.join(', ')}). ` +
        'Los datos de prueba se inventan o se anonimizan: jamás la casilla de una persona real fuera de producción.',
    );
  }
}

// ── Casos: un camino de no-revelación por criterio ──────────────────────────
// Cada caso describe dos peticiones que **tienen que ser indistinguibles**.

function correoInexistente() {
  return `no-existe-${randomBytes(8).toString('hex')}@ejemplo.test`;
}

function cuitInexistente() {
  // Prefijo 20 + 8 dígitos al azar + dígito verificador calculado.
  const base = `20${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = base.split('').reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
  const resto = suma % 11;
  const dv = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
  return `${base}${dv}`;
}

function cuerpoDeAlta(correo, cuit) {
  return {
    correo,
    contrasena: `Alta-de-prueba-${randomBytes(9).toString('base64url')}`,
    nombreParaMostrar: 'Prueba de temporización',
    rolSolicitado: 'CLIENTE',
    cuitCuil: cuit,
    matricula: null,
    jurisdiccion: null,
    aceptaciones: [
      { clase: 'TERMINOS', version: VERSION_DOCUMENTOS, hashDelTexto: HASH_DEL_TEXTO },
      { clase: 'PRIVACIDAD', version: VERSION_DOCUMENTOS, hashDelTexto: HASH_DEL_TEXTO },
    ],
    versionInformacionArticulo6: VERSION_INFO_ART6,
  };
}

const CASOS = [
  {
    id: 'CA-02',
    nombre: 'Alta con correo ya registrado vs. correo nuevo',
    ruta: '/identidad/altas',
    existe: () => cuerpoDeAlta(CORREO_EXISTENTE, cuitInexistente()),
    noExiste: () => cuerpoDeAlta(correoInexistente(), cuitInexistente()),
  },
  {
    id: 'CA-04',
    nombre: 'Alta con CUIT/CUIL ya registrado vs. CUIT/CUIL nuevo',
    ruta: '/identidad/altas',
    existe: () => cuerpoDeAlta(correoInexistente(), CUIT_EXISTENTE),
    noExiste: () => cuerpoDeAlta(correoInexistente(), cuitInexistente()),
  },
  {
    id: 'CA-06',
    nombre: 'Reenvío de confirmación: cuenta existente vs. inexistente',
    ruta: '/identidad/confirmaciones/reenvios',
    existe: () => ({ correo: CORREO_EXISTENTE }),
    noExiste: () => ({ correo: correoInexistente() }),
  },
  {
    id: 'CA-15',
    nombre: 'Recuperación de contraseña: cuenta existente vs. inexistente',
    ruta: '/identidad/recuperaciones',
    existe: () => ({ correo: CORREO_EXISTENTE }),
    noExiste: () => ({ correo: correoInexistente() }),
  },
  {
    id: 'CA-09',
    nombre: 'Primer paso de ingreso: cuenta existente (contraseña incorrecta) vs. inexistente',
    ruta: '/identidad/ingresos',
    existe: () => ({ correo: CORREO_EXISTENTE, contrasena: CONTRASENA_INCORRECTA }),
    noExiste: () => ({ correo: correoInexistente(), contrasena: CONTRASENA_INCORRECTA }),
  },
  {
    id: 'CA-17',
    nombre: 'Cierre de recuperación: enlace ya usado de cuenta existente vs. enlace inexistente',
    ruta: '/identidad/recuperaciones/cierre',
    requiere: TOKEN_RECUPERACION_USADO,
    porQueSeSalta:
      'el entorno de pruebas no sembró `TOKEN_RECUPERACION_USADO` (un enlace de recuperación ya consumido de ' +
      'una cuenta existente). Sin él no hay dos casos que comparar para CA-17.',
    existe: () => ({ token: TOKEN_RECUPERACION_USADO, contrasenaNueva: `Nueva-${randomBytes(9).toString('base64url')}` }),
    noExiste: () => ({
      token: randomBytes(32).toString('base64url'),
      contrasenaNueva: `Nueva-${randomBytes(9).toString('base64url')}`,
    }),
  },
];

// ── Medición ────────────────────────────────────────────────────────────────

// Cabeceras que varían por naturaleza y no son canal lateral.
const CABECERAS_IGNORADAS = new Set(['date', 'x-id-correlacion', 'x-correlation-id', 'x-request-id', 'etag', 'keep-alive', 'connection']);

/** Normaliza identificadores de correlación (UUID, ULID, hex largo) del cuerpo. */
function normalizarCuerpo(texto) {
  return texto
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '<correlacion>')
    .replace(/\b[0-9A-HJKMNP-TV-Z]{26}\b/g, '<ulid>')
    .replace(/\b[0-9a-f]{16,}\b/g, '<hex>');
}

function huellaDeRespuesta(estado, cabeceras, cuerpo) {
  const relevantes = [...cabeceras.entries()]
    .filter(([clave]) => !CABECERAS_IGNORADAS.has(clave.toLowerCase()))
    .map(([clave, valor]) => `${clave.toLowerCase()}: ${normalizarCuerpo(valor)}`)
    .sort();
  return `${estado}\n${relevantes.join('\n')}\n\n${normalizarCuerpo(cuerpo)}`;
}

async function unaPeticion(ruta, cuerpo) {
  const inicio = process.hrtime.bigint();
  const respuesta = await fetch(`${URL_BASE}/${PREFIJO}${ruta}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const texto = await respuesta.text();
  const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
  return { ms, estado: respuesta.status, huella: huellaDeRespuesta(respuesta.status, respuesta.headers, texto) };
}

function mediana(ordenadas) {
  const mitad = Math.floor(ordenadas.length / 2);
  return ordenadas.length % 2 === 0 ? (ordenadas[mitad - 1] + ordenadas[mitad]) / 2 : ordenadas[mitad];
}

function percentil(ordenadas, p) {
  const i = Math.min(ordenadas.length - 1, Math.max(0, Math.ceil(p * ordenadas.length) - 1));
  return ordenadas[i];
}

async function medirCaso(caso) {
  const tiempos = { existe: [], noExiste: [] };
  const huellas = { existe: new Set(), noExiste: new Set() };
  const estados = { existe: new Set(), noExiste: new Set() };

  // Calentamiento: la primera petición paga compilación JIT y conexiones.
  await unaPeticion(caso.ruta, caso.existe());
  await unaPeticion(caso.ruta, caso.noExiste());

  for (let i = 0; i < N; i += 1) {
    // Intercalado, y alternando cuál va primero para no privilegiar a ninguna
    // rama con el efecto de caché de la petición anterior.
    const orden = i % 2 === 0 ? ['existe', 'noExiste'] : ['noExiste', 'existe'];
    for (const rama of orden) {
      const r = await unaPeticion(caso.ruta, rama === 'existe' ? caso.existe() : caso.noExiste());
      tiempos[rama].push(r.ms);
      huellas[rama].add(r.huella);
      estados[rama].add(r.estado);
    }
  }

  const a = [...tiempos.existe].sort((x, y) => x - y);
  const b = [...tiempos.noExiste].sort((x, y) => x - y);

  return {
    id: caso.id,
    nombre: caso.nombre,
    ruta: caso.ruta,
    muestras: N,
    existe: { medianaMs: mediana(a), p95Ms: percentil(a, 0.95), minMs: a[0], estados: [...estados.existe] },
    noExiste: { medianaMs: mediana(b), p95Ms: percentil(b, 0.95), minMs: b[0], estados: [...estados.noExiste] },
    deltaMedianaMs: mediana(a) - mediana(b),
    deltaP95Ms: percentil(a, 0.95) - percentil(b, 0.95),
    huellas,
  };
}

// ── Disponibilidad de la API ────────────────────────────────────────────────

let vive = false;
try {
  const salud = await fetch(`${URL_BASE}/${PREFIJO}/salud`, { signal: AbortSignal.timeout(5000) });
  vive = salud.ok;
} catch {
  vive = false;
}
if (!vive) {
  pendiente(`no respondió \`${URL_BASE}/${PREFIJO}/salud\`: la API de identidad todavía no está levantada (T-05 / T-06).`);
}

// ── Ejecución ───────────────────────────────────────────────────────────────

const resultados = [];
const saltados = [];
const problemas = [];

for (const caso of CASOS) {
  if (Object.hasOwn(caso, 'requiere') && !caso.requiere) {
    saltados.push({ id: caso.id, motivo: caso.porQueSeSalta });
    continue;
  }

  // Sonda: si la ruta no existe todavía, el caso queda pendiente en vez de
  // reportar una diferencia de tiempo sobre dos respuestas 404 idénticas.
  const sonda = await unaPeticion(caso.ruta, caso.noExiste());
  if (sonda.estado === 404) {
    saltados.push({ id: caso.id, motivo: `la ruta \`${caso.ruta}\` todavía no existe (404).` });
    continue;
  }
  if (sonda.estado === 400 || sonda.estado === 422) {
    abortar(
      `\`${caso.ruta}\` rechazó la petición de prueba con ${sonda.estado}. Se estaría midiendo la validación de ` +
        'entrada y no el camino de no-revelación. Hay que alinear el cuerpo de prueba de este script con el ' +
        'contrato §14 y con lo que siembra el entorno.',
    );
  }

  const medicion = await medirCaso(caso);

  // 1. Igualdad de respuesta (ADR-025 verificación 1; riesgo R-09).
  const todas = new Set([...medicion.huellas.existe, ...medicion.huellas.noExiste]);
  if (todas.size > 1) {
    const soloEnExiste = [...medicion.huellas.existe].filter((h) => !medicion.huellas.noExiste.has(h));
    const soloEnNoExiste = [...medicion.huellas.noExiste].filter((h) => !medicion.huellas.existe.has(h));
    if (soloEnExiste.length > 0 || soloEnNoExiste.length > 0) {
      problemas.push(
        `${medicion.id}: la respuesta NO es idéntica entre "existe" y "no existe" en \`${caso.ruta}\`. ` +
          `Códigos vistos: existe ${medicion.existe.estados.join('/')} · no existe ${medicion.noExiste.estados.join('/')}. ` +
          'Es un oráculo de enumeración directo (ADR-025 verificación 1).',
      );
      console.log('--- huella sólo en "existe" ---');
      console.log((soloEnExiste[0] ?? '(ninguna)').slice(0, 1200));
      console.log('--- huella sólo en "no existe" ---');
      console.log((soloEnNoExiste[0] ?? '(ninguna)').slice(0, 1200));
    }
  }

  // 2. Un 429 en una sola rama también es un oráculo; en las dos, invalida la
  //    medición (el límite de tasa domina los tiempos).
  const con429 = [medicion.existe.estados.includes(429), medicion.noExiste.estados.includes(429)];
  if (con429[0] !== con429[1]) {
    problemas.push(
      `${medicion.id}: apareció \`429\` en una sola de las dos ramas. El propio bloqueo está delatando la ` +
        'existencia de la cuenta (ADR-025 §4: la clave de tráfico se cuenta exista o no la cuenta).',
    );
  } else if (con429[0]) {
    abortar(
      `${medicion.id}: las dos ramas recibieron \`429\`. El entorno de medición tiene que estar configurado con ` +
        'umbrales de tasa por IP suficientes para N muestras (son parámetros de producto, no del mecanismo de ' +
        'no-revelación). La prueba de enumeración por bloqueo con la política real es otra, y corre aparte ' +
        '(ADR-025 verificación 3).',
    );
  }

  // 3. Umbrales de temporización (plan §6).
  if (Math.abs(medicion.deltaMedianaMs) > UMBRAL_DELTA_MEDIANA_MS) {
    problemas.push(
      `${medicion.id}: |Δ mediana| = ${Math.abs(medicion.deltaMedianaMs).toFixed(1)} ms > ${UMBRAL_DELTA_MEDIANA_MS} ms en ` +
        `\`${caso.ruta}\` (existe ${medicion.existe.medianaMs.toFixed(1)} ms · no existe ${medicion.noExiste.medianaMs.toFixed(1)} ms).`,
    );
  }
  if (Math.abs(medicion.deltaP95Ms) > UMBRAL_DELTA_P95_MS) {
    problemas.push(
      `${medicion.id}: |Δ p95| = ${Math.abs(medicion.deltaP95Ms).toFixed(1)} ms > ${UMBRAL_DELTA_P95_MS} ms en \`${caso.ruta}\`.`,
    );
  }

  // 4. El piso de latencia de ADR-025 §3 tiene que estar aplicado.
  const minimaMediana = Math.min(medicion.existe.medianaMs, medicion.noExiste.medianaMs);
  if (minimaMediana < PISO_ESPERADO_MS - TOLERANCIA_PISO_MS) {
    problemas.push(
      `${medicion.id}: la mediana más baja es ${minimaMediana.toFixed(1)} ms, por debajo del piso de ` +
        `${PISO_ESPERADO_MS} ms de ADR-025 §3. Sin piso, la diferencia reaparece en cuanto cambie el trabajo real: ` +
        'el ruido se promedia, el piso no.',
    );
  }

  delete medicion.huellas;
  resultados.push(medicion);
}

const reporte = {
  fechaMedicion: new Date().toISOString(),
  urlBase: URL_BASE,
  muestrasPorRama: N,
  umbrales: {
    deltaMedianaMs: UMBRAL_DELTA_MEDIANA_MS,
    deltaP95Ms: UMBRAL_DELTA_P95_MS,
    pisoMs: PISO_ESPERADO_MS,
  },
  resultados,
  saltados,
  problemas,
};
writeFileSync(ARCHIVO_SALIDA, `${JSON.stringify(reporte, null, 2)}\n`);

resumen('## Prueba de temporización de la no-revelación (ADR-025)');
resumen('');
resumen(`N = ${N} por rama · umbrales |Δ mediana| <= ${UMBRAL_DELTA_MEDIANA_MS} ms, |Δ p95| <= ${UMBRAL_DELTA_P95_MS} ms, piso ${PISO_ESPERADO_MS} ms`);
resumen('');
resumen('| Criterio | Camino | Mediana existe | Mediana no existe | Δ mediana | Δ p95 |');
resumen('| --- | --- | ---: | ---: | ---: | ---: |');
for (const r of resultados) {
  resumen(
    `| ${r.id} | \`${r.ruta}\` | ${r.existe.medianaMs.toFixed(1)} ms | ${r.noExiste.medianaMs.toFixed(1)} ms | ` +
      `${r.deltaMedianaMs.toFixed(1)} ms | ${r.deltaP95Ms.toFixed(1)} ms |`,
  );
}
if (saltados.length > 0) {
  resumen('');
  resumen('Casos no medidos:');
  for (const s of saltados) {
    resumen(`- **${s.id}**: ${s.motivo}`);
    console.log(`::warning::Prueba de temporización, ${s.id} no medido: ${s.motivo}`);
  }
}

if (resultados.length === 0 && saltados.length === CASOS.length) {
  resumen('');
  resumen('Ningún camino medido todavía: los endpoints de no-revelación son de T-05 / T-06.');
  process.exit(0);
}

if (problemas.length === 0) {
  resumen('');
  resumen('Sin diferencia medible entre "existe" y "no existe" en los caminos medidos.');
  process.exit(0);
}

resumen('');
for (const p of problemas) {
  resumen(`- ${p}`);
  console.log(`::error::Temporización: ${p}`);
}
resumen('');
resumen('**Construcción detenida.** Un canal lateral de enumeración es una fuga de datos personales, no un defecto de rendimiento.');
process.exit(1);
