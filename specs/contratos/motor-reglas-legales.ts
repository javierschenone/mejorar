/**
 * Contrato público del Motor de reglas legales argentinas.
 *
 * | Campo | Valor |
 * | --- | --- |
 * | Contrato | `motor-reglas-legales` |
 * | Versión | `1` (`motor-reglas-legales/v1`) |
 * | Spec de origen | `specs/004-motor-reglas-legales/spec.md` (v2, aprobada en G1) |
 * | Plan | `specs/004-motor-reglas-legales/plan.md` |
 * | Estado | PROPUESTO — pendiente de aprobación humana en G2 |
 * | Autor | `arquitecto` |
 * | Implementa | `dev-dominio` en `packages/shared/src/motor-legal/**` |
 *
 * ESTE ARCHIVO ES SÓLO DECLARACIONES. No contiene ni una implementación.
 *
 * Reglas de lectura obligatorias:
 *
 * 1. Este archivo es la **fuente normativa** del contrato. El archivo
 *    `packages/shared/src/motor-legal/contrato/v1.ts` debe ser **idéntico byte a
 *    byte** a éste; el pipeline lo verifica (ver ADR-017).
 * 2. Todo campo cuyo valor puede faltar se declara **requerido y anulable**
 *    (`: T | null`), nunca opcional (`?:`). "No lo sé" es una decisión explícita
 *    de quien llama, no una omisión. R-05 de la spec depende de esto.
 * 3. Todo objeto es `readonly` en profundidad. El motor no muta su entrada.
 * 4. El motor **no lanza excepciones** como flujo de control: devuelve
 *    `Resultado`.
 * 5. El motor **no lee el reloj, ni el entorno, ni la red, ni el disco**.
 *    Todo lo que necesita entra por parámetro.
 */

/* ───────────────────────────────────────────────────────────────────────────
 * 0. Identificación del contrato y de la versión del motor
 * ────────────────────────────────────────────────────────────────────────── */

export type VersionContrato = 'motor-reglas-legales/v1';

/** Versión semántica del paquete que produjo la salida. Ej.: `'1.4.0'`. */
export type VersionMotor = string & { readonly [marcaVersionMotor]: 'VersionMotor' };

declare const marcaVersionMotor: unique symbol;

/* ───────────────────────────────────────────────────────────────────────────
 * 1. Marcas nominales (identificadores opacos, fechas, dinero)
 * ────────────────────────────────────────────────────────────────────────── */

declare const marcaIdOpaco: unique symbol;
declare const marcaFecha: unique symbol;
declare const marcaCentavos: unique symbol;
declare const marcaRatificado: unique symbol;

/**
 * Identificador opaco. No deriva de ningún dato identificatorio de la persona:
 * es una referencia sin significado (UUIDv4 / ULID) que sólo el sistema que
 * llama puede resolver a una identidad, con su propio registro de auditoría.
 *
 * CA-60. La correspondencia identificador ↔ persona vive fuera del motor.
 */
export type IdOpaco<TEntidad extends string> = string & {
  readonly [marcaIdOpaco]: TEntidad;
};

export type IdDeuda = IdOpaco<'deuda'>;
export type IdPersona = IdOpaco<'persona'>;
export type IdCuenta = IdOpaco<'cuenta'>;
export type IdAcreedor = IdOpaco<'acreedor'>;
export type IdRegistroCrediticio = IdOpaco<'registro-crediticio'>;
export type IdAfectacion = IdOpaco<'afectacion'>;
export type IdProfesional = IdOpaco<'profesional'>;
export type IdOperador = IdOpaco<'operador'>;

/**
 * Construye un identificador opaco validando que el valor **no** tenga forma
 * de dato identificatorio (DNI de 7 u 8 dígitos, CUIT/CUIL de 11, dirección de
 * correo, cadena con espacios). Es la guarda de CA-60 en tiempo de ejecución,
 * para el borde HTTP donde los tipos ya no existen.
 */
export declare function crearIdOpaco<TEntidad extends string>(
  entidad: TEntidad,
  valor: string,
): Resultado<IdOpaco<TEntidad>, ErrorMotor>;

/**
 * Fecha civil argentina en formato `AAAA-MM-DD`, sin hora y sin zona horaria.
 *
 * El motor no usa `Date`: los plazos legales se cuentan en días civiles y
 * `Date` arrastra zona horaria, horario de verano y el reloj del proceso, que
 * son tres fuentes de indeterminismo (CA-31).
 */
export type FechaCivil = string & { readonly [marcaFecha]: 'FechaCivil' };

/**
 * Fecha del hecho evaluado. Es la fecha contra la que se resuelve todo
 * parámetro normativo y todo valor de referencia (CA-18, CA-29, CA-35).
 */
export type FechaDelHecho = FechaCivil & { readonly [marcaFecha]: 'FechaDelHecho' };

/**
 * Fecha en que se corre la evaluación. Entra por parámetro (CA-31).
 *
 * Tiene marca propia justamente para que **no** pueda usarse donde se espera
 * una `FechaDelHecho`: confundirlas es exactamente el defecto que CA-29 y CA-18
 * previenen, y acá es un error de compilación.
 */
export type FechaDeEvaluacion = FechaCivil & { readonly [marcaFecha]: 'FechaDeEvaluacion' };

export declare function comoFechaCivil(texto: string): Resultado<FechaCivil, ErrorMotor>;
export declare function comoFechaDelHecho(fecha: FechaCivil): FechaDelHecho;
export declare function comoFechaDeEvaluacion(fecha: FechaCivil): FechaDeEvaluacion;

/* ───────────────────────────────────────────────────────────────────────────
 * 2. Dinero, tasas y redondeo  (CA-32, R-07 — ver ADR-011)
 * ────────────────────────────────────────────────────────────────────────── */

export type Moneda = 'ARS' | 'USD' | 'EUR';

/** Centavos enteros. `bigint`, nunca `number`, nunca punto flotante. */
export type Centavos = bigint & { readonly [marcaCentavos]: 'Centavos' };

export interface Monto {
  readonly centavos: Centavos;
  readonly moneda: Moneda;
}

/**
 * Número racional exacto (numerador / denominador en `bigint`). Es el único
 * tipo con el que el motor hace aritmética intermedia: tasas, prorrateos y
 * proporciones. El redondeo ocurre **una sola vez**, al construir un `Monto`.
 */
export interface Racional {
  readonly n: bigint;
  readonly d: bigint;
}

export type BaseTasa = 'TNA' | 'TEA' | 'MENSUAL' | 'DIARIA';

export interface Tasa {
  /** Expresada como proporción exacta: 0,25 es `{ n: 1n, d: 4n }`. */
  readonly valor: Racional;
  readonly base: BaseTasa;
}

export type TipoTasa = 'COMPENSATORIA' | 'PUNITORIA' | 'CFT' | 'REFERENCIA';

export interface TasaPactada {
  readonly tipo: TipoTasa;
  readonly tasa: Tasa;
  readonly vigenteDesde: FechaCivil | null;
  readonly vigenteHasta: FechaCivil | null;
}

/**
 * Rol del monto dentro del hallazgo. Determina el sentido del redondeo cuando
 * la norma no dispone otra cosa (CA-32, constitución #1).
 *
 * - `PISO_DE_PROTECCION`: porción intocable del ingreso → se redondea **hacia
 *   arriba**, protege más al cliente.
 * - `TECHO_DE_AFECTACION`: máximo que un tercero puede retenerle → **hacia
 *   abajo**.
 * - `TECHO_DE_COBRO_AL_CLIENTE`: máximo que se le puede cobrar (honorario,
 *   comisión) → **hacia abajo**.
 * - `RECLAMO_ESTIMADO`: monto que el cliente eventualmente reclamaría →
 *   **hacia abajo**, criterio conservador. Sobreestimar un reclamo perjudica al
 *   cliente (destruye la credibilidad del caso, RL-07) e infla la base de
 *   comisión (RL-09, CA-61). Ver escalamiento E-1 del plan.
 * - `SEGUN_NORMA`: la norma fija el criterio; prevalece sobre todo lo anterior.
 */
export type RolDelMonto =
  | 'PISO_DE_PROTECCION'
  | 'TECHO_DE_AFECTACION'
  | 'TECHO_DE_COBRO_AL_CLIENTE'
  | 'RECLAMO_ESTIMADO'
  | 'SEGUN_NORMA';

export type SentidoRedondeo = 'HACIA_ARRIBA' | 'HACIA_ABAJO' | 'AL_MAS_CERCANO';

export interface ReglaRedondeoNormativa {
  readonly sentido: SentidoRedondeo;
  readonly unidadEnCentavos: bigint;
  readonly fundamento: CitaNormativa;
}

export interface RedondeoAplicado {
  readonly rol: RolDelMonto;
  readonly sentido: SentidoRedondeo;
  readonly unidadEnCentavos: bigint;
  readonly fundamento: CitaNormativa | null;
}

export declare function redondear(
  valor: Racional,
  moneda: Moneda,
  rol: RolDelMonto,
  reglaNormativa: ReglaRedondeoNormativa | null,
): { readonly monto: Monto; readonly redondeo: RedondeoAplicado };

/* ───────────────────────────────────────────────────────────────────────────
 * 3. Resultado, errores e INDETERMINABLE  (ver ADR-012)
 * ────────────────────────────────────────────────────────────────────────── */

export type Resultado<TValor, TError = ErrorMotor> =
  | { readonly ok: true; readonly valor: TValor }
  | { readonly ok: false; readonly error: TError };

/**
 * Un error del motor es un defecto: entrada inválida, catálogo mal armado o
 * bloqueo de producción. **Nunca** es "falta un dato": eso es INDETERMINABLE,
 * que es un resultado legítimo y no un error.
 */
export type ClaseErrorMotor =
  /** CA-58. Se intentó usar un parámetro sin ratificar en entorno productivo. */
  | 'PARAMETRO_SIN_RATIFICAR_EN_PRODUCCION'
  /** CA-60. Guarda de minimización en tiempo de ejecución. */
  | 'MINIMIZACION_VULNERADA'
  /** §7 de la spec: fecha de exigibilidad futura, montos negativos, etc. */
  | 'ENTRADA_INVALIDA'
  /** Tramos de vigencia solapados, catálogo sin versión, cita sin artículo. */
  | 'CATALOGO_INVALIDO'
  /** Se referenció una plantilla inexistente o una versión inexistente. */
  | 'PLANTILLA_INEXISTENTE'
  /** Valor de referencia presente pero sin activación humana (CA-59). */
  | 'VALOR_REFERENCIA_SIN_ACTIVACION'
  /** Defecto del propio motor. Nunca debería ocurrir; si ocurre, se registra. */
  | 'INCONSISTENCIA_INTERNA';

export interface ErrorMotor {
  readonly clase: ClaseErrorMotor;
  /** Identificador estable del mensaje. El texto se resuelve por plantilla. */
  readonly codigo: string;
  /** Campo de la entrada, clave de parámetro o clave de plantilla implicada. */
  readonly referencia: RutaCampoEntrada | ClaveParametro | ClaveValorReferencia | IdPlantilla | null;
  readonly detalle: DetalleError;
}

/** Sólo valores cerrados: el error no lleva texto libre sobre el caso (S-05). */
export interface DetalleError {
  readonly fechaDeEvaluacion: FechaDeEvaluacion | null;
  readonly versionCatalogo: VersionCatalogo | null;
  readonly datos: readonly ValorDePlantilla[];
}

export type MotivoIndeterminable =
  | 'DATO_AUSENTE'
  | 'DATO_INCONSISTENTE'
  | 'PARAMETRO_A_DETERMINAR'
  | 'PARAMETRO_SIN_RATIFICAR'
  | 'PARAMETRO_SIN_TRAMO_VIGENTE_A_LA_FECHA_DEL_HECHO'
  | 'JURISDICCION_SIN_PARAMETROS'
  | 'REGIMEN_NO_PARAMETRIZADO'
  | 'VALOR_REFERENCIA_AUSENTE_A_LA_FECHA';

/**
 * Nombra con precisión el dato que falta. `campo` es una ruta cerrada, no una
 * cadena libre: el motor no inventa lenguaje sobre el caso (CA-49, S-05).
 */
export interface DatoFaltante {
  readonly motivo: MotivoIndeterminable;
  readonly campo: RutaCampoEntrada | null;
  readonly parametro: ClaveParametro | null;
  readonly valorReferencia: ClaveValorReferencia | null;
}

/**
 * INDETERMINABLE. Resultado de primera clase, no un error ni un caso vacío
 * (CA-07, CA-13, CA-26, CA-35, CA-39, CA-40, CA-41, CA-52).
 *
 * Invariante: `faltantes.length >= 1`. Un INDETERMINABLE que no nombra qué
 * falta es un defecto y lo verifica un test.
 */
export interface Indeterminable {
  readonly estado: 'INDETERMINABLE';
  readonly faltantes: readonly DatoFaltante[];
  readonly plantilla: ReferenciaPlantilla;
  readonly accionesSugeridas: readonly AccionSugerida[];
  readonly trazabilidad: Trazabilidad;
}

/* ───────────────────────────────────────────────────────────────────────────
 * 4. Minimización por tipo  (CA-60, condición C-10 — ver ADR-015)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Claves que el contrato de entrada del motor no admite en ningún nivel de
 * anidamiento. No es una convención: es una restricción de compilación.
 */
export type ClaveProhibidaPorMinimizacion =
  | 'nombre' | 'nombres' | 'apellido' | 'apellidos' | 'nombreCompleto' | 'razonSocial'
  | 'dni' | 'documento' | 'numeroDocumento' | 'tipoDocumento' | 'nroDocumento'
  | 'cuit' | 'cuil' | 'cuitCuil' | 'claveTributaria' | 'cdi'
  | 'domicilio' | 'direccion' | 'calle' | 'numeroCalle' | 'piso' | 'departamento'
  | 'localidad' | 'partido' | 'codigoPostal' | 'barrio'
  | 'email' | 'correo' | 'correoElectronico' | 'telefono' | 'celular'
  | 'fechaNacimiento' | 'nacionalidad' | 'genero' | 'estadoCivil'
  | 'cbu' | 'alias' | 'numeroCuenta' | 'numeroTarjeta' | 'ultimosDigitos'
  | 'legajo' | 'empleador' | 'foto' | 'firma';

/**
 * `true` si `T` contiene, en cualquier nivel, una clave prohibida.
 * Recorre objetos y arreglos. No recorre tipos recursivos infinitos: la entrada
 * del motor es un árbol de profundidad acotada.
 */
export type ContieneClaveProhibida<T> =
  T extends readonly (infer U)[]
    ? ContieneClaveProhibida<U>
    : T extends object
      ? Extract<keyof T, ClaveProhibidaPorMinimizacion> extends never
        ? { [K in keyof T]: ContieneClaveProhibida<T[K]> }[keyof T]
        : true
      : never;

/**
 * `T` si respeta la minimización; `never` si no.
 *
 * Usado como intersección en la firma de `evaluar`, convierte cualquier intento
 * de pasar datos identificatorios del deudor en un error de compilación, aun
 * cuando el objeto venga en una variable (donde el chequeo de propiedades en
 * exceso no actúa).
 */
export type Minimizada<T> = true extends ContieneClaveProhibida<T> ? never : T;

/**
 * Guarda equivalente en tiempo de ejecución, para el borde HTTP donde los tipos
 * ya no existen. `dev-backend` la invoca antes de llamar al motor.
 */
export declare function verificarMinimizacion(
  entrada: unknown,
): Resultado<true, ErrorMotor>;

/* ───────────────────────────────────────────────────────────────────────────
 * 5. Citas normativas, trazabilidad y catálogo de parámetros (ver ADR-010)
 * ────────────────────────────────────────────────────────────────────────── */

export type TipoNorma =
  | 'LEY' | 'DECRETO' | 'DNU' | 'CODIGO' | 'RESOLUCION'
  | 'COMUNICACION_BCRA' | 'LEY_PROVINCIAL' | 'JURISPRUDENCIA';

/** CA-27: toda cita lleva artículo. `articulo: null` sólo para jurisprudencia. */
export interface CitaNormativa {
  readonly tipo: TipoNorma;
  readonly identificacion: string;
  readonly articulo: string | null;
  readonly inciso: string | null;
  readonly textoVigenteDesde: FechaCivil | null;
  readonly textoVigenteHasta: FechaCivil | null;
  readonly urlFuenteOficial: string | null;
  /** `false` si el texto no pudo leerse en fuente oficial (dictamen §8). */
  readonly verificadaEnFuenteOficial: boolean;
}

export type Jurisdiccion =
  | 'NACIONAL' | 'FEDERAL' | 'CABA'
  | 'BUENOS_AIRES' | 'CATAMARCA' | 'CHACO' | 'CHUBUT' | 'CORDOBA' | 'CORRIENTES'
  | 'ENTRE_RIOS' | 'FORMOSA' | 'JUJUY' | 'LA_PAMPA' | 'LA_RIOJA' | 'MENDOZA'
  | 'MISIONES' | 'NEUQUEN' | 'RIO_NEGRO' | 'SALTA' | 'SAN_JUAN' | 'SAN_LUIS'
  | 'SANTA_CRUZ' | 'SANTA_FE' | 'SANTIAGO_DEL_ESTERO' | 'TIERRA_DEL_FUEGO'
  | 'TUCUMAN';

/**
 * Claves del catálogo normativo. Unión cerrada: una clave mal escrita es un
 * error de compilación y no un INDETERMINABLE silencioso.
 *
 * Cambiar el **valor** de un parámetro no toca este tipo ni ninguna función del
 * motor (CA-30). Agregar un parámetro nuevo sí: es un cambio de contrato y pasa
 * por G2.
 */
export type ClaveParametro =
  // A — prescripción
  | 'prescripcion.plazoGenerico'
  | 'prescripcion.plazoPeriodico'
  | 'prescripcion.plazoTarjetaEjecutiva'
  | 'prescripcion.plazoTarjetaOrdinaria'
  | 'prescripcion.plazoAccionCambiaria'
  | 'prescripcion.plazoSaldoCuentaCorriente'
  | 'prescripcion.plazoRelacionConsumo'
  | 'prescripcion.reglaDiesAQuo'
  | 'prescripcion.reglaTransicionCCyC'
  | 'prescripcion.reglaDesempateRegimenes'
  | 'prescripcion.hechosInterruptivos'
  | 'prescripcion.hechosSuspensivos'
  | 'prescripcion.duracionSuspensionInterpelacion'
  | 'prescripcion.interpelacionUnicaVez'
  | 'prescripcion.duracionEfectoPeticionJudicial'
  | 'prescripcion.oportunidadProcesalOposicion'
  | 'prescripcion.umbralAlertaDias'
  // B — intereses
  | 'intereses.relacionMaxPunitorioSobreCompensatorio.general'
  | 'intereses.topeCompensatorio.tarjeta.emisorBancario'
  | 'intereses.topeCompensatorio.tarjeta.emisorNoBancario'
  | 'intereses.topePunitorio.tarjeta'
  | 'intereses.punitorioNoCapitalizable.tarjeta'
  | 'intereses.improcedenciaPunitorios.tarjeta.pagoMinimo'
  | 'intereses.capitalizacion.periodicidadMinimaPactable'
  | 'intereses.capitalizacion.supuestosAdmitidos'
  | 'intereses.normalizacion.convencionFinanciera'
  | 'intereses.art36LDC.datosObligatorios'
  | 'intereses.moraAutomatica'
  | 'intereses.umbralAlertaDesproporcionGeneral'
  // C — archivo crediticio
  | 'archivoCrediticio.plazoGeneral'
  | 'archivoCrediticio.plazoAbreviadoPorExtincion'
  | 'archivoCrediticio.diesAQuo.plazoGeneral'
  | 'archivoCrediticio.diesAQuo.plazoAbreviado'
  | 'archivoCrediticio.registro.bureauPrivado'
  | 'archivoCrediticio.registro.centralDeudoresBCRA'
  | 'archivoCrediticio.umbralAlertaDias'
  // D — embargabilidad
  | 'embargo.escalaRemuneracion'
  | 'embargo.baseDeCalculo'
  | 'embargo.tratamientoSAC'
  | 'embargo.excepcionAlimentos'
  | 'embargo.haberesPrevisionales'
  | 'embargo.indemnizacionesLaborales'
  | 'embargo.cuentaSueldo.intangibilidad'
  // E — honorarios
  | 'cuotaLitis.topeGeneral'
  | 'cuotaLitis.topeAmpliado.conAsuncionDeCostas'
  | 'cuotaLitis.topeMateriasProtegidas'
  | 'cuotaLitis.topeLaboral'
  | 'cuotaLitis.baseDeCalculo'
  | 'comision.topeContractualPlataforma'
  | 'comision.compromisoInternoSumaSobreBeneficioNeto'
  | 'honorarios.prohibicionParticion';

/**
 * Tipos de valor que un parámetro puede tomar. Cerrado a propósito: no hay
 * `unknown` ni `any` en el catálogo.
 */
export type ValorParametro =
  | { readonly clase: 'PLAZO_EN_ANIOS'; readonly anios: number }
  | { readonly clase: 'PLAZO_EN_DIAS_CORRIDOS'; readonly dias: number }
  | { readonly clase: 'PLAZO_EN_MESES'; readonly meses: number }
  | { readonly clase: 'PROPORCION'; readonly valor: Racional }
  | { readonly clase: 'BOOLEANO'; readonly valor: boolean }
  | { readonly clase: 'ESCALA_EMBARGABILIDAD'; readonly tramos: readonly TramoEmbargabilidad[] }
  | { readonly clase: 'CATALOGO_HECHOS_INTERRUPTIVOS'; readonly tipos: readonly TipoHechoInterruptivo[] }
  | { readonly clase: 'CATALOGO_HECHOS_SUSPENSIVOS'; readonly tipos: readonly TipoHechoSuspensivo[] }
  | { readonly clase: 'REGLA_DIES_A_QUO'; readonly hecho: HechoDiesAQuo }
  | { readonly clase: 'REGLA_DESEMPATE'; readonly criterio: CriterioDesempate }
  | { readonly clase: 'BASE_TOPE_TARJETA'; readonly base: BaseTopeTarjeta }
  | { readonly clase: 'CONVENCION_FINANCIERA'; readonly convencion: ConvencionFinanciera }
  | { readonly clase: 'LISTA_DATOS_OBLIGATORIOS'; readonly datos: readonly DatoPrecontractual[] }
  | { readonly clase: 'NO_DETERMINADO' };

export type HechoDiesAQuo =
  | 'EXIGIBILIDAD_DE_CADA_CUOTA'
  | 'CADUCIDAD_DE_PLAZOS'
  | 'MORA_AUTOMATICA'
  | 'INTERPELACION'
  | 'FECHA_DE_MORA_INFORMADA'
  | 'ULTIMA_INFORMACION_ADVERSA'
  | 'PRIMERA_INFORMACION_DEL_DATO'
  | 'ULTIMO_MOVIMIENTO_DE_LA_CUENTA'
  | 'EXTINCION_DE_LA_OBLIGACION';

export type CriterioDesempate =
  | 'PLAZO_MAS_BREVE'
  | 'PLAZO_MAS_FAVORABLE_AL_CONSUMIDOR'
  | 'REGIMEN_ESPECIAL_DESPLAZA_AL_GENERAL'
  | 'SIN_REGLA';

export type BaseTopeTarjeta =
  | 'TASA_DEL_PROPIO_EMISOR_PRESTAMOS_PERSONALES'
  | 'PROMEDIO_BCRA_PRESTAMOS_PERSONALES'
  | 'TASA_EFECTIVAMENTE_APLICADA_ART_16';

export type ConvencionFinanciera = 'ACTUAL_365' | 'ACTUAL_360' | 'TREINTA_360';

export type DatoPrecontractual =
  | 'TNA' | 'TEA' | 'COSTO_FINANCIERO_TOTAL'
  | 'CANTIDAD_DE_CUOTAS' | 'PERIODICIDAD_DE_CUOTAS' | 'MONTO_TOTAL_FINANCIADO';

export interface TramoEmbargabilidad {
  /** Límite inferior del tramo, expresado en múltiplos del valor de referencia. */
  readonly desdeEnVecesValorReferencia: Racional;
  readonly hastaEnVecesValorReferencia: Racional | null;
  readonly porcentaje: Racional;
  /**
   * Sobre qué excedente se aplica el porcentaje. Es parámetro y no supuesto:
   * el dictamen §8.1 marca justamente este punto como el más urgente de
   * verificar del análisis D.
   */
  readonly baseDelExcedente: 'VALOR_REFERENCIA_BASE' | 'LIMITE_INFERIOR_DEL_TRAMO';
  readonly valorReferenciaBase: ClaveValorReferencia;
}

/**
 * Estado de ratificación profesional. Unión discriminada: no existe forma de
 * representar "ratificado" sin los datos del profesional que ratificó (C-03).
 */
export type EstadoRatificacion =
  | { readonly estado: 'SIN_RATIFICAR' }
  | { readonly estado: 'RATIFICADO'; readonly ratificacion: RatificacionProfesional };

export interface RatificacionProfesional {
  readonly idProfesional: IdProfesional;
  readonly matricula: string;
  readonly jurisdiccionMatricula: Jurisdiccion;
  readonly fecha: FechaCivil;
  readonly fechaProximaRevision: FechaCivil | null;
  readonly referenciaDocumentoFirmado: string;
}

/**
 * Un **tramo de vigencia** de un parámetro. Un parámetro desdoblado por
 * vigencia (el tope de punitorios de tarjeta antes y después del DNU 70/2023,
 * CA-35) son dos tramos de la misma clave con vigencias contiguas.
 */
export interface TramoParametro {
  readonly clave: ClaveParametro;
  readonly jurisdiccion: Jurisdiccion | 'TODAS';
  readonly valor: ValorParametro;
  readonly vigenciaDesde: FechaCivil;
  /** `null` = vigente sin término conocido. */
  readonly vigenciaHasta: FechaCivil | null;
  readonly fundamento: readonly CitaNormativa[];
  readonly ratificacion: EstadoRatificacion;
  readonly notaDeAlcance: ClaveNotaDeAlcance | null;
}

/** Notas cerradas; no son texto libre. Se renderizan por plantilla. */
export type ClaveNotaDeAlcance =
  | 'TEXTO_SUSTITUIDO_POR_DNU_70_2023'
  | 'PENDIENTE_VERIFICACION_DOCUMENTAL'
  | 'UMBRAL_DE_ALERTA_INTERNO_NO_TOPE_LEGAL'
  | 'CRITERIO_JURISPRUDENCIAL_NO_LEGAL'
  | 'PARAMETRO_DE_PRODUCTO_NO_NORMATIVO';

export type VersionCatalogo = string & { readonly [marcaIdOpaco]: 'version-catalogo' };

/**
 * Conjunto completo e inmutable de parámetros, identificado por versión.
 * El motor **recibe** el catálogo; no lo busca, no lo carga, no lo cachea.
 *
 * Reproducibilidad (CA-27, CA-31): con `version` + `huellaContenido` +
 * `fechaDeEvaluacion` + entrada, cualquier resultado pasado se recalcula
 * exactamente igual.
 */
export interface CatalogoNormativo {
  readonly version: VersionCatalogo;
  /** Hash del contenido canonicalizado. Lo calcula la infraestructura. */
  readonly huellaContenido: string;
  readonly generadoEl: FechaCivil;
  readonly tramos: readonly TramoParametro[];
}

/** Invariantes: sin solapamiento por (clave, jurisdicción), citas con artículo. */
export declare function validarCatalogo(
  catalogo: CatalogoNormativo,
): Resultado<true, readonly ErrorMotor[]>;

/**
 * Resolución de un parámetro **a la fecha del hecho** (CA-18, CA-29, CA-35).
 *
 * No admite `FechaDeEvaluacion` por tipo. No tiene fallback a otra jurisdicción
 * (CA-52) ni al tramo más reciente: si no hay tramo vigente, devuelve
 * `SIN_TRAMO_VIGENTE` y el análisis produce INDETERMINABLE.
 */
export type ResolucionParametro =
  | { readonly clase: 'RESUELTO'; readonly tramo: TramoParametro }
  | { readonly clase: 'SIN_TRAMO_VIGENTE'; readonly clave: ClaveParametro }
  | { readonly clase: 'SIN_JURISDICCION'; readonly clave: ClaveParametro; readonly jurisdiccion: Jurisdiccion }
  | { readonly clase: 'A_DETERMINAR'; readonly clave: ClaveParametro };

export declare function resolverParametro(
  catalogo: CatalogoNormativo,
  clave: ClaveParametro,
  jurisdiccion: Jurisdiccion,
  fechaDelHecho: FechaDelHecho,
): ResolucionParametro;

/**
 * Tramo cuya ratificación profesional está acreditada. Marca nominal: sólo
 * puede obtenerse de `exigirRatificado`. Es lo que hace que CA-39 sea una
 * garantía de tipos y no una convención: el constructor del estado `CADUCADO`
 * exige un `TramoRatificado` para el `diesAQuo`.
 */
export type TramoRatificado = TramoParametro & { readonly [marcaRatificado]: true };

export declare function exigirRatificado(
  tramo: TramoParametro,
): Resultado<TramoRatificado, DatoFaltante>;

/** Registro de uso de un parámetro, para CA-27 y CA-28. */
export interface UsoParametro {
  readonly clave: ClaveParametro;
  readonly jurisdiccion: Jurisdiccion | 'TODAS';
  readonly vigenciaDesde: FechaCivil;
  readonly vigenciaHasta: FechaCivil | null;
  readonly fundamento: readonly CitaNormativa[];
  readonly requiereValidacionProfesional: boolean;
  readonly notaDeAlcance: ClaveNotaDeAlcance | null;
}

/* ───────────────────────────────────────────────────────────────────────────
 * 6. Valores de referencia variables  (CA-59 — ver ADR-018)
 * ────────────────────────────────────────────────────────────────────────── */

export type ClaveValorReferencia =
  | 'SMVM'
  | 'PROMEDIO_BCRA_PRESTAMOS_PERSONALES'
  | 'TASA_PROPIO_EMISOR_PRESTAMOS_PERSONALES';

export interface FuenteOficial {
  readonly organismo: string;
  readonly identificacionDelActo: string;
  readonly url: string | null;
  readonly fechaDeObtencion: FechaCivil;
}

/**
 * Activación humana. Es obligatoria y no anulable: un valor obtenido de forma
 * automática y todavía no activado **no puede representarse** con este tipo,
 * así que no puede llegar al motor (CA-59, R-13).
 */
export interface ActivacionHumana {
  readonly idOperador: IdOperador;
  readonly fechaDeActivacion: FechaCivil;
}

export type ValorDeReferencia =
  | { readonly clase: 'MONTO'; readonly monto: Monto }
  | { readonly clase: 'TASA'; readonly tasa: Tasa };

export interface TramoValorReferencia {
  readonly clave: ClaveValorReferencia;
  readonly valor: ValorDeReferencia;
  readonly vigenciaDesde: FechaCivil;
  readonly vigenciaHasta: FechaCivil | null;
  readonly fuente: FuenteOficial;
  readonly activacion: ActivacionHumana;
}

export interface TablaValoresReferencia {
  readonly version: string;
  readonly tramos: readonly TramoValorReferencia[];
}

export type ResolucionValorReferencia =
  | { readonly clase: 'RESUELTO'; readonly tramo: TramoValorReferencia }
  | { readonly clase: 'SIN_TRAMO_VIGENTE'; readonly clave: ClaveValorReferencia };

export declare function resolverValorReferencia(
  tabla: TablaValoresReferencia,
  clave: ClaveValorReferencia,
  fechaDelHecho: FechaDelHecho,
): ResolucionValorReferencia;

/** Lo que el hallazgo declara sobre cada valor de referencia usado (CA-59). */
export interface UsoValorReferencia {
  readonly clave: ClaveValorReferencia;
  readonly valor: ValorDeReferencia;
  readonly vigenciaDesde: FechaCivil;
  readonly vigenciaHasta: FechaCivil | null;
  readonly fuente: FuenteOficial;
  readonly activacion: ActivacionHumana;
}

/* ───────────────────────────────────────────────────────────────────────────
 * 7. Catálogo cerrado de plantillas y acciones  (CA-48, CA-49, CA-50 — ADR-014)
 * ────────────────────────────────────────────────────────────────────────── */

export type IdPlantilla =
  | 'ENCABEZADO_GLOBAL_DIAGNOSTICO'
  | 'A_HALLAZGO_PRESCRIPCION'
  | 'A_ADVERTENCIA_PREVENTIVA'
  | 'A_ADVERTENCIA_NO_OPERA_DE_OFICIO'
  | 'A_ADVERTENCIA_EFECTO_INTERRUPTIVO'
  | 'A_ADVERTENCIA_OPORTUNIDAD_PROCESAL'
  | 'A_CONCURRENCIA_DE_REGIMENES'
  | 'A_SEGUNDA_INTERPELACION_NO_SUSPENDE'
  | 'B_POSIBLE_EXCESO_SUJETO_A_CONTROL_JUDICIAL'
  | 'B_TARJETA_EXCESO_COMPENSATORIO'
  | 'B_TARJETA_PUNITORIO_IMPROCEDENTE_POR_PAGO_MINIMO'
  | 'B_TARJETA_PUNITORIO_NO_CAPITALIZABLE'
  | 'B_CAPITALIZACION_INDEBIDA'
  | 'B_RECOMPOSICION_DE_SALDO'
  | 'B_DEBER_DE_INFORMACION_CREDITO_CONSUMO'
  | 'C_DATO_CADUCADO'
  | 'C_DATO_VIGENTE'
  | 'C_DATO_PROXIMO_A_CADUCAR'
  | 'C_REGISTROS_DISTINTOS'
  | 'D_EXCESO_DE_EMBARGO'
  | 'D_CUENTA_SUELDO_INTANGIBLE'
  | 'D_INEMBARGABILIDAD_TOTAL'
  | 'D_INDEMNIZACION_LABORAL'
  | 'D_ADVERTENCIA_CAUSA_ALIMENTARIA'
  | 'E_TOPE_HONORARIO_ABOGADO'
  | 'E_TOPE_COMISION_PLATAFORMA'
  | 'E_ALERTA_COMPROMISO_INTERNO'
  | 'RESULTADO_INDETERMINABLE'
  | 'PARAMETRO_SIN_RATIFICACION_PROFESIONAL'
  | 'NO_CONFUSION_PRESCRIPCION_Y_ARCHIVO'
  | 'ACCION_CLIENTE_CONSULTAR_ABOGADO'
  | 'ACCION_CLIENTE_NO_INNOVAR'
  | 'ACCION_PROFESIONAL';

export type VersionPlantilla = number;

export type Destinatario = 'CLIENTE' | 'ABOGADO' | 'OPERADOR' | 'ADMINISTRADOR';

/**
 * Valores que una plantilla puede recibir. **No hay `string` libre**: el motor
 * no puede inyectar lenguaje propio sobre el caso (S-05, CA-49).
 */
export type ValorDePlantilla =
  | { readonly clase: 'MONTO'; readonly valor: Monto }
  | { readonly clase: 'FECHA'; readonly valor: FechaCivil }
  | { readonly clase: 'DIAS'; readonly valor: number }
  | { readonly clase: 'PROPORCION'; readonly valor: Racional }
  | { readonly clase: 'CITA'; readonly valor: CitaNormativa }
  | { readonly clase: 'TERMINO'; readonly valor: ClaveTerminoControlado };

/** Vocabulario controlado para todo sustantivo que aparezca en una plantilla. */
export type ClaveTerminoControlado =
  | 'REGISTRO_BUREAU_PRIVADO' | 'REGISTRO_CENTRAL_DEUDORES_BCRA'
  | 'EMISOR_BANCARIO' | 'EMISOR_NO_BANCARIO'
  | 'HECHO_RECONOCIMIENTO' | 'HECHO_PAGO_PARCIAL' | 'HECHO_DEMANDA_NOTIFICADA'
  | 'HECHO_SOLICITUD_ARBITRAJE' | 'HECHO_INTERPELACION' | 'HECHO_MEDIACION'
  | 'INGRESO_REMUNERACION' | 'INGRESO_HABER_PREVISIONAL' | 'INGRESO_INDEMNIZACION'
  | 'CAUSA_ALIMENTARIA' | 'CAUSA_COMUN'
  | 'MATERIA_LABORAL' | 'MATERIA_PREVISIONAL' | 'MATERIA_CIVIL_COMERCIAL'
  | 'MATERIA_ALIMENTARIA' | 'MATERIA_CONSUMO';

export interface ReferenciaPlantilla {
  readonly id: IdPlantilla;
  readonly version: VersionPlantilla;
  readonly variables: readonly { readonly nombre: string; readonly valor: ValorDePlantilla }[];
}

export interface PlantillaTexto {
  readonly id: IdPlantilla;
  readonly version: VersionPlantilla;
  readonly destinatarios: readonly Destinatario[];
  /** Texto literal con marcadores `{nombre}`. Fuente: dictamen §3. */
  readonly texto: string;
  readonly obligatoriaJuntoA: readonly IdPlantilla[];
  readonly revisadaPorUx: boolean;
  readonly ratificadaPorProfesional: boolean;
}

export interface CatalogoPlantillas {
  readonly version: string;
  readonly plantillas: readonly PlantillaTexto[];
  /** Lista del dictamen §3.8. Ninguna plantilla puede contener estos términos. */
  readonly terminosProhibidos: readonly string[];
}

export declare function validarCatalogoPlantillas(
  catalogo: CatalogoPlantillas,
): Resultado<true, readonly ErrorMotor[]>;

/**
 * Acciones dirigidas al cliente. Sólo dos, por CA-48 y S-04. La unión cerrada
 * hace imposible que el motor le indique al cliente una conducta procesal.
 */
export type IdAccionCliente =
  | 'CONSULTAR_AL_ABOGADO'
  | 'NO_INNOVAR_SOBRE_LA_DEUDA';

export type IdAccionProfesional =
  | 'INTIMAR_AL_ACREEDOR_A_INFORMAR_COMPOSICION'
  | 'VERIFICAR_TIPO_DE_EMISOR'
  | 'SOLICITAR_RESUMENES_DE_TARJETA'
  | 'EVALUAR_OPOSICION_DE_PRESCRIPCION'
  | 'EVALUAR_MORIGERACION_JUDICIAL_DE_INTERESES'
  | 'EVALUAR_NULIDAD_POR_DEBER_DE_INFORMACION'
  | 'EVALUAR_RECLAMO_DE_SUPRESION_DEL_DATO'
  | 'EVALUAR_PEDIDO_DE_READECUACION_DE_EMBARGO'
  | 'EVALUAR_PLANTEO_DE_INTANGIBILIDAD_DE_CUENTA_SUELDO'
  | 'REVISAR_PROPUESTA_DE_HONORARIOS'
  | 'RATIFICAR_PARAMETRO_PENDIENTE'
  | 'ACTIVAR_VALOR_DE_REFERENCIA'
  | 'AUTORIZAR_COMBINACION_DE_HONORARIO_Y_COMISION';

export type AccionSugerida =
  | {
      readonly destinatario: 'CLIENTE';
      readonly id: IdAccionCliente;
      readonly plantilla: ReferenciaPlantilla;
    }
  | {
      readonly destinatario: Exclude<Destinatario, 'CLIENTE'>;
      readonly id: IdAccionProfesional;
      readonly plantilla: ReferenciaPlantilla;
    };

/* ───────────────────────────────────────────────────────────────────────────
 * 8. Entrada del motor
 * ────────────────────────────────────────────────────────────────────────── */

export type Analisis = 'A_PRESCRIPCION' | 'B_INTERESES' | 'C_ARCHIVO' | 'D_EMBARGABILIDAD' | 'E_HONORARIOS';

/** Rutas cerradas de la entrada, para nombrar con precisión el dato faltante. */
export type RutaCampoEntrada =
  | 'deuda.fechaExigibilidad' | 'deuda.fechaMora' | 'deuda.tipoObligacion'
  | 'deuda.regimen' | 'deuda.moneda' | 'deuda.jurisdiccion'
  | 'deuda.tipoEmisorTarjeta' | 'deuda.composicion' | 'deuda.tasasPactadas'
  | 'deuda.fechaExtincion' | 'deuda.periodosPagoMinimo'
  | 'deuda.informacionPrecontractual' | 'deuda.hechos'
  | 'registrosCrediticios' | 'registrosCrediticios.tipoRegistro'
  | 'registrosCrediticios.fechaPrimeraInformacion'
  | 'registrosCrediticios.fechaUltimaInformacionAdversa'
  | 'registrosCrediticios.fechaMoraInformada'
  | 'ingreso' | 'ingreso.tipo' | 'ingreso.montoNeto' | 'ingreso.periodo'
  | 'afectaciones' | 'afectaciones.causa' | 'afectaciones.montoMensual'
  | 'afectaciones.tipoCuenta'
  | 'propuestaHonorarios' | 'propuestaHonorarios.materia'
  | 'propuestaHonorarios.jurisdiccion' | 'propuestaHonorarios.resultadoEconomicoEstimado';

export type TipoObligacion =
  | 'PRESTAMO_PERSONAL' | 'TARJETA_DE_CREDITO' | 'SALDO_CUENTA_CORRIENTE'
  | 'PAGARE' | 'SERVICIO_PERIODICO' | 'ALQUILER' | 'FISCAL' | 'OTRA';

export type RegimenAplicable = 'GENERAL_CCYC' | 'TARJETA_LEY_25065' | 'CAMBIARIO' | 'CONSUMO_LEY_24240';

export type TipoEmisorTarjeta = 'BANCARIO' | 'NO_BANCARIO';

export type TipoHechoInterruptivo =
  | 'RECONOCIMIENTO_EXPRESO' | 'RECONOCIMIENTO_TACITO' | 'PAGO_PARCIAL'
  | 'PETICION_JUDICIAL_NOTIFICADA' | 'SOLICITUD_DE_ARBITRAJE';

export type TipoHechoSuspensivo =
  | 'INTERPELACION_FEHACIENTE' | 'PEDIDO_DE_MEDIACION' | 'CASO_ESPECIAL_ART_2543';

export type HechoRelevante =
  | {
      readonly clase: 'INTERRUPTIVO';
      readonly tipo: TipoHechoInterruptivo;
      readonly fecha: FechaCivil;
      readonly acreditado: boolean;
    }
  | {
      readonly clase: 'SUSPENSIVO';
      readonly tipo: TipoHechoSuspensivo;
      readonly fechaInicio: FechaCivil;
      readonly fechaFin: FechaCivil | null;
      readonly acreditado: boolean;
    };

export interface ComposicionSaldo {
  readonly capital: Monto;
  readonly interesesCompensatorios: Monto;
  readonly interesesPunitorios: Monto;
  readonly gastosYComisiones: Monto;
  readonly impuestos: Monto;
  readonly saldoReclamado: Monto;
  /** Movimientos de capitalización informados por el acreedor, si los hay. */
  readonly capitalizaciones: readonly { readonly fecha: FechaCivil; readonly monto: Monto }[];
}

export interface PeriodoPagoMinimo {
  readonly periodoDesde: FechaCivil;
  readonly periodoHasta: FechaCivil;
  readonly pagoMinimoExigido: Monto;
  readonly pagoRealizado: Monto;
  readonly fechaDePago: FechaCivil | null;
}

/**
 * Estado triple, no booleano. "No consta" y "está acreditado que no se informó"
 * son cosas distintas y CA-37 sólo puede emitir hallazgo en el segundo caso
 * (ver escalamiento E-3 del plan).
 */
export type ConstanciaDato = 'INFORMADO' | 'ACREDITADO_QUE_NO_SE_INFORMO' | 'SIN_DATOS';

export interface InformacionPrecontractual {
  readonly datos: readonly { readonly dato: DatoPrecontractual; readonly constancia: ConstanciaDato }[];
}

export interface DatosDeuda {
  readonly idDeuda: IdDeuda;
  readonly idAcreedor: IdAcreedor;
  readonly tipoObligacion: TipoObligacion;
  readonly regimenesPosibles: readonly RegimenAplicable[];
  readonly moneda: Moneda;
  readonly jurisdiccion: Jurisdiccion;
  readonly fechaExigibilidad: FechaCivil | null;
  readonly fechaMora: FechaCivil | null;
  readonly fechaExtincion: FechaCivil | null;
  readonly nacidaBajoCodigoCivilDerogado: boolean | null;
  readonly tipoEmisorTarjeta: TipoEmisorTarjeta | null;
  readonly composicion: ComposicionSaldo | null;
  readonly tasasPactadas: readonly TasaPactada[] | null;
  readonly periodosPagoMinimo: readonly PeriodoPagoMinimo[] | null;
  readonly informacionPrecontractual: InformacionPrecontractual | null;
  readonly hechos: readonly HechoRelevante[];
}

export type TipoRegistroCrediticio = 'BUREAU_PRIVADO' | 'CENTRAL_DEUDORES_BCRA';

export interface RegistroCrediticio {
  readonly idRegistro: IdRegistroCrediticio;
  readonly tipoRegistro: TipoRegistroCrediticio;
  readonly fechaPrimeraInformacion: FechaCivil | null;
  readonly fechaMoraInformada: FechaCivil | null;
  readonly fechaUltimaInformacionAdversa: FechaCivil | null;
  readonly fechaUltimoMovimiento: FechaCivil | null;
  readonly obligacionExtinguida: boolean | null;
}

export type TipoIngreso =
  | 'REMUNERACION_DEPENDENCIA' | 'HABER_PREVISIONAL'
  | 'INDEMNIZACION_LABORAL' | 'INGRESO_AUTONOMO' | 'OTRO';

export type PeriodicidadIngreso = 'MENSUAL' | 'QUINCENAL' | 'SEMANAL' | 'UNICA_VEZ';

export interface DatosIngreso {
  readonly tipo: TipoIngreso;
  readonly montoNeto: Monto | null;
  readonly montoBruto: Monto | null;
  readonly periodicidad: PeriodicidadIngreso;
  /** Fecha del período liquidado: es la fecha del hecho del análisis D (CA-18). */
  readonly fechaDelPeriodo: FechaCivil | null;
  readonly incluyeSAC: boolean | null;
}

export type CausaAfectacion = 'ALIMENTARIA' | 'COMUN' | 'LABORAL_A_FAVOR_DEL_TRABAJADOR' | 'FISCAL' | 'DESCONOCIDA';

export type TipoCuentaAfectada = 'CUENTA_SUELDO' | 'CAJA_DE_AHORRO' | 'CUENTA_CORRIENTE' | 'DESCONOCIDA';

export type OrigenAfectacion = 'EMBARGO_JUDICIAL' | 'DEBITO_O_COMPENSACION_DEL_BANCO';

export interface Afectacion {
  readonly idAfectacion: IdAfectacion;
  readonly origen: OrigenAfectacion;
  readonly causa: CausaAfectacion;
  readonly montoMensual: Monto | null;
  readonly idCuenta: IdCuenta | null;
  readonly tipoCuenta: TipoCuentaAfectada;
  readonly vigenteDesde: FechaCivil | null;
  readonly vigenteHasta: FechaCivil | null;
}

export type MateriaDelCaso =
  | 'CIVIL_COMERCIAL' | 'LABORAL' | 'PREVISIONAL' | 'ALIMENTARIA' | 'CONSUMO';

export interface PropuestaHonorarios {
  readonly jurisdiccion: Jurisdiccion;
  readonly materia: MateriaDelCaso;
  readonly porcentajeCuotaLitisPropuesto: Racional | null;
  readonly porcentajeComisionPlataformaPropuesto: Racional | null;
  readonly profesionalAsumeCostas: boolean | null;
  readonly intervieneMenorConRepresentacion: boolean | null;
  readonly resultadoEconomicoEstimado: Monto | null;
  readonly beneficioNetoEstimadoDelCliente: Monto | null;
}

/**
 * Entrada del motor. No contiene ni puede contener datos identificatorios del
 * deudor (CA-60): `Minimizada<E>` lo verifica en compilación y
 * `verificarMinimizacion` en ejecución.
 */
export interface EntradaEvaluacion {
  readonly version: VersionContrato;
  readonly idPersona: IdPersona;
  readonly analisisSolicitados: readonly Analisis[];
  readonly deuda: DatosDeuda;
  readonly registrosCrediticios: readonly RegistroCrediticio[] | null;
  readonly ingreso: DatosIngreso | null;
  readonly afectaciones: readonly Afectacion[] | null;
  readonly propuestaHonorarios: PropuestaHonorarios | null;
}

/* ───────────────────────────────────────────────────────────────────────────
 * 9. Contexto de ejecución y bloqueo de producción  (CA-58 — ver ADR-013)
 * ────────────────────────────────────────────────────────────────────────── */

export type Entorno = 'PRODUCCION' | 'HOMOLOGACION' | 'DESARROLLO' | 'PRUEBA';

/**
 * Contexto de ejecución. Tiene exactamente estos cinco campos y **ninguno de
 * ellos puede relajar el bloqueo de CA-58**. No existe, en ningún punto de la
 * API pública del motor, una opción, bandera, parámetro del catálogo o campo de
 * la entrada que permita usar un parámetro sin ratificar en `PRODUCCION`: el
 * bloqueo no es configurable porque no hay dónde configurarlo (ADR-013).
 *
 * `entorno` no se lee de `process.env` — el motor no accede al entorno. Lo
 * provee `apps/api` desde una constante de despliegue (obligación de frontera
 * F-07 del plan).
 */
export interface ContextoEvaluacion {
  readonly entorno: Entorno;
  readonly fechaDeEvaluacion: FechaDeEvaluacion;
  readonly catalogo: CatalogoNormativo;
  readonly valoresReferencia: TablaValoresReferencia;
  readonly plantillas: CatalogoPlantillas;
}

export type PoliticaParametroSinRatificar = 'BLOQUEA' | 'MARCA_Y_CONTINUA';

/** Función total sobre `Entorno`. `'PRODUCCION'` ⇒ `'BLOQUEA'`, siempre. */
export declare function politicaParametroSinRatificar(
  entorno: Entorno,
): PoliticaParametroSinRatificar;

/* ───────────────────────────────────────────────────────────────────────────
 * 10. Hallazgo  (CA-45 a CA-53, CA-27, CA-32, CA-59, CA-61)
 * ────────────────────────────────────────────────────────────────────────── */

export type NivelCerteza = 'ALTA' | 'MEDIA' | 'BAJA';

export interface Supuesto {
  readonly clave: ClaveSupuesto;
  readonly origen: 'DATO_DE_ENTRADA' | 'PARAMETRO' | 'VALOR_DE_REFERENCIA' | 'REGLA_DEL_MOTOR';
  readonly valor: ValorDePlantilla;
}

export type ClaveSupuesto =
  | 'REGIMEN_DE_PRESCRIPCION_APLICADO'
  | 'DIES_A_QUO_APLICADO'
  | 'HECHO_INTERRUPTIVO_MAS_RECIENTE'
  | 'DURACION_DE_SUSPENSION_COMPUTADA'
  | 'BASE_DE_TOPE_DE_TARJETA'
  | 'CONVENCION_FINANCIERA_DE_NORMALIZACION'
  | 'PERIODICIDAD_DE_CAPITALIZACION_ADMITIDA'
  | 'REGISTRO_CREDITICIO_EVALUADO'
  | 'VALOR_DE_REFERENCIA_DE_INGRESO_MINIMO'
  | 'BASE_DE_CALCULO_DE_LA_REMUNERACION'
  | 'BASE_DE_CALCULO_DEL_RESULTADO_ECONOMICO'
  | 'MONEDA_DE_ORIGEN_SIN_CONVERSION';

export interface Fundamento {
  readonly citas: readonly CitaNormativa[];
  readonly parametrosUsados: readonly UsoParametro[];
  readonly plantilla: ReferenciaPlantilla;
}

/**
 * Clave de superposición: dos hallazgos con la misma clave describen el mismo
 * peso reclamado de más y **no se suman** (§7 de la spec).
 */
export type ClaveSuperposicion =
  | 'SALDO_RECLAMADO' | 'INTERESES_PUNITORIOS' | 'INTERESES_COMPENSATORIOS'
  | 'CAPITALIZACION' | 'RETENCION_SOBRE_INGRESO' | 'COSTO_DEL_SERVICIO_LEGAL';

export interface ImpactoEconomico {
  readonly monto: Monto;
  readonly redondeo: RedondeoAplicado;
  readonly claveSuperposicion: ClaveSuperposicion;
  /** Literal. El motor no puede emitir un impacto que no sea estimación. */
  readonly esEstimacion: true;
  /**
   * Literal `false`. CA-61: el impacto estimado por el motor nunca es base de
   * la comisión de éxito. El cálculo de comisión (spec 018) exige un tipo
   * distinto —`BaseDeComision`— que este valor no satisface.
   */
  readonly aptoComoBaseDeComision: false;
}

/** Tipo nominal que la spec 018 exigirá como única base de comisión (CA-61). */
export interface BaseDeComision {
  readonly resultadoConfirmado: Monto;
  readonly confirmacion: ConfirmacionProfesional;
  readonly aptoComoBaseDeComision: true;
}

export type TipoHallazgo =
  | 'A_POSIBLE_PRESCRIPCION'
  | 'A_CONCURRENCIA_DE_REGIMENES'
  | 'B_POSIBLE_EXCESO_SUJETO_A_CONTROL_JUDICIAL'
  | 'B_TARJETA_EXCESO_COMPENSATORIO'
  | 'B_TARJETA_EXCESO_PUNITORIO'
  | 'B_TARJETA_PUNITORIO_IMPROCEDENTE_POR_PAGO_MINIMO'
  | 'B_CAPITALIZACION_INDEBIDA'
  | 'B_RECOMPOSICION_DE_SALDO'
  | 'B_DEBER_DE_INFORMACION_CREDITO_CONSUMO'
  | 'C_DATO_CADUCADO'
  | 'C_DATO_PROXIMO_A_CADUCAR'
  | 'D_EXCESO_DE_EMBARGO'
  | 'D_INEMBARGABILIDAD_TOTAL'
  | 'D_CUENTA_SUELDO_INTANGIBLE'
  | 'D_INDEMNIZACION_INEMBARGABLE'
  | 'E_EXCESO_HONORARIO_ABOGADO'
  | 'E_EXCESO_COMISION_PLATAFORMA'
  | 'E_COMPROMISO_INTERNO_SUPERADO';

export interface SujetoDelHallazgo {
  readonly idDeuda: IdDeuda;
  readonly idRegistro: IdRegistroCrediticio | null;
  readonly idAfectacion: IdAfectacion | null;
  readonly idCuenta: IdCuenta | null;
}

/**
 * Política de visibilidad del hallazgo (decisión 004-B, CA-54 a CA-57).
 * El motor la **declara**; quien la hace cumplir es la feature 007.
 */
export type PoliticaVisibilidad =
  | {
      readonly clase: 'DIFERIDA_HASTA_CONFIRMACION_PROFESIONAL';
      /** Obligatoria y no anulable: CA-54. El tipo no admite `null`. */
      readonly advertenciaPreventiva: ReferenciaPlantilla;
      /** Literal `true`: CA-56, gratuita e incondicional. */
      readonly advertenciaGratuitaEIncondicional: true;
      readonly plazoMaximoRevisionDiasHabiles: number;
      /** CA-57: el hallazgo confirmado nunca se muestra solo. */
      readonly accionRecomendadaObligatoria: true;
    }
  | {
      readonly clase: 'VISIBLE_PARA_PROFESIONAL_Y_OPERADOR';
      readonly advertenciaPreventiva: ReferenciaPlantilla | null;
    };

export interface Trazabilidad {
  readonly versionContrato: VersionContrato;
  readonly versionMotor: VersionMotor;
  readonly versionCatalogo: VersionCatalogo;
  readonly huellaCatalogo: string;
  readonly versionTablaValoresReferencia: string;
  readonly versionCatalogoPlantillas: string;
  readonly fechaDeEvaluacion: FechaDeEvaluacion;
  readonly fechaDelHechoUsada: FechaDelHecho | null;
}

/**
 * Hallazgo. Forma única para los cinco análisis.
 *
 * `requiereConfirmacionProfesional` es el literal `true` (S-02, CA-46): el
 * motor **no puede** emitir un hallazgo confirmado. La confirmación es un
 * envoltorio externo (`HallazgoRevisado`), que produce la feature 007.
 */
export interface Hallazgo {
  /** Clave natural determinista: `${analisis}:${tipo}:${sujeto}`. */
  readonly id: string;
  readonly analisis: Analisis;
  readonly tipo: TipoHallazgo;
  readonly sujeto: SujetoDelHallazgo;
  readonly certeza: NivelCerteza;
  readonly impacto: ImpactoEconomico | null;
  readonly fundamento: Fundamento;
  readonly supuestos: readonly Supuesto[];
  readonly requiereConfirmacionProfesional: true;
  /** CA-28: algún parámetro usado está sin ratificar (sólo fuera de producción). */
  readonly usaParametrosSinRatificar: boolean;
  readonly valoresReferenciaUsados: readonly UsoValorReferencia[];
  /** CA-49: plantilla identificada y versionada. */
  readonly plantilla: ReferenciaPlantilla;
  /** CA-50: advertencias obligatorias según el tipo de hallazgo. */
  readonly advertenciasObligatorias: readonly ReferenciaPlantilla[];
  readonly accionesSugeridas: readonly AccionSugerida[];
  readonly visibilidad: PoliticaVisibilidad;
  readonly trazabilidad: Trazabilidad;
}

/* ───────────────────────────────────────────────────────────────────────────
 * 11. Resultados por análisis
 * ────────────────────────────────────────────────────────────────────────── */

export interface HechoDescartado {
  readonly hecho: HechoRelevante;
  readonly motivo:
    | 'ANTERIOR_A_LA_EXIGIBILIDAD'
    | 'INTERPELACION_YA_COMPUTADA'
    | 'NO_ACREDITADO'
    | 'POSTERIOR_A_LA_FECHA_DE_EVALUACION';
  readonly plantilla: ReferenciaPlantilla;
}

export interface RegimenConsiderado {
  readonly regimen: RegimenAplicable;
  readonly plazo: UsoParametro;
  readonly fechaEstimadaDePrescripcion: FechaCivil;
}

export interface DetalleComputoPrescripcion {
  readonly regimenAplicado: RegimenConsiderado;
  readonly regimenesConsiderados: readonly RegimenConsiderado[];
  /** CA-33: si hay más de un régimen, se declara la regla usada. */
  readonly reglaDeDesempate: UsoParametro | null;
  readonly diesAQuo: FechaDelHecho;
  readonly hechoInterruptivoComputado: HechoRelevante | null;
  readonly diasDeSuspensionComputados: number;
  readonly hechosDescartados: readonly HechoDescartado[];
  readonly fechaEstimadaDePrescripcion: FechaCivil;
}

export type ResultadoAnalisisA =
  | {
      readonly estado: 'PRESUNTAMENTE_PRESCRIPTA';
      readonly detalle: DetalleComputoPrescripcion;
      readonly hallazgos: readonly Hallazgo[];
      readonly supuestos: readonly Supuesto[];
      readonly trazabilidad: Trazabilidad;
    }
  | {
      readonly estado: 'PROXIMA_A_PRESCRIBIR';
      readonly diasRestantes: number;
      readonly detalle: DetalleComputoPrescripcion;
      readonly hallazgos: readonly Hallazgo[];
      readonly supuestos: readonly Supuesto[];
      readonly trazabilidad: Trazabilidad;
    }
  | {
      readonly estado: 'VIGENTE';
      readonly diasRestantes: number;
      readonly detalle: DetalleComputoPrescripcion;
      readonly supuestos: readonly Supuesto[];
      readonly trazabilidad: Trazabilidad;
    }
  | {
      readonly estado: 'NO_APLICA';
      readonly motivo: 'OBLIGACION_EXTINGUIDA';
      readonly trazabilidad: Trazabilidad;
    }
  | Indeterminable;

export interface AjusteDeRecomposicion {
  readonly concepto: TipoHallazgo;
  readonly montoAjustado: Monto;
  readonly fundamento: Fundamento;
}

export interface RecomposicionDeSaldo {
  readonly saldoReclamado: Monto;
  readonly saldoRecalculado: Monto;
  readonly diferencia: ImpactoEconomico;
  readonly ajustes: readonly AjusteDeRecomposicion[];
}

export type ResultadoAnalisisB =
  | {
      readonly estado: 'EVALUADO';
      readonly hallazgos: readonly Hallazgo[];
      readonly recomposicion: RecomposicionDeSaldo | null;
      readonly supuestos: readonly Supuesto[];
      readonly trazabilidad: Trazabilidad;
    }
  | {
      readonly estado: 'NO_APLICA';
      readonly motivo: 'OBLIGACION_EXTINGUIDA' | 'SIN_INTERESES_RECLAMADOS';
      readonly trazabilidad: Trazabilidad;
    }
  | Indeterminable;

/**
 * Resultado por registro. CA-38: la Central de Deudores del BCRA y los bureaus
 * privados se evalúan con parámetros y fundamentos distintos y el resultado
 * dice de qué registro habla.
 */
export type ResultadoRegistroCrediticio =
  | {
      readonly estado: 'CADUCADO';
      readonly idRegistro: IdRegistroCrediticio;
      readonly tipoRegistro: TipoRegistroCrediticio;
      readonly fechaDeCaducidad: FechaCivil;
      /** CA-39: sólo se puede construir con el `diesAQuo` ratificado. */
      readonly diesAQuo: TramoRatificado;
      readonly hallazgos: readonly Hallazgo[];
      readonly supuestos: readonly Supuesto[];
      readonly trazabilidad: Trazabilidad;
    }
  | {
      readonly estado: 'PROXIMO_A_CADUCAR';
      readonly idRegistro: IdRegistroCrediticio;
      readonly tipoRegistro: TipoRegistroCrediticio;
      readonly fechaDeCaducidad: FechaCivil;
      readonly diasRestantes: number;
      readonly diesAQuo: TramoRatificado;
      readonly hallazgos: readonly Hallazgo[];
      readonly supuestos: readonly Supuesto[];
      readonly trazabilidad: Trazabilidad;
    }
  | {
      readonly estado: 'VIGENTE';
      readonly idRegistro: IdRegistroCrediticio;
      readonly tipoRegistro: TipoRegistroCrediticio;
      readonly fechaDeCaducidad: FechaCivil;
      readonly diesAQuo: TramoRatificado;
      readonly supuestos: readonly Supuesto[];
      readonly trazabilidad: Trazabilidad;
    }
  | (Indeterminable & {
      readonly idRegistro: IdRegistroCrediticio;
      readonly tipoRegistro: TipoRegistroCrediticio;
    });

export type ResultadoAnalisisC =
  | {
      readonly estado: 'EVALUADO';
      readonly porRegistro: readonly ResultadoRegistroCrediticio[];
      readonly trazabilidad: Trazabilidad;
    }
  | Indeterminable;

export interface DetalleTramoEmbargo {
  readonly tramo: TramoEmbargabilidad;
  readonly baseDelTramo: Monto;
  readonly excedenteComputado: Monto;
  readonly montoEmbargableDelTramo: Monto;
}

export interface CalculoEmbargabilidad {
  readonly ingresoConsiderado: Monto;
  readonly valorReferenciaUsado: UsoValorReferencia;
  readonly porcionInembargable: Monto;
  readonly montoEmbargableMaximo: Monto;
  readonly tramos: readonly DetalleTramoEmbargo[];
  readonly redondeo: RedondeoAplicado;
}

export type ResultadoAnalisisD =
  | {
      readonly estado: 'EVALUADO';
      readonly calculo: CalculoEmbargabilidad;
      readonly hallazgos: readonly Hallazgo[];
      readonly supuestos: readonly Supuesto[];
      readonly trazabilidad: Trazabilidad;
    }
  | {
      readonly estado: 'NO_APLICA';
      readonly motivo: 'SIN_AFECTACIONES_INFORMADAS';
      readonly trazabilidad: Trazabilidad;
    }
  | Indeterminable;

export interface LimiteHonorario {
  readonly destinatarioDelCobro: 'ABOGADO' | 'PLATAFORMA';
  readonly porcentajeMaximoAdmisible: Racional;
  readonly montoMaximoAdmisible: Monto | null;
  readonly baseDeCalculo: UsoParametro;
  readonly fundamento: Fundamento;
}

/** CA-44: alerta de compromiso interno. No es un límite legal (R-11). */
export interface AlertaCompromisoInterno {
  readonly sumaPropuesta: Racional;
  readonly topeInternoConfigurado: Racional;
  readonly requiereAutorizacionExpresa: true;
  readonly plantilla: ReferenciaPlantilla;
}

export type ResultadoAnalisisE =
  | {
      readonly estado: 'EVALUADO';
      /** CA-23: siempre ambos, siempre diferenciados, nunca sumados como tope. */
      readonly limiteHonorarioAbogado: LimiteHonorario;
      readonly limiteComisionPlataforma: LimiteHonorario;
      readonly alertaCompromisoInterno: AlertaCompromisoInterno | null;
      readonly hallazgos: readonly Hallazgo[];
      readonly supuestos: readonly Supuesto[];
      readonly trazabilidad: Trazabilidad;
    }
  | Indeterminable;

/* ───────────────────────────────────────────────────────────────────────────
 * 12. Salida del motor
 * ────────────────────────────────────────────────────────────────────────── */

/** CA-62: regla de no-confusión entre institutos que coexisten. */
export type ClaseAdvertenciaDeConjunto =
  | 'NO_CONFUSION_PRESCRIPCION_Y_ARCHIVO'
  | 'IMPACTOS_NO_ACUMULABLES'
  | 'PARAMETROS_SIN_RATIFICAR_EN_LA_EVALUACION';

export interface AdvertenciaDeConjunto {
  readonly clase: ClaseAdvertenciaDeConjunto;
  readonly hallazgosInvolucrados: readonly string[];
  readonly plantilla: ReferenciaPlantilla;
  readonly destinatarios: readonly Destinatario[];
}

/**
 * Agrupación de impactos por clave de superposición. Se expone el máximo no
 * acumulable del grupo, **nunca un total general**: agregar todos los impactos
 * en un número único está prohibido (dictamen RL-07).
 */
export interface GrupoDeImpacto {
  readonly claveSuperposicion: ClaveSuperposicion;
  readonly moneda: Moneda;
  readonly montoMaximoNoAcumulable: Monto;
  readonly hallazgosInvolucrados: readonly string[];
}

export interface SalidaEvaluacion {
  readonly version: VersionContrato;
  readonly idDeuda: IdDeuda;
  readonly idPersona: IdPersona;
  /** CA-50: encabezado obligatorio de toda salida que llega al cliente. */
  readonly encabezadoObligatorio: ReferenciaPlantilla;
  readonly resultados: {
    readonly a: ResultadoAnalisisA | null;
    readonly b: ResultadoAnalisisB | null;
    readonly c: ResultadoAnalisisC | null;
    readonly d: ResultadoAnalisisD | null;
    readonly e: ResultadoAnalisisE | null;
  };
  readonly hallazgos: readonly Hallazgo[];
  readonly advertenciasDeConjunto: readonly AdvertenciaDeConjunto[];
  readonly gruposDeImpacto: readonly GrupoDeImpacto[];
  readonly parametrosUsados: readonly UsoParametro[];
  readonly valoresReferenciaUsados: readonly UsoValorReferencia[];
  readonly inconsistenciasDetectadas: readonly HechoDescartado[];
  readonly trazabilidad: Trazabilidad;
  /** Serialización canónica de la entrada, para que la infraestructura la hashee. */
  readonly huellaEntradaCanonica: string;
}

/* ───────────────────────────────────────────────────────────────────────────
 * 13. Punto de entrada
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Evalúa una deuda contra los análisis solicitados.
 *
 * - Función pura y total: no lee el reloj, el entorno, la red ni el disco, y no
 *   lanza excepciones como flujo de control (CA-31).
 * - `entrada: E & Minimizada<E>` es la barrera de CA-60: si `E` contiene un
 *   dato identificatorio del deudor en cualquier nivel, `Minimizada<E>` es
 *   `never` y el programa no compila.
 * - Devuelve `ErrorMotor` sólo ante defecto o bloqueo (CA-58). La falta de
 *   datos es INDETERMINABLE dentro de la salida, no un error.
 */
export declare function evaluar<E extends EntradaEvaluacion>(
  entrada: E & Minimizada<E>,
  contexto: ContextoEvaluacion,
): Resultado<SalidaEvaluacion, ErrorMotor>;

/** Serialización canónica y estable de la entrada (claves ordenadas). */
export declare function serializarEntradaCanonica(entrada: EntradaEvaluacion): string;

/* ───────────────────────────────────────────────────────────────────────────
 * 14. Frontera con la persistencia y con la revisión profesional
 *
 * Estos tipos los **consume** el motor pero no los produce: los implementa la
 * feature 007 sobre el modelo que diseña `database-engineer`. Se declaran acá
 * para que la frontera esté escrita y versionada.
 * ────────────────────────────────────────────────────────────────────────── */

export type DecisionProfesional = 'CONFIRMADO' | 'RECHAZADO' | 'CORREGIDO';

/**
 * CA-47: sin matrícula registrada, la confirmación se rechaza. El tipo lo hace
 * imposible de representar.
 */
export interface ConfirmacionProfesional {
  readonly idProfesional: IdProfesional;
  readonly matricula: string;
  readonly jurisdiccionMatricula: Jurisdiccion;
  readonly fecha: FechaCivil;
  readonly decision: DecisionProfesional;
  readonly correccion: CorreccionDeHallazgo | null;
}

export interface CorreccionDeHallazgo {
  readonly impactoCorregido: Monto | null;
  readonly certezaCorregida: NivelCerteza | null;
  readonly motivo: ClaveMotivoCorreccion;
}

export type ClaveMotivoCorreccion =
  | 'DATO_DE_ENTRADA_ERRONEO' | 'PARAMETRO_MAL_APLICADO'
  | 'REGIMEN_INCORRECTO' | 'HECHO_NO_ACREDITADO' | 'CRITERIO_PROFESIONAL_DISTINTO';

/**
 * CA-51: la decisión del profesional prevalece. Un hallazgo rechazado nunca se
 * presenta como vigente al cliente. Lo hace cumplir la feature 007; el motor
 * sólo declara la forma.
 */
export interface HallazgoRevisado {
  readonly hallazgo: Hallazgo;
  readonly confirmacion: ConfirmacionProfesional;
  readonly visibleParaCliente: boolean;
}

/**
 * Puerto de reproducción. Lo implementa la infraestructura: dada una versión de
 * catálogo, devuelve el snapshot exacto que se usó. Sin esto, CA-27 y CA-31 no
 * son verificables sobre resultados pasados.
 */
export interface PuertoReproduccion {
  obtenerCatalogo(version: VersionCatalogo): Promise<CatalogoNormativo | null>;
  obtenerTablaValoresReferencia(version: string): Promise<TablaValoresReferencia | null>;
  obtenerCatalogoPlantillas(version: string): Promise<CatalogoPlantillas | null>;
}
