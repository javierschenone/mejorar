/**
 * Parámetros de la feature 002 — constitución #11.
 *
 * Ningún plazo, tope ni porcentaje va incrustado en una función. Todos viven
 * acá, con su valor, su fundamento citado, su vigencia y su marca de
 * `requiereValidacionProfesional`.
 *
 * Esta feature tiene además una distinción propia que la 004 no necesitaba, y
 * que está tomada expresamente de la spec: **hay parámetros de producto y hay
 * parámetros con fundamento normativo**. CA-37 lo dice con todas las letras
 * para el umbral de bloqueo: *"es un parámetro de producto, no normativo, y su
 * valor por defecto puede ajustarse sin revisión legal — a diferencia de los
 * parámetros del motor de reglas legales de la feature 004"*. Por eso el campo
 * `clase`, y por eso el test que verifica que **todo** parámetro `NORMATIVO`
 * lleva `requiereValidacionProfesional: true`.
 *
 * Que un parámetro sea de producto no lo exime de llevar fundamento: el umbral
 * de 5 intentos es una decisión humana registrada (002-A), y queda citada.
 */

import type { DuracionEnSegundos, PoliticaDeBloqueo, PoliticaDeContrasena } from './contrato/v1';
import { duracionLiteral } from './tiempo';

export type ClaveParametroIdentidad =
  | 'bloqueo.umbralDeIntentos'
  | 'bloqueo.ventana'
  | 'bloqueo.duracionDelBloqueo'
  | 'bloqueo.demoraBase'
  | 'bloqueo.demoraMaxima'
  | 'contrasena.longitudMinima'
  | 'contrasena.longitudMaxima'
  | 'contrasena.longitudMinimaDeTokenDeCuenta'
  | 'matricula.vigenciaVerificacion'
  | 'matricula.plazoMaximoRevision'
  | 'credencial.ventanaDeReautenticacion';

export type UnidadDeParametro = 'SEGUNDOS' | 'MESES' | 'CARACTERES' | 'INTENTOS';

/**
 * Cita del fundamento. `referencia` apunta al documento del repositorio donde
 * la decisión quedó registrada, para poder reconstruir por qué el valor es el
 * que es sin depender de la memoria de nadie.
 */
export interface CitaDeFundamento {
  readonly norma: string;
  readonly articulo: string | null;
  readonly referencia: string;
}

export interface ParametroDeIdentidad<TValor> {
  readonly clave: ClaveParametroIdentidad;
  readonly valor: TValor;
  readonly unidad: UnidadDeParametro;
  /** `NORMATIVO` obliga a `requiereValidacionProfesional: true` (test). */
  readonly clase: 'PRODUCTO' | 'NORMATIVO';
  readonly fundamento: readonly [CitaDeFundamento, ...CitaDeFundamento[]];
  readonly vigenciaDesde: string;
  readonly vigenciaHasta: string | null;
  /** Constitución #11: nada con fundamento normativo se da por firme. */
  readonly requiereValidacionProfesional: boolean;
}

const DECISION_002_A: CitaDeFundamento = {
  norma: 'Decisión humana 002-A del product owner',
  articulo: null,
  referencia: 'specs/REGISTRO-COMPUERTAS.md entrada 040; specs/002-identidad-y-acceso/spec.md CA-37',
};

const ART_8_BIS_LDC: CitaDeFundamento = {
  norma: 'Ley 24.240 (Defensa del Consumidor)',
  articulo: 'art. 8 bis — trato digno',
  referencia: 'specs/002-identidad-y-acceso/cumplimiento.md, recaudo A-2 y salvaguarda M-4',
};

const NIST_800_63B: CitaDeFundamento = {
  norma: 'NIST SP 800-63B — Digital Identity Guidelines, §5.1.1',
  articulo: null,
  referencia: 'specs/adr/ADR-024-contrasenas-argon2id-con-pimienta-y-politica-por-longitud.md §3',
};

const SALVAGUARDA_M2: CitaDeFundamento = {
  norma: 'Ley 25.326, art. 9 (medidas de seguridad adecuadas al riesgo) y Ley 24.240, arts. 4 y 40',
  articulo: 'salvaguarda M-2, condición C-002-07',
  referencia: 'specs/002-identidad-y-acceso/cumplimiento.md §4.4 y §5; specs/adr/ADR-026-*.md',
};

const ESCALAMIENTO_E5: CitaDeFundamento = {
  norma: 'Decisión de G2 — escalamiento E-5 del plan (7 días corridos en vez de 5 hábiles)',
  articulo: null,
  referencia: 'specs/002-identidad-y-acceso/spec.md CA-31 (v4); specs/002-identidad-y-acceso/plan.md §10',
};

const RECAUDO_B3: CitaDeFundamento = {
  norma: 'Decisión humana 002-B, recaudo B-3 (reautenticación fuerte)',
  articulo: null,
  referencia: 'specs/REGISTRO-COMPUERTAS.md entrada 040; specs/adr/ADR-023-*.md §4; ADR-022 "La clasificación"',
};

/** Fecha desde la que rigen estos valores: el día en que se aprobó el material de G2. */
const VIGENTE_DESDE = '2026-09-21';

function parametro<TValor>(
  clave: ClaveParametroIdentidad,
  valor: TValor,
  unidad: UnidadDeParametro,
  clase: 'PRODUCTO' | 'NORMATIVO',
  fundamento: readonly [CitaDeFundamento, ...CitaDeFundamento[]],
  requiereValidacionProfesional: boolean,
): ParametroDeIdentidad<TValor> {
  return {
    clave,
    valor,
    unidad,
    clase,
    fundamento,
    vigenciaDesde: VIGENTE_DESDE,
    vigenciaHasta: null,
    requiereValidacionProfesional,
  };
}

/**
 * Tabla completa de parámetros del dominio de identidad. Es dato, no código:
 * se lee sin levantar infraestructura y se revisa de un vistazo.
 */
export const PARAMETROS_DE_IDENTIDAD = {
  'bloqueo.umbralDeIntentos': parametro(
    'bloqueo.umbralDeIntentos',
    5,
    'INTENTOS',
    'PRODUCTO',
    [DECISION_002_A],
    false,
  ),
  'bloqueo.ventana': parametro('bloqueo.ventana', 15 * 60, 'SEGUNDOS', 'PRODUCTO', [DECISION_002_A], false),
  'bloqueo.duracionDelBloqueo': parametro(
    'bloqueo.duracionDelBloqueo',
    15 * 60,
    'SEGUNDOS',
    'PRODUCTO',
    [DECISION_002_A, ART_8_BIS_LDC],
    false,
  ),
  'bloqueo.demoraBase': parametro('bloqueo.demoraBase', 1, 'SEGUNDOS', 'PRODUCTO', [DECISION_002_A], false),
  'bloqueo.demoraMaxima': parametro('bloqueo.demoraMaxima', 30, 'SEGUNDOS', 'PRODUCTO', [DECISION_002_A], false),
  'contrasena.longitudMinima': parametro(
    'contrasena.longitudMinima',
    12,
    'CARACTERES',
    'PRODUCTO',
    [NIST_800_63B],
    false,
  ),
  'contrasena.longitudMaxima': parametro(
    'contrasena.longitudMaxima',
    128,
    'CARACTERES',
    'PRODUCTO',
    [NIST_800_63B],
    false,
  ),
  'contrasena.longitudMinimaDeTokenDeCuenta': parametro(
    'contrasena.longitudMinimaDeTokenDeCuenta',
    4,
    'CARACTERES',
    'PRODUCTO',
    [NIST_800_63B],
    false,
  ),
  /**
   * Único parámetro **normativo** del dominio de identidad: cuánto vale una
   * verificación de matrícula antes de tener que repetirse. El dictamen lo
   * marcó `[I]` (propuesta del revisor) y `[D]` (el estudio podría tener
   * criterio según la práctica de los colegios), así que arranca con la marca
   * de validación profesional encendida.
   */
  'matricula.vigenciaVerificacion': parametro(
    'matricula.vigenciaVerificacion',
    12,
    'MESES',
    'NORMATIVO',
    [SALVAGUARDA_M2],
    true,
  ),
  'matricula.plazoMaximoRevision': parametro(
    'matricula.plazoMaximoRevision',
    7 * 24 * 60 * 60,
    'SEGUNDOS',
    'PRODUCTO',
    [ESCALAMIENTO_E5, ART_8_BIS_LDC],
    false,
  ),
  'credencial.ventanaDeReautenticacion': parametro(
    'credencial.ventanaDeReautenticacion',
    5 * 60,
    'SEGUNDOS',
    'PRODUCTO',
    [RECAUDO_B3],
    false,
  ),
} as const satisfies Readonly<Record<ClaveParametroIdentidad, ParametroDeIdentidad<number>>>;

/** Lista plana de los parámetros, para los tests de forma y para el back-office. */
export const LISTA_DE_PARAMETROS: readonly ParametroDeIdentidad<number>[] =
  Object.values(PARAMETROS_DE_IDENTIDAD);

/* ── Políticas armadas a partir de los parámetros ─────────────────────────── */

/**
 * Política de bloqueo por defecto (decisión 002-A, CA-37).
 * `laRecuperacionSiempreDisponible` es el literal `true` del contrato: no hay
 * forma de construir una política que deje a alguien sin salida (CA-36,
 * recaudo A-1).
 */
export const POLITICA_DE_BLOQUEO_POR_DEFECTO: PoliticaDeBloqueo = {
  umbralDeIntentos: PARAMETROS_DE_IDENTIDAD['bloqueo.umbralDeIntentos'].valor,
  ventana: duracionLiteral(PARAMETROS_DE_IDENTIDAD['bloqueo.ventana'].valor),
  duracionDelBloqueo: duracionLiteral(PARAMETROS_DE_IDENTIDAD['bloqueo.duracionDelBloqueo'].valor),
  laRecuperacionSiempreDisponible: true,
};

/** Política de contraseñas por defecto (ADR-024 §3, NIST SP 800-63B). */
export const POLITICA_DE_CONTRASENA_POR_DEFECTO: PoliticaDeContrasena = {
  longitudMinima: PARAMETROS_DE_IDENTIDAD['contrasena.longitudMinima'].valor,
  longitudMaxima: PARAMETROS_DE_IDENTIDAD['contrasena.longitudMaxima'].valor,
  rechazaContrasenasFiltradas: true,
  rechazaDatosDelUsuario: true,
};

/** Plazo máximo de revisión de una matrícula pendiente (CA-31, v4). */
export const PLAZO_MAXIMO_DE_REVISION_DE_MATRICULA: DuracionEnSegundos = duracionLiteral(
  PARAMETROS_DE_IDENTIDAD['matricula.plazoMaximoRevision'].valor,
);

/** Ventana de reautenticación fuerte para operar sobre credenciales (B-3). */
export const VENTANA_DE_REAUTENTICACION: DuracionEnSegundos = duracionLiteral(
  PARAMETROS_DE_IDENTIDAD['credencial.ventanaDeReautenticacion'].valor,
);
