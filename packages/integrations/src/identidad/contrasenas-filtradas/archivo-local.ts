/**
 * Adaptador real: archivo local de contraseñas filtradas (ADR-024 punto 4).
 *
 * Formato: binario, plano, **ordenado ascendente**, con registros de ancho
 * fijo que guardan los primeros `anchoDelPrefijo` bytes del SHA-1 de cada
 * contraseña. Con 8 bytes y el orden del millón más usado son 8 MB en memoria
 * y una búsqueda binaria de veinte comparaciones.
 *
 * Sobre "sin falsos positivos": con prefijo de 8 bytes la probabilidad de que
 * una contraseña ajena a la lista choque con alguna de sus entradas es del
 * orden de 10⁻¹³ por consulta. No es cero, y el efecto de un choque es
 * benigno: se le pide a la persona que elija otra contraseña. Quien prefiera
 * cero riesgo construye el archivo con `anchoDelPrefijo: 20` (el SHA-1
 * completo, 20 MB) y no cambia ninguna otra línea.
 *
 * Lo que este adaptador **no** hace, y es el punto del ADR: consultar a nadie.
 * Ni siquiera con k-anonimato. La contraseña no sale del proceso.
 */

import { createWriteStream, existsSync, readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

import { faltaConfiguracion, type DeclaracionDeCobertura } from '../../nucleo';
import { huellaSha1, type PuertoListaDeContrasenasFiltradas } from './puerto';

export const ANCHO_DE_PREFIJO_POR_DEFECTO = 8;

export interface OpcionesDelArchivoLocal {
  readonly ruta: string;
  /** Bytes de SHA-1 por registro. Tiene que coincidir con el del archivo. */
  readonly anchoDelPrefijo?: number;
  readonly version?: string;
}

function prefijoDe(contrasena: string, ancho: number): Buffer {
  return Buffer.from(huellaSha1(contrasena), 'hex').subarray(0, ancho);
}

export class ArchivoLocalDeContrasenasFiltradas implements PuertoListaDeContrasenasFiltradas {
  readonly cobertura: DeclaracionDeCobertura;
  readonly cantidadDeEntradas: number;

  private constructor(
    private readonly datos: Buffer,
    private readonly anchoDelPrefijo: number,
    version: string,
  ) {
    this.cantidadDeEntradas = datos.length / anchoDelPrefijo;
    this.cobertura = {
      puerto: 'PuertoListaDeContrasenasFiltradas',
      adaptador: 'ArchivoLocalDeContrasenasFiltradas',
      proveedor: 'LISTA_LOCAL_DE_CONTRASENAS',
      usaRed: false,
      esEncargadoDeTratamiento: false,
      cubre: [
        `${this.cantidadDeEntradas} contraseñas filtradas, por prefijo de SHA-1 de ${anchoDelPrefijo} bytes.`,
        'Consulta local por búsqueda binaria, sin red y sin disco después de cargar.',
      ],
      noCubre: [
        anchoDelPrefijo >= 20
          ? 'Nada: el registro es el SHA-1 completo.'
          : `Certeza absoluta: un prefijo de ${anchoDelPrefijo} bytes admite choques con probabilidad despreciable. El efecto de un choque es pedir otra contraseña.`,
        'Variantes no listadas de una contraseña listada.',
        'La actualización del archivo: es tarea de cicd, no de este código.',
      ],
      version,
    };
  }

  async contiene(contrasenaNormalizada: string): Promise<boolean> {
    const buscado = prefijoDe(contrasenaNormalizada, this.anchoDelPrefijo);
    let bajo = 0;
    let alto = this.cantidadDeEntradas - 1;
    while (bajo <= alto) {
      const medio = (bajo + alto) >>> 1;
      const desde = medio * this.anchoDelPrefijo;
      const comparacion = Buffer.compare(
        this.datos.subarray(desde, desde + this.anchoDelPrefijo),
        buscado,
      );
      if (comparacion === 0) return true;
      if (comparacion < 0) bajo = medio + 1;
      else alto = medio - 1;
    }
    return false;
  }

  static cargar(opciones: OpcionesDelArchivoLocal): ArchivoLocalDeContrasenasFiltradas {
    const ancho = opciones.anchoDelPrefijo ?? ANCHO_DE_PREFIJO_POR_DEFECTO;
    if (!existsSync(opciones.ruta) || !statSync(opciones.ruta).isFile()) {
      throw faltaConfiguracion(
        'LISTA_LOCAL_DE_CONTRASENAS',
        `archivo-de-contrasenas-filtradas:${opciones.ruta}`,
      );
    }
    const datos = readFileSync(opciones.ruta);
    if (datos.length === 0 || datos.length % ancho !== 0) {
      throw faltaConfiguracion(
        'LISTA_LOCAL_DE_CONTRASENAS',
        `archivo-de-contrasenas-filtradas-mal-formado:ancho-${ancho}`,
      );
    }
    return new ArchivoLocalDeContrasenasFiltradas(
      datos,
      ancho,
      opciones.version ?? basename(opciones.ruta),
    );
  }
}

/**
 * Construye el archivo a partir de una lista de contraseñas en claro.
 *
 * Es una herramienta de construcción, no del camino de ejecución: la usa
 * `cicd` para convertir el listado publicado al formato que lee el adaptador.
 * Está acá y no en un script suelto para que el formato lo defina un solo
 * archivo y no dos.
 */
export async function construirArchivoDeContrasenasFiltradas(
  contrasenas: Iterable<string> | AsyncIterable<string>,
  rutaDeSalida: string,
  anchoDelPrefijo: number = ANCHO_DE_PREFIJO_POR_DEFECTO,
): Promise<number> {
  const prefijos: Buffer[] = [];
  const vistos = new Set<string>();
  for await (const contrasena of contrasenas as AsyncIterable<string>) {
    const limpia = contrasena.replace(/\r?\n$/, '');
    if (limpia.length === 0) continue;
    const prefijo = prefijoDe(limpia, anchoDelPrefijo);
    const clave = prefijo.toString('hex');
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    prefijos.push(prefijo);
  }
  prefijos.sort(Buffer.compare);

  await new Promise<void>((resolver, rechazar) => {
    const salida = createWriteStream(rutaDeSalida);
    salida.on('error', rechazar);
    salida.on('finish', resolver);
    for (const prefijo of prefijos) salida.write(prefijo);
    salida.end();
  });

  return prefijos.length;
}
