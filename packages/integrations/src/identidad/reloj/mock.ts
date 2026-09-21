/**
 * Reloj de mentira: determinista y controlable.
 *
 * Es el que corre en tests, en demos y con `INTEGRACIONES_MODO=mock`. Dos
 * corridas de la misma secuencia de llamadas dan exactamente los mismos
 * instantes; no hay forma de que un test dé distinto un martes.
 */

import type { DeclaracionDeCobertura } from '../../nucleo';
import { comoInstante, type Instante, type PuertoReloj } from './puerto';

/**
 * Instante de arranque por defecto. Es el que el propio contrato usa de
 * ejemplo al definir `Instante`, así que los datos de demostración coinciden
 * con la documentación.
 */
export const INSTANTE_INICIAL_DE_MOCK = '2026-09-21T14:03:11.412Z' as Instante;

export const COBERTURA_RELOJ_MOCK: DeclaracionDeCobertura = {
  puerto: 'PuertoReloj',
  adaptador: 'RelojDetenido',
  proveedor: 'RELOJ_DEL_SISTEMA',
  usaRed: false,
  esEncargadoDeTratamiento: false,
  cubre: [
    'Instante fijo, avanzable a voluntad. Determinista entre corridas.',
    'Avance automático opcional por llamada, para simular el paso del tiempo.',
  ],
  noCubre: ['La hora real. A propósito: si un test la necesita, el test está mal planteado.'],
  version: null,
};

export interface OpcionesDelRelojDetenido {
  /** Instante inicial. Por defecto `INSTANTE_INICIAL_DE_MOCK`. */
  readonly inicio?: Instante;
  /**
   * Milisegundos que avanza el reloj **después** de cada consulta. Por defecto
   * 0: el reloj no se mueve solo. Poner 1 alcanza para que dos eventos
   * consecutivos tengan instantes distintos y ordenables.
   */
  readonly avancePorConsultaEnMs?: number;
}

export class RelojDetenido implements PuertoReloj {
  readonly cobertura = COBERTURA_RELOJ_MOCK;

  private actualEnMs: number;
  private readonly avancePorConsultaEnMs: number;

  constructor(opciones: OpcionesDelRelojDetenido = {}) {
    this.actualEnMs = Date.parse(opciones.inicio ?? INSTANTE_INICIAL_DE_MOCK);
    this.avancePorConsultaEnMs = opciones.avancePorConsultaEnMs ?? 0;
  }

  ahora(): Instante {
    const instante = comoInstante(new Date(this.actualEnMs));
    this.actualEnMs += this.avancePorConsultaEnMs;
    return instante;
  }

  /** Mueve el reloj hacia adelante. Acepta negativos: a veces hace falta. */
  avanzar(milisegundos: number): void {
    this.actualEnMs += milisegundos;
  }

  avanzarDias(dias: number): void {
    this.avanzar(dias * 24 * 60 * 60 * 1000);
  }

  fijar(instante: Instante): void {
    const ms = Date.parse(instante);
    if (Number.isNaN(ms)) throw new RangeError(`Instante inválido: ${instante}`);
    this.actualEnMs = ms;
  }

  /** Milisegundos desde época, para enchufar en `ejecutarConResiliencia`. */
  ahoraEnMs(): number {
    return this.actualEnMs;
  }
}

export function crearRelojMock(opciones: OpcionesDelRelojDetenido = {}): RelojDetenido {
  return new RelojDetenido(opciones);
}
