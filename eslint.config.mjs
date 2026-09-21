// Configuración plana de ESLint — raíz del workspace.
//
// Mecanismo: ADR-009, capa 2 ("Reglas"). Reglas **nativas** del núcleo de
// ESLint, sin plugins de límites ni de dominio. La única dependencia que se
// suma es el analizador de TypeScript, que no es opcional: sin él ESLint no
// puede leer un `.ts`.
//
// Dependencias de desarrollo que exige este archivo, en la raíz:
//     eslint                      ^9
//     @typescript-eslint/parser   ^8
// (Están fuera del alcance de escritura de `cicd`: las declara quien ratifique
// el andamiaje de la raíz en la compuerta de la feature 001. Hasta entonces el
// paso de lint del pipeline queda diferido y lo avisa.)
//
// Este archivo cubre hoy una sola cosa: el **determinismo del motor legal**
// (T-14 de la feature 004). La matriz de importaciones permitidas por paquete
// —el otro contenido de la capa 2 de ADR-009— pertenece a la feature 001 y se
// agrega en el bloque reservado del final, sin tocar lo de acá.
//
// Los comentarios `eslint-disable` **no funcionan** sobre estos bloques:
// `noInlineConfig` los vuelve inertes. Es deliberado (ADR-009, "consecuencias
// negativas"): una excepción se documenta en un ADR, no en un comentario
// suelto al lado de la línea que rompe la regla.

import parserTypeScript from '@typescript-eslint/parser';

const POR_QUE_SIN_RELOJ =
  'El motor legal es una función pura (ADR-016). CA-31: la misma entrada con la misma ' +
  'fecha de evaluación tiene que dar el mismo resultado hoy y en 2030, cuando un abogado ' +
  'necesite reproducir qué dijo el sistema.';

// Reglas de determinismo del motor legal. Cada mensaje explica el porqué:
// un error que enseña la regla vale más que uno que la recita (ADR-009).
const SIN_FUENTES_DE_INDETERMINISMO = [
  {
    selector: "NewExpression[callee.name='Date']",
    message:
      `Prohibido \`new Date(...)\` en el motor legal. ${POR_QUE_SIN_RELOJ} ` +
      'La fecha entra por parámetro, como `FechaDeEvaluacion` o `FechaDelHecho`, y la ' +
      'aritmética se hace sobre `FechaCivil` (AAAA-MM-DD, sin hora ni zona horaria): ' +
      '`Date` arrastra zona horaria y horario de verano, y un día de corrimiento decide ' +
      'si una deuda prescribió (ADR-016 §2, riesgo R-08).',
  },
  {
    selector: "MemberExpression[object.name='Date']",
    message:
      `Prohibido usar \`Date\` como origen de datos (\`Date.now()\`, \`Date.parse\`, \`Date.UTC\`) en el motor legal. ${POR_QUE_SIN_RELOJ} ` +
      'La fecha entra por parámetro en `ContextoEvaluacion.fechaDeEvaluacion`.',
  },
  {
    selector: "TSTypeReference > Identifier[name='Date']",
    message:
      'El motor legal no usa el tipo `Date`: los plazos se cuentan en días civiles sobre ' +
      '`FechaCivil` (ADR-016 §2). Un tipo `Date` en una firma abre la puerta al reloj.',
  },
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message:
      `Prohibido \`Math.random()\` en el motor legal. ${POR_QUE_SIN_RELOJ} ` +
      'Si hace falta aleatoriedad, entra como dato por el contexto.',
  },
  {
    selector: "MemberExpression[object.name='process']",
    message:
      'El motor legal no lee el entorno del proceso (`process.env`, `process.hrtime`, ...). ' +
      'El `entorno` (`DESARROLLO` / `PRODUCCION`) es un campo de `ContextoEvaluacion` ' +
      '(ADR-016 §1 y §4). Además `process` no existe en el navegador ni en la app móvil, ' +
      'y el mismo código compilado corre en los tres (ADR-003).',
  },
  {
    selector: "MemberExpression[object.name='performance']",
    message:
      'El motor legal no mide el tiempo ni lee relojes de alta resolución. La medición de ' +
      'rendimiento es del pipeline (`scripts/ci/benchmark-motor.mjs`), no del dominio.',
  },
  {
    selector: "MemberExpression[object.name='crypto']",
    message:
      'El motor legal no genera identificadores ni aleatoriedad (`crypto.randomUUID`, ' +
      '`crypto.getRandomValues`): rompería CA-31. Los identificadores los produce quien llama.',
  },
  {
    selector: 'AwaitExpression',
    message:
      'No hay `await` en el motor legal: la ausencia de asincronía es la prueba estructural ' +
      'de que no hay entrada/salida (ADR-016 §3). `PuertoReproduccion` se **declara** en el ' +
      'contrato y lo implementa la infraestructura, no el motor.',
  },
  {
    selector: ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression)[async=true]',
    message:
      'No hay funciones `async` en el motor legal (ADR-016 §3). Si una regla legal necesita ' +
      'un dato de afuera, ese dato entra por `ContextoEvaluacion`.',
  },
];

// Variante acotada para el resto de `packages/shared`: lo que cierra ADR-016 y
// lo que el plan §6 declara verificable por lint. Fuera del motor puede haber
// código que reciba una fecha ya construida, pero nadie lee el reloj.
const SIN_RELOJ_NI_ENTORNO = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message:
      '`new Date()` sin argumentos lee el reloj del proceso y `packages/shared` tiene que ser ' +
      `determinista (ADR-016, "qué cierra"; plan 004 §6). ${POR_QUE_SIN_RELOJ}`,
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: `\`Date.now()\` lee el reloj del proceso. ${POR_QUE_SIN_RELOJ} La fecha entra por parámetro.`,
  },
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message: `\`Math.random()\` rompe el determinismo de \`packages/shared\`. ${POR_QUE_SIN_RELOJ}`,
  },
  {
    selector: "MemberExpression[object.name='process'][property.name='env']",
    message:
      '`packages/shared` no lee `process.env`: el mismo código compilado corre en la API, en la ' +
      'web y en la app móvil (ADR-003), y la configuración entra como dato.',
  },
];

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'apps/web/.next/**',
      'apps/api/prisma/migrations/**',
      'apps/mobile/.expo/**',
    ],
  },

  // Analizador de TypeScript. Sin `project`: estas reglas son sintácticas y no
  // necesitan información de tipos, así que el lint no paga el costo de
  // compilar el workspace entero.
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: parserTypeScript,
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // --- Determinismo (ADR-016, CA-31) -------------------------------------
  // Orden importante: en configuración plana el último bloque que coincide
  // reemplaza la regla completa. Primero lo general, después lo estricto.

  {
    files: ['packages/shared/src/**/*.{ts,tsx}'],
    linterOptions: { noInlineConfig: true },
    rules: {
      'no-restricted-syntax': ['error', ...SIN_RELOJ_NI_ENTORNO],
    },
  },

  {
    // El motor legal y el contrato que lo define, del lado del paquete y del
    // lado de la spec. Los dos archivos son idénticos byte a byte (ADR-017),
    // así que las mismas reglas tienen que valer para los dos: si una regla
    // sólo se aplicara a la copia, arreglarla rompería la identidad.
    files: ['packages/shared/src/motor-legal/**/*.{ts,tsx}', 'specs/contratos/**/*.ts'],
    linterOptions: { noInlineConfig: true },
    rules: {
      'no-restricted-syntax': ['error', ...SIN_FUENTES_DE_INDETERMINISMO],
      // ADR-016 §4: dentro del motor, `zod` y nada más.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*', 'fs', 'path', 'crypto', 'os', 'http', 'https', 'child_process', 'perf_hooks'],
              message:
                'El motor legal no importa módulos de Node: tiene que ejecutarse idéntico en el ' +
                'navegador, en React Native y en el servidor (ADR-009 aclaración 1, ADR-016 §4).',
            },
            {
              group: ['@nestjs/*', '@prisma/*', 'prisma', 'react', 'react-*', 'next', 'next/*', 'expo', 'expo-*'],
              message:
                'El motor legal no depende de ningún framework: es la pieza que un abogado o un ' +
                'actuario tiene que poder auditar (ADR-016).',
            },
            {
              group: ['../../*', '../../../*'],
              message:
                'Importación relativa que se escapa del paquete. Cada paquete importa sólo lo que ' +
                'declara en su `package.json`, por su nombre público (ADR-009 capas 0 y 1).',
            },
          ],
        },
      ],
    },
  },

  // --- Reservado: matriz de importaciones por paquete ---------------------
  // ADR-009 capa 2, tabla completa (`packages/integrations`, `apps/api`,
  // `apps/web`, `apps/mobile`). Es material de la feature 001 y entra cuando
  // esa compuerta lo apruebe; se agrega acá abajo, con `no-restricted-imports`
  // y bloques `files` por paquete, sin plugins nuevos.
];
