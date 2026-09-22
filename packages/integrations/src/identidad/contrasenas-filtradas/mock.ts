/**
 * Mock de la lista de contraseñas filtradas: conjunto en memoria, determinista.
 *
 * Es el que corre en desarrollo, en demos y en tests. No lee disco, no sale a
 * la red y responde siempre lo mismo. Alcanza para que el alta rechace de
 * verdad `boca1905` sin que haya que tener el archivo de un millón de
 * entradas montado.
 *
 * Guarda las contraseñas como hash, no en claro, por una razón práctica: así
 * un volcado de memoria del proceso de desarrollo no imprime una lista de
 * contraseñas, y así el mock y el adaptador real comparten exactamente el
 * mismo camino de comparación.
 */

import type { DeclaracionDeCobertura } from '../../nucleo';
import { CONTRASENAS_FILTRADAS_BASE } from './lista-base';
import { huellaSha1, type PuertoListaDeContrasenasFiltradas } from './puerto';

export const COBERTURA_LISTA_MOCK: DeclaracionDeCobertura = {
  puerto: 'PuertoListaDeContrasenasFiltradas',
  adaptador: 'ListaDeContrasenasFiltradasMock',
  proveedor: 'LISTA_LOCAL_DE_CONTRASENAS',
  usaRed: false,
  esEncargadoDeTratamiento: false,
  cubre: [
    'Lista base embebida: las contraseñas notorias universales más el repertorio rioplatense.',
    'Contraseñas adicionales cargadas por quien construye el mock, para casos de prueba.',
  ],
  noCubre: [
    'El orden del millón más usado: eso es el adaptador de archivo (ADR-024), que mantiene cicd.',
    'Variantes con sustituciones (a→4, e→3) que no estén escritas en la lista.',
  ],
  version: `lista-base/${CONTRASENAS_FILTRADAS_BASE.length}`,
};

export class ListaDeContrasenasFiltradasMock implements PuertoListaDeContrasenasFiltradas {
  readonly cobertura = COBERTURA_LISTA_MOCK;

  private readonly huellas: Set<string>;
  private consultas = 0;

  /**
   * @param adicionales contraseñas extra para un caso de prueba puntual. No
   * se guardan en claro: entran por el mismo hash que el resto.
   */
  constructor(adicionales: readonly string[] = []) {
    this.huellas = new Set(
      [...CONTRASENAS_FILTRADAS_BASE, ...adicionales].map((contrasena) => huellaSha1(contrasena)),
    );
  }

  async contiene(contrasenaNormalizada: string): Promise<boolean> {
    this.consultas += 1;
    return this.huellas.has(huellaSha1(contrasenaNormalizada));
  }

  get cantidadDeEntradas(): number {
    return this.huellas.size;
  }

  get cantidadDeConsultas(): number {
    return this.consultas;
  }

  reiniciar(): void {
    this.consultas = 0;
  }
}

export function crearListaDeContrasenasFiltradasMock(
  adicionales: readonly string[] = [],
): ListaDeContrasenasFiltradasMock {
  return new ListaDeContrasenasFiltradasMock(adicionales);
}
