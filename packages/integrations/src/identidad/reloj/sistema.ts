/**
 * Reloj del sistema. El único lugar de todo el producto donde se llama a
 * `Date.now()` para obtener "ahora".
 */

import type { DeclaracionDeCobertura } from '../../nucleo';
import { comoInstante, type Instante, type PuertoReloj } from './puerto';

export const COBERTURA_RELOJ_DEL_SISTEMA: DeclaracionDeCobertura = {
  puerto: 'PuertoReloj',
  adaptador: 'RelojDelSistema',
  proveedor: 'RELOJ_DEL_SISTEMA',
  usaRed: false,
  esEncargadoDeTratamiento: false,
  cubre: ['Instante actual en UTC con milisegundos, tomado del reloj del proceso.'],
  noCubre: [
    'Sincronización horaria: la garantiza el sistema operativo (NTP), no este adaptador.',
    'Husos horarios. Todo instante es UTC; la conversión a hora argentina es de la interfaz.',
  ],
  version: null,
};

export class RelojDelSistema implements PuertoReloj {
  readonly cobertura = COBERTURA_RELOJ_DEL_SISTEMA;

  ahora(): Instante {
    return comoInstante(new Date());
  }
}

export function crearRelojDelSistema(): RelojDelSistema {
  return new RelojDelSistema();
}
