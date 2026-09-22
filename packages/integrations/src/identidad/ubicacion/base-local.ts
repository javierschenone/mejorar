/**
 * Adaptador real de ubicación por IP: base de datos **local**.
 *
 * Formato: CSV de DB-IP Lite (licencia Creative Commons con atribución,
 * archivo mensual, sin cuenta ni clave — ADR-029 punto 1). Se aceptan las dos
 * variantes que publica:
 *
 *   nivel país:   `ip_inicio,ip_fin,codigo_de_pais`
 *   nivel ciudad: `ip_inicio,ip_fin,continente,pais,provincia,ciudad,lat,lon`
 *
 * De la variante de ciudad se leen **país y provincia y nada más**: la ciudad,
 * la latitud y la longitud se descartan al cargar, no al responder. No entran
 * nunca a la memoria del proceso como dato de una persona.
 *
 * El archivo lo baja y lo actualiza mensualmente `cicd` (tarea T-13); este
 * código no lo descarga. Un archivo viejo degrada la precisión, no la
 * disponibilidad. Si el archivo no está, la fábrica lo dice al arrancar en vez
 * de fallar en la primera sesión.
 *
 * **Atribución obligatoria** por la licencia: "IP Geolocation by DB-IP
 * (https://db-ip.com)". Va en la página de créditos o en la política de
 * privacidad (obligación F-13). Está declarada en `ATRIBUCION_REQUERIDA`.
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';

import type { DeclaracionDeCobertura } from '../../nucleo';
import { faltaConfiguracion } from '../../nucleo';
import {
  analizarIp,
  ubicacion,
  type DireccionIp,
  type PuertoUbicacionPorIp,
  type UbicacionAproximada,
} from './puerto';

export const ATRIBUCION_REQUERIDA = 'IP Geolocation by DB-IP (https://db-ip.com)';

interface Tabla {
  /** Inicios de rango, ordenados. */
  readonly inicios: BigUint64Array;
  readonly fines: BigUint64Array;
  /** Índice dentro de `ubicaciones`. */
  readonly indices: Uint16Array;
}

interface TablaEnConstruccion {
  readonly inicios: bigint[];
  readonly fines: bigint[];
  readonly indices: number[];
}

function vacia(): TablaEnConstruccion {
  return { inicios: [], fines: [], indices: [] };
}

/**
 * Cierra la tabla. DB-IP publica el archivo ordenado por inicio de rango, y la
 * búsqueda binaria depende de eso; igual se verifica y, si viniera desordenado,
 * se ordena acá. Confiar en el orden de un archivo de terceros sin comprobarlo
 * es la clase de supuesto que después devuelve "Córdoba" por Montevideo.
 */
function congelar(entrada: TablaEnConstruccion): Tabla {
  let ordenado = true;
  for (let i = 1; i < entrada.inicios.length; i += 1) {
    if ((entrada.inicios[i] as bigint) < (entrada.inicios[i - 1] as bigint)) {
      ordenado = false;
      break;
    }
  }
  const orden = entrada.inicios.map((_, i) => i);
  if (!ordenado) {
    orden.sort((a, b) => {
      const ia = entrada.inicios[a] as bigint;
      const ib = entrada.inicios[b] as bigint;
      return ia < ib ? -1 : ia > ib ? 1 : 0;
    });
  }
  return {
    inicios: BigUint64Array.from(orden, (i) => entrada.inicios[i] as bigint),
    fines: BigUint64Array.from(orden, (i) => entrada.fines[i] as bigint),
    indices: Uint16Array.from(orden, (i) => entrada.indices[i] as number),
  };
}

/**
 * Último rango cuyo inicio es menor o igual que el valor buscado. Búsqueda
 * binaria sobre arreglos tipados: sin recorrer, sin asignar.
 */
function buscar(tabla: Tabla, valor: bigint): number | null {
  let bajo = 0;
  let alto = tabla.inicios.length - 1;
  let candidato = -1;
  while (bajo <= alto) {
    const medio = (bajo + alto) >>> 1;
    if ((tabla.inicios[medio] as bigint) <= valor) {
      candidato = medio;
      bajo = medio + 1;
    } else {
      alto = medio - 1;
    }
  }
  if (candidato < 0) return null;
  return (tabla.fines[candidato] as bigint) >= valor ? candidato : null;
}

/** Divide una línea CSV simple. DB-IP entrecomilla todos los campos. */
function campos(linea: string): string[] {
  const salida: string[] = [];
  let actual = '';
  let entreComillas = false;
  for (const caracter of linea) {
    if (caracter === '"') {
      entreComillas = !entreComillas;
    } else if (caracter === ',' && !entreComillas) {
      salida.push(actual);
      actual = '';
    } else {
      actual += caracter;
    }
  }
  salida.push(actual);
  return salida;
}

export interface OpcionesDeLaBaseLocal {
  /** Ruta al CSV, con o sin `.gz`. */
  readonly ruta: string;
  /**
   * Versión de la base. Si no se da, se deriva del nombre del archivo, que es
   * lo que hace falta para poder responder "por qué el sistema dijo Córdoba"
   * (ADR-029: `versionDeLaBase` se registra junto a la sesión).
   */
  readonly version?: string;
}

export class BaseLocalDeUbicacion implements PuertoUbicacionPorIp {
  readonly cobertura: DeclaracionDeCobertura;
  readonly versionDeLaBase: string;
  readonly atribucion = ATRIBUCION_REQUERIDA;

  private constructor(
    private readonly ipv4: Tabla,
    private readonly ipv6: Tabla,
    private readonly ubicaciones: readonly UbicacionAproximada[],
    version: string,
    tieneProvincia: boolean,
  ) {
    this.versionDeLaBase = version;
    this.cobertura = {
      puerto: 'PuertoUbicacionPorIp',
      adaptador: 'BaseLocalDeUbicacion',
      proveedor: 'BASE_LOCAL_DE_UBICACION',
      usaRed: false,
      esEncargadoDeTratamiento: false,
      cubre: [
        'País a partir de IPv4 e IPv6, con una base descargada e incorporada a la imagen.',
        tieneProvincia
          ? 'Provincia, siempre rotulada como aproximada en la interfaz (ux.md CL-5).'
          : 'Sólo país: el archivo cargado es de nivel país y no trae provincia.',
        `${ipv4.inicios.length} rangos IPv4 y ${ipv6.inicios.length} rangos IPv6.`,
      ],
      noCubre: [
        'Ciudad, coordenadas y código postal: no se cargan ni se guardan (minimización, art. 4).',
        'Redes móviles y proveedores con salida centralizada: la respuesta puede ser de otra provincia. Por eso no decide nada, sólo informa.',
        'Direcciones privadas, de bucle local, de enlace local, CGNAT y de documentación: devuelven null.',
        'Direcciones que no están en la base: devuelven null. No se adivina.',
      ],
      version,
    };
  }

  async resolver(ip: DireccionIp): Promise<UbicacionAproximada | null> {
    const analizada = analizarIp(ip);
    if (analizada === null || analizada.esReservada) return null;
    const tabla = analizada.familia === 'IPV4' ? this.ipv4 : this.ipv6;
    const indice = buscar(tabla, analizada.valor);
    if (indice === null) return null;
    return this.ubicaciones[tabla.indices[indice] as number] ?? null;
  }

  /**
   * Carga el archivo. Es la única operación costosa y ocurre una vez, al
   * arrancar el proceso: después la consulta es una búsqueda binaria.
   */
  static async cargar(opciones: OpcionesDeLaBaseLocal): Promise<BaseLocalDeUbicacion> {
    if (!existsSync(opciones.ruta) || !statSync(opciones.ruta).isFile()) {
      throw faltaConfiguracion(
        'BASE_LOCAL_DE_UBICACION',
        `archivo-de-geolocalizacion:${opciones.ruta}`,
      );
    }

    const ipv4 = vacia();
    const ipv6 = vacia();
    const ubicaciones: UbicacionAproximada[] = [];
    const indicePorClave = new Map<string, number>();
    let tieneProvincia = false;

    const flujoCrudo = createReadStream(opciones.ruta);
    const flujo = opciones.ruta.endsWith('.gz') ? flujoCrudo.pipe(createGunzip()) : flujoCrudo;
    const lineas = createInterface({ input: flujo, crlfDelay: Infinity });

    for await (const linea of lineas) {
      if (linea.length === 0 || linea.startsWith('#')) continue;
      const partes = campos(linea);
      if (partes.length < 3) continue;

      const inicioTexto = (partes[0] ?? '').trim();
      const finTexto = (partes[1] ?? '').trim();
      const inicio = analizarIp(inicioTexto);
      const fin = analizarIp(finTexto);
      if (inicio === null || fin === null || inicio.familia !== fin.familia) continue;

      let pais: string;
      let provincia: string | null;
      if (partes.length >= 6) {
        pais = (partes[3] ?? '').trim();
        provincia = (partes[4] ?? '').trim() || null;
        if (provincia !== null) tieneProvincia = true;
      } else {
        pais = (partes[2] ?? '').trim();
        provincia = null;
      }
      if (pais.length === 0 || pais === 'ZZ') continue;

      const clave = `${pais}|${provincia ?? ''}`;
      let indice = indicePorClave.get(clave);
      if (indice === undefined) {
        if (ubicaciones.length >= 65_535) {
          // Sólo pasaría con un archivo de nivel ciudad de todo el planeta, que
          // este producto no necesita. Se avisa fuerte en vez de truncar callado.
          throw faltaConfiguracion(
            'BASE_LOCAL_DE_UBICACION',
            'demasiadas-ubicaciones-distintas:usar-archivo-de-nivel-pais-o-filtrado',
          );
        }
        indice = ubicaciones.length;
        ubicaciones.push(ubicacion(pais, provincia));
        indicePorClave.set(clave, indice);
      }

      const destino = inicio.familia === 'IPV4' ? ipv4 : ipv6;
      destino.inicios.push(inicio.valor);
      destino.fines.push(fin.valor);
      destino.indices.push(indice);
    }

    const version =
      opciones.version ?? basename(opciones.ruta).replace(/\.gz$/, '').replace(/\.csv$/, '');
    return new BaseLocalDeUbicacion(
      congelar(ipv4),
      congelar(ipv6),
      ubicaciones,
      version,
      tieneProvincia,
    );
  }
}
