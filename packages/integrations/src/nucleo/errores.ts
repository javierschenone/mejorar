/**
 * Error normalizado de la frontera con terceros.
 *
 * Regla 6 del mandato de `dev-integraciones`: **todo** falla como
 * `ErrorIntegracion`, con proveedor, código, si conviene reintentar y un
 * mensaje en español para la persona. Ningún error crudo de un proveedor
 * —un `TypeError` de `fetch`, un HTML de 502 de un balanceador— cruza hacia
 * adentro del sistema.
 */

/** Proveedores que esta frontera conoce hoy. Se amplía por feature. */
export type ProveedorDeIntegracion =
  | 'SENDGRID'
  | 'BASE_LOCAL_DE_UBICACION'
  | 'ANALIZADOR_LOCAL_DE_DISPOSITIVO'
  | 'LISTA_LOCAL_DE_CONTRASENAS'
  | 'RELOJ_DEL_SISTEMA';

/**
 * Familias de fallo. Son pocas a propósito: lo que el sistema hace con un
 * fallo depende de la familia, no del código puntual del proveedor.
 */
export type ClaseErrorIntegracion =
  /** La petición que armamos está mal. No se reintenta: se corrige el código. */
  | 'PETICION_INVALIDA'
  /** El proveedor nos rechazó por credenciales. No se reintenta. */
  | 'CREDENCIAL_RECHAZADA'
  /** Nos frenó por volumen. Se reintenta con espera. */
  | 'LIMITE_DE_USO'
  /** El proveedor falló de su lado. Se reintenta. */
  | 'FALLO_DEL_PROVEEDOR'
  /** No contestó a tiempo. Se reintenta. */
  | 'TIEMPO_AGOTADO'
  /** No se pudo abrir la conexión. Se reintenta. */
  | 'SIN_CONEXION'
  /** El cortacircuitos está abierto: ni se intentó. Se reintenta más tarde. */
  | 'CIRCUITO_ABIERTO'
  /** Falta configuración obligatoria para operar en este modo. No se reintenta. */
  | 'CONFIGURACION_AUSENTE'
  /** El dato que nos devolvió no encaja con lo que dijo que devolvía. */
  | 'RESPUESTA_INESPERADA';

export interface ErrorIntegracion {
  readonly proveedor: ProveedorDeIntegracion;
  readonly clase: ClaseErrorIntegracion;
  /** Código estable nuestro, no el del proveedor. `<PROVEEDOR>_<CLASE>[_<detalle>]`. */
  readonly codigo: string;
  readonly reintentable: boolean;
  /** Español rioplatense, sin jerga técnica y sin culpar a la persona. */
  readonly mensajeUsuario: string;
  /**
   * Código crudo del proveedor, sólo para el registro técnico. Nunca sube a la
   * interfaz y nunca lleva datos de la persona.
   */
  readonly codigoDelProveedor: string | null;
  /** Correlación con el registro de la llamada. */
  readonly referencia: string | null;
}

const REINTENTABLES: ReadonlySet<ClaseErrorIntegracion> = new Set([
  'LIMITE_DE_USO',
  'FALLO_DEL_PROVEEDOR',
  'TIEMPO_AGOTADO',
  'SIN_CONEXION',
  'CIRCUITO_ABIERTO',
]);

export function esClaseReintentable(clase: ClaseErrorIntegracion): boolean {
  return REINTENTABLES.has(clase);
}

/**
 * Mensajes por clase. Deliberadamente genéricos: la persona no tiene por qué
 * enterarse de qué proveedor usamos ni de qué se rompió (y decírselo sería
 * información que no le sirve para nada).
 */
const MENSAJE_POR_CLASE: Readonly<Record<ClaseErrorIntegracion, string>> = {
  PETICION_INVALIDA: 'No pudimos completar la operación. Probá de nuevo; si sigue, escribinos.',
  CREDENCIAL_RECHAZADA: 'No pudimos completar la operación en este momento. Ya estamos avisados.',
  LIMITE_DE_USO: 'Hay mucho movimiento en este momento. Probá de nuevo en unos minutos.',
  FALLO_DEL_PROVEEDOR: 'El servicio no está disponible en este momento. Lo reintentamos solos.',
  TIEMPO_AGOTADO: 'El servicio tardó más de lo esperado. Lo reintentamos solos.',
  SIN_CONEXION: 'No pudimos conectarnos al servicio. Lo reintentamos solos.',
  CIRCUITO_ABIERTO: 'El servicio viene fallando y lo pausamos un rato. Lo reintentamos solos.',
  CONFIGURACION_AUSENTE: 'No pudimos completar la operación en este momento. Ya estamos avisados.',
  RESPUESTA_INESPERADA: 'No pudimos completar la operación. Probá de nuevo; si sigue, escribinos.',
};

export function crearErrorIntegracion(entrada: {
  readonly proveedor: ProveedorDeIntegracion;
  readonly clase: ClaseErrorIntegracion;
  readonly detalle?: string;
  readonly codigoDelProveedor?: string | null;
  readonly referencia?: string | null;
  readonly mensajeUsuario?: string;
}): ErrorIntegracion {
  const sufijo = entrada.detalle ? `_${entrada.detalle}` : '';
  return {
    proveedor: entrada.proveedor,
    clase: entrada.clase,
    codigo: `${entrada.proveedor}_${entrada.clase}${sufijo}`,
    reintentable: esClaseReintentable(entrada.clase),
    mensajeUsuario: entrada.mensajeUsuario ?? MENSAJE_POR_CLASE[entrada.clase],
    codigoDelProveedor: entrada.codigoDelProveedor ?? null,
    referencia: entrada.referencia ?? null,
  };
}

/**
 * Falla de arranque por configuración faltante. Es la única excepción que este
 * paquete lanza en vez de devolver: ocurre al construir la fábrica, no al
 * atender una petición, y el criterio del mandato es **fallar temprano**.
 */
export class ErrorDeConfiguracion extends Error {
  public readonly detalles: ErrorIntegracion;

  constructor(detalles: ErrorIntegracion) {
    super(`[${detalles.codigo}] ${detalles.mensajeUsuario}`);
    this.name = 'ErrorDeConfiguracion';
    this.detalles = detalles;
  }
}

export function faltaConfiguracion(
  proveedor: ProveedorDeIntegracion,
  queFalta: string,
): ErrorDeConfiguracion {
  return new ErrorDeConfiguracion(
    crearErrorIntegracion({
      proveedor,
      clase: 'CONFIGURACION_AUSENTE',
      detalle: queFalta,
    }),
  );
}
