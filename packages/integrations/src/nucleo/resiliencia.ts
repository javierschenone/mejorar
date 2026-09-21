/**
 * Resiliencia por defecto — regla 5 del mandato.
 *
 * Tiempo límite, reintentos con espera exponencial y sacudida (*jitter*), y
 * cortacircuitos. Un proveedor caído degrada una función; no tira el sistema.
 *
 * Todo lo que en producción es no determinista —el reloj, el azar, la espera—
 * entra **por parámetro**. Los tests corren sin esperar de verdad y con una
 * secuencia de azar fija: es el mismo criterio de determinismo de la 004.
 */

import {
  crearErrorIntegracion,
  esClaseReintentable,
  type ClaseErrorIntegracion,
  type ErrorIntegracion,
  type ProveedorDeIntegracion,
} from './errores';

export interface PoliticaDeReintentos {
  /** Intentos totales, incluido el primero. */
  readonly intentos: number;
  readonly esperaBaseEnMs: number;
  readonly esperaMaximaEnMs: number;
  /** Tiempo límite de **cada** intento. */
  readonly tiempoLimiteEnMs: number;
}

export const POLITICA_POR_DEFECTO: PoliticaDeReintentos = {
  intentos: 3,
  esperaBaseEnMs: 250,
  esperaMaximaEnMs: 4_000,
  tiempoLimiteEnMs: 8_000,
};

export interface DependenciasDeResiliencia {
  /** Milisegundos desde época. Por defecto `Date.now`. */
  readonly ahoraEnMs: () => number;
  /** Espera. Por defecto `setTimeout`. En tests, una que no espera. */
  readonly dormir: (ms: number) => Promise<void>;
  /** Número en [0,1). Por defecto `Math.random`. En tests, una secuencia fija. */
  readonly azar: () => number;
}

export const DEPENDENCIAS_REALES: DependenciasDeResiliencia = {
  ahoraEnMs: () => Date.now(),
  dormir: (ms) =>
    new Promise((resolver) => {
      setTimeout(resolver, ms);
    }),
  azar: () => Math.random(),
};

/**
 * Espera del intento `n` (base 1): exponencial acotada, con sacudida completa.
 * La sacudida completa —un valor uniforme entre 0 y el tope— es la que mejor
 * dispersa una estampida de clientes que reintentan todos a la vez.
 */
export function esperaDelIntento(
  intento: number,
  politica: PoliticaDeReintentos,
  azar: number,
): number {
  const tope = Math.min(
    politica.esperaMaximaEnMs,
    politica.esperaBaseEnMs * 2 ** Math.max(0, intento - 1),
  );
  return Math.floor(tope * azar);
}

/** Estado observable del cortacircuitos. */
export type EstadoDelCortacircuitos = 'CERRADO' | 'ABIERTO' | 'MEDIO_ABIERTO';

export interface ConfiguracionDelCortacircuitos {
  /** Fallos consecutivos que lo abren. */
  readonly fallosParaAbrir: number;
  /** Cuánto queda abierto antes de dejar pasar una prueba. */
  readonly reposoEnMs: number;
}

export const CORTACIRCUITOS_POR_DEFECTO: ConfiguracionDelCortacircuitos = {
  fallosParaAbrir: 5,
  reposoEnMs: 30_000,
};

export class Cortacircuitos {
  private fallosConsecutivos = 0;
  private abiertoHastaEnMs: number | null = null;

  constructor(
    private readonly configuracion: ConfiguracionDelCortacircuitos = CORTACIRCUITOS_POR_DEFECTO,
    private readonly ahoraEnMs: () => number = DEPENDENCIAS_REALES.ahoraEnMs,
  ) {}

  estado(): EstadoDelCortacircuitos {
    if (this.abiertoHastaEnMs === null) return 'CERRADO';
    return this.ahoraEnMs() >= this.abiertoHastaEnMs ? 'MEDIO_ABIERTO' : 'ABIERTO';
  }

  permitePasar(): boolean {
    return this.estado() !== 'ABIERTO';
  }

  registrarExito(): void {
    this.fallosConsecutivos = 0;
    this.abiertoHastaEnMs = null;
  }

  registrarFallo(): void {
    this.fallosConsecutivos += 1;
    if (this.fallosConsecutivos >= this.configuracion.fallosParaAbrir) {
      this.abiertoHastaEnMs = this.ahoraEnMs() + this.configuracion.reposoEnMs;
    }
  }
}

export type ResultadoDeIntento<T> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly error: ErrorIntegracion };

export interface OpcionesDeEjecucion<T> {
  readonly proveedor: ProveedorDeIntegracion;
  readonly operacion: string;
  readonly politica?: PoliticaDeReintentos;
  readonly cortacircuitos?: Cortacircuitos;
  readonly dependencias?: Partial<DependenciasDeResiliencia>;
  /** Se invoca una vez por intento, con el número de intento (base 1). */
  readonly intentar: (intento: number) => Promise<ResultadoDeIntento<T>>;
}

/**
 * Corre `intentar` con reintentos, espera exponencial con sacudida y
 * cortacircuitos. Reintenta **sólo** los errores marcados como reintentables:
 * repetir una petición mal formada no la arregla, y repetir un envío de correo
 * que el proveedor rechazó por contenido sólo gasta cuota.
 */
export async function ejecutarConResiliencia<T>(
  opciones: OpcionesDeEjecucion<T>,
): Promise<ResultadoDeIntento<T>> {
  const politica = opciones.politica ?? POLITICA_POR_DEFECTO;
  const dependencias: DependenciasDeResiliencia = {
    ...DEPENDENCIAS_REALES,
    ...opciones.dependencias,
  };
  const cortacircuitos = opciones.cortacircuitos;

  if (cortacircuitos && !cortacircuitos.permitePasar()) {
    return {
      ok: false,
      error: crearErrorIntegracion({
        proveedor: opciones.proveedor,
        clase: 'CIRCUITO_ABIERTO',
        detalle: opciones.operacion,
      }),
    };
  }

  let ultimoError: ErrorIntegracion | null = null;

  for (let intento = 1; intento <= politica.intentos; intento += 1) {
    const resultado = await opciones.intentar(intento);
    if (resultado.ok) {
      cortacircuitos?.registrarExito();
      return resultado;
    }
    ultimoError = resultado.error;
    cortacircuitos?.registrarFallo();
    if (!esClaseReintentable(resultado.error.clase)) return resultado;
    if (intento === politica.intentos) break;
    await dependencias.dormir(esperaDelIntento(intento, politica, dependencias.azar()));
  }

  return {
    ok: false,
    error:
      ultimoError ??
      crearErrorIntegracion({
        proveedor: opciones.proveedor,
        clase: 'FALLO_DEL_PROVEEDOR',
        detalle: opciones.operacion,
      }),
  };
}

/** Centinela privado: nunca puede confundirse con un valor legítimo de `T`. */
const MARCA_DE_VENCIMIENTO = Symbol('tiempo-agotado');

/**
 * Corre una promesa con tiempo límite. Devuelve el error normalizado en vez de
 * rechazar: quien llama no tiene que envolver nada en `try`.
 */
export async function conTiempoLimite<T>(
  promesa: Promise<T>,
  tiempoLimiteEnMs: number,
  proveedor: ProveedorDeIntegracion,
  operacion: string,
): Promise<ResultadoDeIntento<T>> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const vencimiento = new Promise<typeof MARCA_DE_VENCIMIENTO>((resolver) => {
    temporizador = setTimeout(() => resolver(MARCA_DE_VENCIMIENTO), tiempoLimiteEnMs);
  });
  try {
    const cual = await Promise.race([promesa, vencimiento]);
    if (cual === MARCA_DE_VENCIMIENTO) {
      return {
        ok: false,
        error: crearErrorIntegracion({
          proveedor,
          clase: 'TIEMPO_AGOTADO',
          detalle: operacion,
        }),
      };
    }
    return { ok: true, valor: cual as T };
  } finally {
    if (temporizador !== undefined) clearTimeout(temporizador);
  }
}

/** Clasifica un código HTTP en una clase de error nuestra. */
export function claseSegunCodigoHttp(codigo: number): ClaseErrorIntegracion {
  if (codigo === 401 || codigo === 403) return 'CREDENCIAL_RECHAZADA';
  if (codigo === 408 || codigo === 504) return 'TIEMPO_AGOTADO';
  if (codigo === 429) return 'LIMITE_DE_USO';
  if (codigo >= 500) return 'FALLO_DEL_PROVEEDOR';
  if (codigo >= 400) return 'PETICION_INVALIDA';
  return 'RESPUESTA_INESPERADA';
}
