/**
 * Verificador de integridad de la bitácora.
 *
 * Detecta alteraciones en la bitácora de auditoría comparando la raíz de Merkle
 * calculada contra la raíz almacenada en el sello.
 *
 * Un test de esta función altera un evento a mano en la base y verifica que
 * el comando de verificación lo detecta.
 */

import type { PrismaClient } from '@prisma/client';
import { SelladorDeBitacora } from './sellado';

/**
 * Resultado de verificación.
 */
export interface ResultadoVerificacion {
  readonly ok: boolean;
  readonly mensaje: string;
  readonly eventosAlterados?: number;
}

/**
 * Verificador de integridad.
 */
export class VerificadorDeBitacora {
  private sellador: SelladorDeBitacora;

  constructor(private prisma: PrismaClient) {
    this.sellador = new SelladorDeBitacora(prisma);
  }

  /**
   * Verifica la integridad de todos los sellos de una partición.
   *
   * Retorna `ok: false` si algún sello no coincide (indica alteración).
   */
  async verificarParticion(
    particion: Date,
    claveDeSecreto: string,
  ): Promise<ResultadoVerificacion> {
    // 1. Obtener sellos de la partición
    const sellos = await this.prisma.selloDeBitacora.findMany({
      where: {
        particion: {
          gte: new Date(particion.getFullYear(), particion.getMonth(), 1),
          lt: new Date(particion.getFullYear(), particion.getMonth() + 1, 1),
        },
      },
      orderBy: {
        desdeSecuencia: 'asc',
      },
    });

    if (sellos.length === 0) {
      return {
        ok: true,
        mensaje: 'No hay sellos para verificar en esta partición',
      };
    }

    // 2. Verificar cada sello
    let eventosAlterados = 0;
    for (const sello of sellos) {
      const raizCalculada = await this.sellador.recalcularRaiz(sello.desdeSecuencia, sello.hastaSecuencia);
      if (raizCalculada !== sello.raiz) {
        eventosAlterados += Number(sello.hastaSecuencia - sello.desdeSecuencia + BigInt(1));
      }
    }

    if (eventosAlterados > 0) {
      return {
        ok: false,
        mensaje: `Se detectaron alteraciones en ${eventosAlterados} eventos`,
        eventosAlterados,
      };
    }

    return {
      ok: true,
      mensaje: 'Integridad verificada para todos los sellos de la partición',
    };
  }

  /**
   * Verifica la integridad de toda la bitácora (todas las particiones).
   *
   * En producción, se ejecuta semanalmente en el pipeline.
   */
  async verificarBitacoraCompleta(
    claveDeSecreto: string,
  ): Promise<ResultadoVerificacion> {
    // 1. Obtener todos los sellos
    const sellos = await this.prisma.selloDeBitacora.findMany({
      orderBy: {
        particion: 'asc',
      },
    });

    if (sellos.length === 0) {
      return {
        ok: true,
        mensaje: 'No hay sellos en la bitácora',
      };
    }

    // 2. Verificar cada sello
    let eventosAlterados = 0;
    const partidosFallidas: number[] = [];

    for (const sello of sellos) {
      const raizCalculada = await this.sellador.recalcularRaiz(sello.desdeSecuencia, sello.hastaSecuencia);
      if (raizCalculada !== sello.raiz) {
        eventosAlterados += Number(sello.hastaSecuencia - sello.desdeSecuencia + BigInt(1));
        partidosFallidas.push(Number(sello.desdeSecuencia));
      }
    }

    if (eventosAlterados > 0) {
      return {
        ok: false,
        mensaje: `[ALERTA CRÍTICA] Se detectaron alteraciones en ${eventosAlterados} eventos de ${sellos.length} particiones. ` +
          `Particiones afectadas: ${partidosFallidas.join(', ')}`,
        eventosAlterados,
      };
    }

    return {
      ok: true,
      mensaje: `Integridad verificada para ${sellos.length} sellos de la bitácora`,
    };
  }

  /**
   * Comando ejecutable: verifica la bitácora y reporta.
   * En producción, se corre en el pipeline y envía alertas si falla.
   */
  async verificarYReportar(claveDeSecreto: string): Promise<void> {
    const resultado = await this.verificarBitacoraCompleta(claveDeSecreto);

    console.log('═'.repeat(80));
    console.log('VERIFICACION DE INTEGRIDAD DE BITACORA');
    console.log('═'.repeat(80));
    console.log(`Estado: ${resultado.ok ? '✓ OK' : '✗ FALLÓ'}`);
    console.log(`Mensaje: ${resultado.mensaje}`);
    if (resultado.eventosAlterados) {
      console.log(`Eventos alterados: ${resultado.eventosAlterados}`);
    }
    console.log('═'.repeat(80));

    if (!resultado.ok) {
      process.exit(1);
    }
  }
}
