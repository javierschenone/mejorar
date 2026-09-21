/**
 * Analizador local de agente de usuario.
 *
 * ADR-029 descarta `ua-parser-js` —la biblioteca obvia— porque cambió a una
 * licencia dual restrictiva para uso comercial, y porque resuelve mucho más de
 * lo que necesitamos. Esto son unas pocas decenas de líneas de coincidencia de
 * patrones para cinco categorías, siete familias de sistema y seis de
 * navegador. Va a quedar desactualizado con navegadores nuevos; el modo de
 * falla es `DESCONOCIDO`, que no rompe nada.
 *
 * Tres reglas de las que depende que esto sea correcto:
 *
 * 1. **La cadena cruda no sale de acá.** No se devuelve, no se registra, no se
 *    incluye en ningún error. Se lee y se descarta.
 * 2. **Sin versiones.** Ni del sistema ni del navegador: es entropía de huella
 *    que nadie va a usar.
 * 3. **El orden de las comparaciones importa.** Casi todos los navegadores
 *    mienten diciendo que son otros: Edge dice ser Chrome, Chrome dice ser
 *    Safari. Se prueba siempre del más específico al más genérico.
 */

import type { DeclaracionDeCobertura } from '../../nucleo';
import {
  DESCONOCIDO,
  type ClaseDeDispositivo,
  type DescripcionDeDispositivo,
  type Navegador,
  type PuertoDescripcionDeDispositivo,
  type Sistema,
} from './puerto';

/**
 * Tope de lectura. Un agente de usuario legítimo no pasa de unos 250
 * caracteres; lo que venga más largo se recorta antes de tocarlo. Evita que
 * una cadena de 10 MB haga trabajar al proceso.
 */
const LARGO_MAXIMO = 512;

/** Marca de nuestra propia aplicación móvil. La define `dev-mobile`. */
const MARCAS_DE_APLICACION_PROPIA = ['mejorarapp/', 'mejorar-movil/'];

/**
 * Clientes HTTP típicos de una aplicación nativa. Si aparecen sin motor de
 * navegador, es una app, no un navegador.
 */
const CLIENTES_NATIVOS = ['okhttp', 'cfnetwork', 'dalvik', 'darwin/', 'expo/'];

function detectarSistema(ua: string): Sistema | null {
  if (ua.includes('windows nt') || ua.includes('windows phone')) return 'Windows';
  if (ua.includes('cros')) return 'ChromeOS';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('ipad')) return 'iPadOS';
  if (ua.includes('iphone') || ua.includes('ipod') || ua.includes('ios/')) return 'iOS';
  // `macintosh` también aparece en iPadOS con "solicitar sitio de escritorio";
  // se resuelve más abajo, al clasificar, mirando si hay pantalla táctil.
  if (ua.includes('macintosh') || ua.includes('mac os x')) return 'macOS';
  if (ua.includes('linux') || ua.includes('x11') || ua.includes('ubuntu')) return 'Linux';
  return null;
}

function detectarNavegador(ua: string): Navegador | null {
  // Del más específico al más genérico: todos se disfrazan de los anteriores.
  if (ua.includes('samsungbrowser')) return 'Samsung Internet';
  if (ua.includes('edg/') || ua.includes('edga/') || ua.includes('edgios/')) return 'Edge';
  if (ua.includes('opr/') || ua.includes('opera') || ua.includes('opios/')) return 'Opera';
  if (ua.includes('firefox/') || ua.includes('fxios/')) return 'Firefox';
  if (ua.includes('chrome/') || ua.includes('crios/') || ua.includes('chromium/')) return 'Chrome';
  if (ua.includes('safari/') && ua.includes('applewebkit')) return 'Safari';
  return null;
}

function detectarClase(ua: string, sistema: Sistema | null, navegador: Navegador | null): ClaseDeDispositivo {
  const esAplicacionPropia = MARCAS_DE_APLICACION_PROPIA.some((marca) => ua.includes(marca));
  if (esAplicacionPropia) return 'APLICACION_MOVIL';
  if (navegador === null && CLIENTES_NATIVOS.some((cliente) => ua.includes(cliente))) {
    return 'APLICACION_MOVIL';
  }

  if (ua.includes('ipad')) return 'TABLETA';
  if (ua.includes('tablet') || ua.includes('kindle') || ua.includes('silk/')) return 'TABLETA';
  // Android es la regla más contraintuitiva y la más citada: un Android **con**
  // "Mobile" es un teléfono, y **sin** "Mobile" es una tableta. Al revés de lo
  // que uno esperaría.
  if (sistema === 'Android') return ua.includes('mobile') ? 'TELEFONO' : 'TABLETA';
  if (ua.includes('iphone') || ua.includes('ipod')) return 'TELEFONO';
  if (ua.includes('windows phone') || ua.includes('mobile')) return 'TELEFONO';

  if (sistema === 'Windows' || sistema === 'macOS' || sistema === 'ChromeOS' || sistema === 'Linux') {
    return 'ESCRITORIO';
  }
  return 'DESCONOCIDO';
}

export const COBERTURA_DISPOSITIVO_LOCAL: DeclaracionDeCobertura = {
  puerto: 'PuertoDescripcionDeDispositivo',
  adaptador: 'AnalizadorLocalDeAgenteDeUsuario',
  proveedor: 'ANALIZADOR_LOCAL_DE_DISPOSITIVO',
  usaRed: false,
  esEncargadoDeTratamiento: false,
  cubre: [
    'Cinco clases: escritorio, teléfono, tableta, aplicación móvil y desconocido.',
    'Siete familias de sistema: Windows, macOS, iOS, iPadOS, Android, ChromeOS y Linux.',
    'Seis familias de navegador: Chrome, Edge, Firefox, Safari, Opera y Samsung Internet.',
  ],
  noCubre: [
    'Versiones de sistema o navegador: se descartan a propósito (minimización, art. 4).',
    'Modelo del equipo, resolución de pantalla o cualquier otra señal de huella.',
    'Navegadores minoritarios y agentes automatizados: caen en DESCONOCIDO.',
    'iPadOS con "solicitar sitio de escritorio" se informa como escritorio con macOS: es indistinguible desde el agente de usuario y no vale la pena adivinar.',
  ],
  version: 'analizador-local/1',
};

export class AnalizadorLocalDeAgenteDeUsuario implements PuertoDescripcionDeDispositivo {
  readonly cobertura = COBERTURA_DISPOSITIVO_LOCAL;

  describir(agenteDeUsuario: string): DescripcionDeDispositivo {
    if (typeof agenteDeUsuario !== 'string') return DESCONOCIDO;
    const ua = agenteDeUsuario.slice(0, LARGO_MAXIMO).toLowerCase().trim();
    if (ua.length === 0) return DESCONOCIDO;

    const sistema = detectarSistema(ua);
    const navegador = detectarNavegador(ua);
    const clase = detectarClase(ua, sistema, navegador);

    if (clase === 'DESCONOCIDO' && sistema === null && navegador === null) return DESCONOCIDO;

    return {
      clase,
      sistema,
      // Una aplicación nativa no tiene navegador, aunque su cliente HTTP
      // arrastre una cadena que parezca uno.
      navegador: clase === 'APLICACION_MOVIL' ? null : navegador,
    };
  }
}

export function crearAnalizadorLocalDeDispositivo(): AnalizadorLocalDeAgenteDeUsuario {
  return new AnalizadorLocalDeAgenteDeUsuario();
}
