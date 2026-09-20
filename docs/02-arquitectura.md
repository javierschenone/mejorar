# 02 — Arquitectura

## Vista general

```
                      ┌──────────────────────────────────────────┐
   iOS / Android      │            apps/mobile (Expo)            │
   (deudor)           │   React Native · Expo Router · push      │
                      └────────────────────┬─────────────────────┘
                                           │ HTTPS/JSON (JWT)
  ┌───────────────────┐   ┌────────────────┴─────────────────────┐
  │  apps/web         │   │                                      │
  │  Next.js 15       │──▶│           apps/api (NestJS 11)       │
  │  · Portal cliente │   │  Auth · RBAC · Casos · Negociación    │
  │  · Portal abogado │   │  Colectivos · Pagos · Documentos      │
  │  · Back-office    │   │  Educación · Auditoría · Webhooks     │
  └───────────────────┘   └───┬───────────────┬──────────────────┘
                              │               │
              ┌───────────────┘               └───────────────┐
              ▼                                               ▼
   ┌─────────────────────┐                     ┌──────────────────────────┐
   │ packages/shared     │                     │ packages/integrations    │
   │ Dominio puro:       │                     │ Puertos + adaptadores:   │
   │ · reglas legales AR │                     │ BCRA · AFIP · Bureaus    │
   │ · cálculo de quitas │                     │ Carta Documento · VUF    │
   │ · comisiones        │                     │ PJN/embargos · Pagos     │
   │ · capacidad de pago │                     │ Firma · WhatsApp/Email   │
   └─────────────────────┘                     └──────────────────────────┘
              │                                               │
              ▼                                               ▼
     PostgreSQL 16 (Prisma)    Redis (cola/cache)    S3/MinIO (documentos)
```

## Principios

1. **El dominio no depende de nada.** `packages/shared` es TypeScript puro, sin
   Nest, sin Prisma, sin HTTP. Contiene las reglas legales y financieras y está
   cubierto por tests unitarios. Es la pieza que un abogado o un actuario puede
   auditar sin saber de infraestructura.
2. **Puertos y adaptadores para todo lo externo.** Cada integración expone una
   interfaz (`puerto`) y tiene al menos dos implementaciones: `Mock` (determinista,
   para desarrollo y tests) y `Http` (real). El modo se elige con
   `INTEGRACIONES_MODO`. El sistema completo corre end-to-end sin una sola
   credencial de terceros.
3. **Un solo modelo de datos, tres portales.** Cliente, abogado y administrador son
   vistas con distinto RBAC sobre el mismo backend, no tres productos.
4. **Todo lo que toca datos personales queda auditado.** Cada lectura de un informe
   crediticio, cada consentimiento y cada acceso de un abogado a un expediente
   genera un `EventoAuditoria` inmutable.
5. **Idempotencia en los bordes.** Todo trámite externo (carta documento, denuncia,
   cobro) se registra como `TramiteIntegracion` con `claveIdempotencia`, de modo que
   un reintento no genera dos cartas documento.

## Estructura del repositorio

```
mejorar/
├── apps/
│   ├── api/          NestJS 11 + Prisma 6 + PostgreSQL
│   ├── web/          Next.js 15 (App Router) — 3 portales
│   └── mobile/       Expo / React Native — app del deudor
├── packages/
│   ├── shared/       Dominio: reglas legales AR, finanzas, comisiones, zod
│   └── integrations/ Puertos y adaptadores de terceros
└── docs/
```

`shared` e `integrations` se compilan a `dist/` con `tsc` y se consumen como
paquetes del workspace, de modo que api, web y mobile comparten exactamente las
mismas reglas de negocio y los mismos tipos.

## Backend — módulos

| Módulo | Responsabilidad |
| --- | --- |
| `auth` | Registro, login, refresh, MFA por OTP, recuperación. JWT con rol y permisos. |
| `usuarios` | Usuarios, perfiles de cliente y abogado, verificación de matrícula. |
| `consentimientos` | Consentimientos informados versionados (Ley 25.326). Sin consentimiento vigente no se consulta ningún bureau. |
| `deudas` | Alta manual y automática de deudas, recálculo de saldos, detección de prescripción y de intereses abusivos. |
| `informes` | Consultas a BCRA y bureaus, snapshots históricos, seguimiento de plazos de permanencia. |
| `casos` | Expediente: máquina de estados, asignación de abogado, línea de tiempo, chat, documentos. |
| `negociaciones` | Negociación por deuda: ofertas, contraofertas, acuerdos, cumplimiento. |
| `colectivos` | Agrupación de deudores por acreedor/producto y negociación de cartera. |
| `abogados` | Marketplace, matching por jurisdicción y especialidad, tarifas, liquidaciones. |
| `pagos` | Suscripciones (preapproval Mercado Pago), facturación, comisiones de éxito. |
| `documentos` | Generación de documentos (poder, convenio, carta documento, denuncia), firma y almacenamiento. |
| `tramites` | Orquestación de integraciones externas con idempotencia y reintentos. |
| `judicial` | Juicios, embargos, cálculo de topes de embargabilidad. |
| `educacion` | Cursos, lecciones, progreso, certificados. |
| `notificaciones` | Push, email, WhatsApp; preferencias y registro de envíos. |
| `auditoria` | Bitácora inmutable de accesos y acciones sensibles. |
| `admin` | Métricas, parámetros del negocio, gestión de usuarios y acreedores. |

## Máquina de estados del caso

```
PROSPECTO ─▶ EN_ANALISIS ─▶ ESTRATEGIA_DEFINIDA ─▶ EN_NEGOCIACION
                 │                                      │
                 ▼                                      ▼
            DESESTIMADO                          ACUERDO_PROPUESTO
                                                        │
                                       ┌────────────────┼───────────────┐
                                       ▼                ▼               ▼
                              ACUERDO_FIRMADO   CERRADO_SIN_ACUERDO  JUDICIALIZADO
                                       │                                 │
                                       ▼                                 ▼
                               EN_CUMPLIMIENTO ──▶ CERRADO_EXITOSO   (defensa)
                                       │
                                       ▼
                                 INCUMPLIDO
```

Las transiciones válidas viven en `packages/shared/src/dominio/estados.ts` y se
validan tanto en el backend como en la UI.

## Seguridad

- Contraseñas con `argon2id`.
- Tokens de acceso de vida corta + refresh rotativo con detección de reutilización.
- Datos sensibles (CUIL, domicilio, números de cuenta) cifrados en reposo con
  AES-256-GCM y clave gestionada fuera de la base.
- RBAC por permiso, no por rol: `permisos.ts` define el mapa rol → permisos.
- Un abogado sólo ve los casos que le fueron asignados y cada acceso queda
  registrado.
- Rate limiting, Helmet, CORS restrictivo, validación estricta con Zod en todos los
  bordes.

## Puesta en marcha local

```bash
pnpm install
cp .env.example .env
pnpm db:up            # PostgreSQL + Redis + MinIO
pnpm build:libs
pnpm db:push
pnpm db:seed          # usuarios demo de los tres portales
pnpm dev:api          # http://localhost:3001/api  (Swagger en /api/docs)
pnpm dev:web          # http://localhost:3000
pnpm dev:mobile       # Expo
```

Con `INTEGRACIONES_MODO=mock` todo funciona sin credenciales de terceros.
