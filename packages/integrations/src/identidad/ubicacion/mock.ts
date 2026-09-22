/**
 * Mock de ubicación por IP: tabla embebida, determinista, sin archivo y sin red.
 *
 * ── Qué es y qué no es esta tabla ─────────────────────────────────────────
 * Es una tabla **de demostración**. No es la base real y no pretende ser
 * exacta sobre ninguna red del mundo. Está armada sobre dos clases de rangos:
 *
 * 1. Los rangos que el IETF reserva para documentación (RFC 5737 para IPv4 y
 *    2001:db8::/32 para IPv6). Son los que usan los tests y las siembras: no
 *    le pertenecen a nadie, así que asignarles una provincia no afirma nada
 *    falso sobre ningún proveedor real.
 * 2. Unos pocos bloques verosímiles de la región, para que una demostración
 *    con direcciones de aspecto argentino muestre algo razonable. Son
 *    aproximados y así están rotulados.
 *
 * La base real la carga `BaseLocalDeUbicacion` desde el archivo de DB-IP Lite
 * que mantiene `cicd`. Este mock existe para que el sistema corra end to end
 * sin ese archivo, no para reemplazarlo.
 */

import type { DeclaracionDeCobertura } from '../../nucleo';
import {
  analizarIp,
  ubicacion,
  type DireccionIp,
  type PuertoUbicacionPorIp,
  type UbicacionAproximada,
} from './puerto';

export const VERSION_DE_LA_BASE_MOCK = 'mock-tabla-embebida/2026-09';

interface RangoDeDemostracion {
  readonly desde: string;
  readonly hasta: string;
  readonly pais: string;
  readonly provincia: string | null;
  readonly nota: string;
}

/**
 * Rangos de demostración, ordenados por inicio. El orden se verifica en el
 * constructor: una tabla desordenada rompería la búsqueda binaria en silencio.
 */
export const RANGOS_DE_DEMOSTRACION: readonly RangoDeDemostracion[] = [
  // ── Bloques verosímiles de la región, ordenados por IP ────────────────────
  {
    desde: '181.0.0.0',
    hasta: '181.15.255.255',
    pais: 'AR',
    provincia: 'Buenos Aires',
    nota: 'Bloque de la región administrado por LACNIC. Asignación aproximada, sólo demostración.',
  },
  {
    desde: '190.16.0.0',
    hasta: '190.19.255.255',
    pais: 'AR',
    provincia: 'Santa Fe',
    nota: 'Bloque de la región administrado por LACNIC. Asignación aproximada, sólo demostración.',
  },
  // ── Reservados para documentación (RFC 5737): son los que usan los tests ──
  {
    desde: '192.0.2.0',
    hasta: '192.0.2.255',
    pais: 'AR',
    provincia: 'Ciudad Autónoma de Buenos Aires',
    nota: 'TEST-NET-1, reservado por RFC 5737. Fijación para tests y siembras.',
  },
  {
    desde: '198.51.100.0',
    hasta: '198.51.100.255',
    pais: 'AR',
    provincia: 'Córdoba',
    nota: 'TEST-NET-2, reservado por RFC 5737. Fijación para tests y siembras.',
  },
  {
    desde: '200.45.0.0',
    hasta: '200.45.255.255',
    pais: 'AR',
    provincia: 'Ciudad Autónoma de Buenos Aires',
    nota: 'Bloque de la región administrado por LACNIC. Asignación aproximada, sólo demostración.',
  },
  {
    desde: '200.89.0.0',
    hasta: '200.89.255.255',
    pais: 'AR',
    provincia: 'Mendoza',
    nota: 'Bloque de la región administrado por LACNIC. Asignación aproximada, sólo demostración.',
  },
  {
    desde: '201.212.0.0',
    hasta: '201.215.255.255',
    pais: 'AR',
    provincia: null,
    nota: 'País sin provincia: el caso en el que la base sabe el país y nada más.',
  },
  {
    desde: '203.0.113.0',
    hasta: '203.0.113.255',
    pais: 'UY',
    provincia: 'Montevideo',
    nota: 'TEST-NET-3, reservado por RFC 5737. Fijación del caso "acceso desde el exterior".',
  },
];

/** IPv6: el rango que el IETF reserva para documentación, mismo criterio. */
export const RANGO_IPV6_DE_DEMOSTRACION = {
  desde: '2001:db8::',
  hasta: '2001:db8:ffff:ffff:ffff:ffff:ffff:ffff',
  pais: 'AR',
  provincia: 'Ciudad Autónoma de Buenos Aires',
  nota: '2001:db8::/32, reservado para documentación (RFC 3849). Fijación de los tests de IPv6.',
} as const;

export const COBERTURA_UBICACION_MOCK: DeclaracionDeCobertura = {
  puerto: 'PuertoUbicacionPorIp',
  adaptador: 'UbicacionPorIpMock',
  proveedor: 'BASE_LOCAL_DE_UBICACION',
  usaRed: false,
  esEncargadoDeTratamiento: false,
  cubre: [
    'Tabla embebida de demostración: ocho rangos IPv4 y uno IPv6.',
    'Mismo comportamiento que el adaptador real ante direcciones reservadas y desconocidas.',
  ],
  noCubre: [
    'Direcciones reales: cualquier IP fuera de la tabla devuelve null, igual que la base real ante una IP que no conoce.',
    'Precisión: la tabla es de demostración. La base real es DB-IP Lite y la mantiene cicd.',
  ],
  version: VERSION_DE_LA_BASE_MOCK,
};

interface RangoResuelto {
  readonly desde: bigint;
  readonly hasta: bigint;
  readonly ubicacion: UbicacionAproximada;
}

function resolver(rango: {
  desde: string;
  hasta: string;
  pais: string;
  provincia: string | null;
}): RangoResuelto {
  const desde = analizarIp(rango.desde);
  const hasta = analizarIp(rango.hasta);
  if (desde === null || hasta === null || desde.familia !== hasta.familia) {
    throw new Error(`Rango de demostración mal escrito: ${rango.desde}-${rango.hasta}`);
  }
  return { desde: desde.valor, hasta: hasta.valor, ubicacion: ubicacion(rango.pais, rango.provincia) };
}

export class UbicacionPorIpMock implements PuertoUbicacionPorIp {
  readonly cobertura = COBERTURA_UBICACION_MOCK;
  readonly versionDeLaBase = VERSION_DE_LA_BASE_MOCK;

  private readonly ipv4: readonly RangoResuelto[];
  private readonly ipv6: readonly RangoResuelto[];
  private consultas = 0;

  constructor() {
    this.ipv4 = RANGOS_DE_DEMOSTRACION.map(resolver);
    this.ipv6 = [resolver({ ...RANGO_IPV6_DE_DEMOSTRACION })];
    for (let i = 1; i < this.ipv4.length; i += 1) {
      const anterior = this.ipv4[i - 1] as RangoResuelto;
      const actual = this.ipv4[i] as RangoResuelto;
      if (actual.desde <= anterior.hasta) {
        throw new Error('La tabla de demostración tiene rangos superpuestos o desordenados.');
      }
    }
  }

  async resolver(ip: DireccionIp): Promise<UbicacionAproximada | null> {
    this.consultas += 1;
    const analizada = analizarIp(ip);
    if (analizada === null || analizada.esReservada) return null;
    const tabla = analizada.familia === 'IPV4' ? this.ipv4 : this.ipv6;
    const encontrado = tabla.find(
      (rango) => analizada.valor >= rango.desde && analizada.valor <= rango.hasta,
    );
    return encontrado?.ubicacion ?? null;
  }

  get cantidadDeConsultas(): number {
    return this.consultas;
  }

  reiniciar(): void {
    this.consultas = 0;
  }
}

export function crearUbicacionPorIpMock(): UbicacionPorIpMock {
  return new UbicacionPorIpMock();
}
