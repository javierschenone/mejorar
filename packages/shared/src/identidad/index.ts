/**
 * Identidad y acceso — feature 002, dominio puro (tarea T-01).
 *
 * Librería de dominio **pura y total**: no lee el reloj, ni el entorno, ni la
 * red, ni el disco; no muta su entrada; no lanza excepciones como flujo de
 * control (regla de lectura 5 del contrato, ADR-016, ADR-009 capa 2). Todo lo
 * que necesita entra por parámetro, el instante de evaluación incluido.
 *
 * Lo que **no** está acá, a propósito, y dónde está:
 *
 * - `argon2id`, la pimienta, TOTP, la emisión y verificación de tokens, el
 *   índice ciego y el índice de revocación → `apps/api` (`dev-backend`):
 *   necesitan criptografía, reloj y persistencia.
 * - `autorizar` y `autorizarColeccion` → `apps/api`: consultan la base para
 *   resolver el alcance y emiten el evento de auditoría. Este paquete aporta
 *   la decisión pura (`decidirAcceso`) y **no construye ninguna prueba de
 *   autorización**: si la construyera, la garantía de ADR-022 se rompería acá.
 * - Correo transaccional, ubicación por IP, descripción de dispositivo, lista
 *   local de contraseñas filtradas y reloj → `packages/integrations`
 *   (`dev-integraciones`), con mock determinista obligatorio.
 *
 * La superficie pública se declara acá, explícita: nada se filtra por
 * accidente.
 */

/* Tipos del contrato `identidad-y-acceso/v1` (copia byte a byte, ADR-017). */
export type * from './contrato';

/* Errores del dominio. */
export { errorDeEntrada, errorDeInconsistenciaInterna, falla, mensajeDeError, ok } from './errores';
export type { CodigoErrorIdentidad } from './errores';

/* Tiempo: aritmética de instantes y fechas civiles, sin reloj. */
export {
  DESPLAZAMIENTO_ARGENTINA_EN_MINUTOS,
  comoDuracionEnSegundos,
  comoFechaCivil,
  comoInstante,
  comoInstanteDeEvaluacion,
  estaDentroDeLaVigencia,
  fechaCivilArgentinaDe,
  instanteDesdeMilisegundos,
  milisegundosDe,
  segundosEntre,
  sumarSegundos,
} from './tiempo';

/* Parámetros: constitución #11. */
export {
  LISTA_DE_PARAMETROS,
  PARAMETROS_DE_IDENTIDAD,
  PLAZO_MAXIMO_DE_REVISION_DE_MATRICULA,
  POLITICA_DE_BLOQUEO_POR_DEFECTO,
  POLITICA_DE_CONTRASENA_POR_DEFECTO,
  VENTANA_DE_REAUTENTICACION,
} from './parametros';
export type {
  CitaDeFundamento,
  ClaveParametroIdentidad,
  ParametroDeIdentidad,
  UnidadDeParametro,
} from './parametros';

/* Identificadores opacos (F-01, D-002-11). */
export {
  LONGITUD_MAXIMA_DE_ID,
  crearIdOpaco,
  crearIdOpacoUlid,
  crearIdSesion,
  crearIdUsuario,
  esUlidCanonico,
} from './identificadores';

/* CUIT/CUIL (CA-04, obligación F-15). */
export {
  PREFIJOS_CONOCIDOS,
  normalizarCuitCuil,
  tienePrefijoConocido,
  verificarCuitCuil,
  verificarDigitoVerificadorCuit,
} from './cuit';

/* Roles y permisos (CA-18, ADR-022 capas 1 y 2). */
export {
  PERMISOS_DE_INSCRIPCION_DE_SEGUNDO_FACTOR,
  PERMISOS_DE_TRABAJO_PROFESIONAL,
  PERMISOS_NO_CONCEDIBLES_POR_AJUSTE,
  derivarPermisos,
  elSegundoFactorEstaActivo,
  mapaRolPermisos,
  permisosDeCuentaNoOperativa,
} from './permisos';

/* Decisión de acceso (CA-19, CA-20, ADR-022). */
export { decidirAcceso, reautenticacionVencida } from './autorizacion';

/* Segundo factor (CA-32, CA-38, CA-39, ADR-023). */
export {
  CANTIDAD_DE_CODIGOS_DE_RESPALDO,
  CODIGOS_DE_RESPALDO_PARA_AVISAR,
  PARAMETROS_TOTP,
  TABLA_DE_EXIGENCIA,
  exigeSegundoFactor,
} from './segundo-factor';

/* Matrícula profesional (CA-05, CA-29 a CA-31, ADR-026). */
export {
  PLANTILLAS_QUE_AFIRMAN_VERIFICACION,
  claveDeExhibicionDeMatricula,
  derivarEstadoMatricula,
} from './matricula';
export type { ClaveDePlantillaDeMatricula } from './matricula';

/* Contraseñas (CA-03, ADR-024). */
export {
  MENSAJES_DE_POLITICA,
  evaluarPoliticaDeContrasena,
  normalizarContrasena,
} from './contrasenas';

/* Bloqueo por intentos fallidos (CA-09, CA-36, CA-37, ADR-025). */
export { decidirBloqueo, demoraPorIntentos, laRecuperacionSigueDisponible } from './bloqueo';
