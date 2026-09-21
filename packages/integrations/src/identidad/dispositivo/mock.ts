/**
 * Mock de descripción de dispositivo.
 *
 * Acá el mock es casi el mismo código que el adaptador real, y eso está bien:
 * no hay tercero, no hay red y no hay credencial que evitar (ADR-029 punto 2).
 * Lo que agrega es lo único que un mock tiene que agregar en este caso:
 *
 * - una **batería de fijaciones** de agentes de usuario reales, para que las
 *   demostraciones y las siembras muestren siempre el mismo parque de
 *   dispositivos;
 * - un contador de invocaciones, para que un test pueda afirmar que el
 *   analizador se llamó una sola vez por sesión.
 *
 * Lo que no hace, deliberadamente: devolver algo distinto del adaptador real.
 * Si el mock y el real difirieran, el mock dejaría de servir para probar.
 */

import type { DeclaracionDeCobertura } from '../../nucleo';
import { AnalizadorLocalDeAgenteDeUsuario, COBERTURA_DISPOSITIVO_LOCAL } from './local';
import type { DescripcionDeDispositivo, PuertoDescripcionDeDispositivo } from './puerto';

/**
 * Parque de dispositivos de demostración. Son cadenas reales, recortadas, de
 * los navegadores más usados en Argentina. Se usan para sembrar sesiones de
 * ejemplo con datos verosímiles.
 */
export const AGENTES_DE_EJEMPLO = {
  ANDROID_CHROME:
    'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  IPHONE_SAFARI:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  WINDOWS_CHROME:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  WINDOWS_EDGE:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  MAC_SAFARI:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  LINUX_FIREFOX: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  IPAD_SAFARI:
    'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ANDROID_TABLETA:
    'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  ANDROID_SAMSUNG:
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  APLICACION_PROPIA_IOS: 'MejorarApp/1.0.0 (iPhone; iOS 17.5; es-AR) CFNetwork/1496 Darwin/23.5.0',
  APLICACION_PROPIA_ANDROID: 'MejorarApp/1.0.0 (Android 14; es-AR) okhttp/4.12.0',
} as const;

export const COBERTURA_DISPOSITIVO_MOCK: DeclaracionDeCobertura = {
  ...COBERTURA_DISPOSITIVO_LOCAL,
  adaptador: 'AnalizadorDeDispositivoMock',
  cubre: [
    ...COBERTURA_DISPOSITIVO_LOCAL.cubre,
    'Batería de agentes de usuario de ejemplo para siembras y demostraciones.',
  ],
};

export class AnalizadorDeDispositivoMock implements PuertoDescripcionDeDispositivo {
  readonly cobertura = COBERTURA_DISPOSITIVO_MOCK;

  private readonly real = new AnalizadorLocalDeAgenteDeUsuario();
  private invocaciones = 0;

  describir(agenteDeUsuario: string): DescripcionDeDispositivo {
    this.invocaciones += 1;
    return this.real.describir(agenteDeUsuario);
  }

  get cantidadDeInvocaciones(): number {
    return this.invocaciones;
  }

  reiniciar(): void {
    this.invocaciones = 0;
  }
}

export function crearAnalizadorDeDispositivoMock(): AnalizadorDeDispositivoMock {
  return new AnalizadorDeDispositivoMock();
}
