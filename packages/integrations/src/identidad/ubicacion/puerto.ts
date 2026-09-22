/**
 * Puerto de ubicación aproximada por IP (§13 del contrato, ADR-029 punto 1).
 *
 * **Resolución local obligatoria.** Está prohibido un adaptador que consulte
 * una API externa, y el contrato lo hace cumplir por tipos: `UbicacionAproximada`
 * declara `fuente: 'BASE_LOCAL'` como literal, así que un adaptador que
 * consultara a un tercero no podría construir el valor de retorno sin mentir
 * en el campo. Por eso este directorio no tiene —ni puede tener— `http.ts`.
 *
 * Consecuencia directa, que es el motivo de todo esto: no hay encargado de
 * tratamiento, no hay transferencia internacional y no hay dependencia de red
 * para este dato (dictamen §2.2.b, condición C-002-10).
 *
 * El resultado es grueso a propósito: país y provincia. Sin ciudad, sin
 * coordenadas, sin código postal. Y **nunca** es entrada de una regla de
 * seguridad: es informativo para el titular, para que pueda reconocer un
 * acceso ajeno (CA-13).
 */

import type { DireccionIp, PuertoUbicacionPorIp, UbicacionAproximada } from '../contrato';

export type { DireccionIp, PuertoUbicacionPorIp, UbicacionAproximada };

/** Construye una `UbicacionAproximada` con la fuente ya fijada. */
export function ubicacion(
  pais: string | null,
  provincia: string | null,
): UbicacionAproximada {
  return { pais, provincia, fuente: 'BASE_LOCAL' };
}

/* ── Análisis de direcciones ───────────────────────────────────────────── */

export type FamiliaDeIp = 'IPV4' | 'IPV6';

export interface IpAnalizada {
  readonly familia: FamiliaDeIp;
  /**
   * Valor numérico comparable. Para IPv4, los 32 bits. Para IPv6, los 64 bits
   * altos: la granularidad de un /64 sobra para decidir un país, y evita
   * aritmética de 128 bits en el camino caliente.
   */
  readonly valor: bigint;
  /**
   * `true` si es privada, de bucle local, de enlace local, de multidifusión o
   * de traducción a gran escala (CGNAT). Para todas ellas la respuesta correcta
   * es "no sé", no un país inventado.
   *
   * Los rangos que el IETF reserva **para documentación** (192.0.2.0/24,
   * 198.51.100.0/24, 203.0.113.0/24 y 2001:db8::/32) quedan a propósito fuera
   * de esta lista: son las fijaciones del mock y de los tests, y marcarlos como
   * reservados los volvería inservibles para eso. No son enrutables, así que la
   * IP de una persona real nunca cae ahí.
   */
  readonly esReservada: boolean;
}

const OCTETO = /^\d{1,3}$/;

function analizarIpv4(texto: string): bigint | null {
  const partes = texto.split('.');
  if (partes.length !== 4) return null;
  let valor = 0n;
  for (const parte of partes) {
    if (!OCTETO.test(parte)) return null;
    const numero = Number(parte);
    if (numero > 255) return null;
    valor = (valor << 8n) | BigInt(numero);
  }
  return valor;
}

function analizarIpv6(texto: string): bigint | null {
  const [antes = '', despues, ...resto] = texto.split('::');
  if (resto.length > 0) return null;
  const izquierda = antes === '' ? [] : antes.split(':');
  const derecha = despues === undefined || despues === '' ? [] : despues.split(':');
  if (despues === undefined && izquierda.length !== 8) return null;

  const relleno = 8 - izquierda.length - derecha.length;
  if (relleno < 0) return null;
  const grupos = [...izquierda, ...Array<string>(relleno).fill('0'), ...derecha];

  let valor = 0n;
  for (const grupo of grupos) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(grupo)) return null;
    valor = (valor << 16n) | BigInt(Number.parseInt(grupo, 16));
  }
  return valor;
}

/** Rangos IPv4 reservados, en notación `[inicio, fin]` sobre 32 bits. */
const RESERVADOS_IPV4: readonly (readonly [bigint, bigint])[] = [
  [0x00000000n, 0x00ffffffn], // 0.0.0.0/8       — esta red
  [0x0a000000n, 0x0affffffn], // 10.0.0.0/8      — privada
  [0x64400000n, 0x647fffffn], // 100.64.0.0/10   — CGNAT
  [0x7f000000n, 0x7fffffffn], // 127.0.0.0/8     — bucle local
  [0xa9fe0000n, 0xa9feffffn], // 169.254.0.0/16  — enlace local
  [0xac100000n, 0xac1fffffn], // 172.16.0.0/12   — privada
  [0xc0a80000n, 0xc0a8ffffn], // 192.168.0.0/16  — privada
  [0xe0000000n, 0xffffffffn], // 224.0.0.0/4 y superiores — multidifusión y reservados
];

function esReservadaIpv4(valor: bigint): boolean {
  return RESERVADOS_IPV4.some(([inicio, fin]) => valor >= inicio && valor <= fin);
}

/**
 * Analiza una dirección. Acepta IPv4, IPv6 y la forma mapeada
 * `::ffff:200.45.12.34`, que es la que aparece cuando un servidor escucha en
 * doble pila y es un error clásico tratarla como IPv6.
 */
export function analizarIp(ip: string): IpAnalizada | null {
  const texto = ip.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (texto.length === 0 || texto.length > 45) return null;

  if (!texto.includes(':')) {
    const valor = analizarIpv4(texto);
    if (valor === null) return null;
    return { familia: 'IPV4', valor, esReservada: esReservadaIpv4(valor) };
  }

  const mapeada = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(texto);
  if (mapeada && mapeada[1] !== undefined) {
    const valor = analizarIpv4(mapeada[1]);
    if (valor === null) return null;
    return { familia: 'IPV4', valor, esReservada: esReservadaIpv4(valor) };
  }

  const completa = analizarIpv6(texto);
  if (completa === null) return null;
  const altos = completa >> 64n;
  const esReservada =
    completa === 0n || // ::
    completa === 1n || // ::1 bucle local
    (completa >> 121n) === 0x7fn || // fe00::/7 — incluye enlace local fe80::/10
    (altos >> 57n) === 0x7en; // fc00::/7 únicas locales
  return { familia: 'IPV6', valor: altos, esReservada };
}
