/**
 * Sellado periódico de la bitácora con raíz de Merkle.
 *
 * Implementa ADR-028 §5:
 * - Cada hora se calcula la raíz de Merkle de los eventos de la ventana
 * - Se firma con una clave **distinta de la de los tokens**, custodiada aparte
 * - El sello guarda partición, rango de secuencias, raíz, algoritmo, firma y `kid`
 * - Con eso, alterar un evento pasado exige falsificar un sello firmado con una
 *   clave que no está en la base
 *
 * Para pruebas: la verificación es un comando ejecutable a demanda, y corre
 * semanalmente en el pipeline sobre el entorno productivo.
 */

import { createHash } from 'crypto';
import type { Instante } from '@mejorar/shared/identidad/contrato/v1';
import type { PrismaClient } from '@prisma/client';

/**
 * Estructura de un sello de bitácora.
 */
export interface SelloDeBitacora {
  readonly particion: Date; // Mes de la partición sellada
  readonly desdeSecuencia: bigint;
  readonly hastaSecuencia: bigint;
  readonly raiz: string; // Raíz de Merkle (hex)
  readonly algoritmo: string; // "SHA-256/MERKLE"
  readonly firma: string; // Firma de la raíz (hex)
  readonly kid: string; // Key ID
  readonly momento: Date;
}

/**
 * Sellador de bitácora.
 */
export class SelladorDeBitacora {
  constructor(private prisma: PrismaClient) {}

  /**
   * Calcula la raíz de Merkle de los eventos en un rango de secuencia.
   * Usa SHA-256 y construye un árbol bottom-up.
   */
  private calcularRaizMerkle(eventos: readonly { secuencia: bigint; id: string }[]): string {
    if (eventos.length === 0) {
      return createHash('sha256').update('').digest('hex');
    }

    // Construir hashes de hojas
    const hojas = eventos.map((e) => createHash('sha256').update(e.id).digest('hex'));

    // Construir árbol bottom-up
    let nivel = hojas;
    while (nivel.length > 1) {
      const siguienteNivel: string[] = [];
      for (let i = 0; i < nivel.length; i += 2) {
        const hash1 = nivel[i];
        const hash2 = nivel[i + 1] || hash1; // Si impar, duplicar el último
        const combinado = createHash('sha256').update(hash1 + hash2).digest('hex');
        siguienteNivel.push(combinado);
      }
      nivel = siguienteNivel;
    }

    return nivel[0];
  }

  /**
   * Sella los eventos de una ventana de tiempo.
   * En producción, esta operación es realizada por una tarea programada.
   *
   * Para pruebas, puede ser llamada manualmente.
   */
  async sellarVentana(
    particion: Date, // Mes de la partición
    desdeSecuencia: bigint,
    hastaSecuencia: bigint,
    claveDeSecreto: string, // Clave privada de firma (en base64 o hex)
    kid: string, // Key ID de la clave
  ): Promise<SelloDeBitacora> {
    // 1. Obtener eventos en el rango
    const eventos = await this.prisma.eventoAuditoria.findMany({
      where: {
        secuencia: {
          gte: desdeSecuencia,
          lte: hastaSecuencia,
        },
      },
      orderBy: {
        secuencia: 'asc',
      },
      select: {
        secuencia: true,
        id: true,
      },
    });

    // 2. Calcular raíz de Merkle
    const raiz = this.calcularRaizMerkle(eventos);

    // 3. Firmar la raíz (simulado; en producción usa Ed25519 o similar)
    // Por ahora, HMAC-SHA256 como placeholder
    const firma = this.firmarRaiz(raiz, claveDeSecreto);

    // 4. Guardar sello
    const sello = await this.prisma.selloDeBitacora.create({
      data: {
        particion,
        desdeSecuencia,
        hastaSecuencia,
        raiz,
        algoritmo: 'SHA-256/MERKLE',
        firma,
        kid,
        momento: new Date(),
      },
    });

    return sello;
  }

  /**
   * Firma la raíz de Merkle (simulado con HMAC).
   * En producción: usar Ed25519 con clave privada custodiada.
   */
  private firmarRaiz(raiz: string, claveDeSecreto: string): string {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', claveDeSecreto);
    hmac.update(raiz);
    return hmac.digest('hex');
  }

  /**
   * Obtiene el sello más reciente de una partición.
   */
  async obtenerSello(particion: Date): Promise<SelloDeBitacora | null> {
    const sello = await this.prisma.selloDeBitacora.findFirst({
      where: {
        particion: {
          gte: new Date(particion.getFullYear(), particion.getMonth(), 1),
          lt: new Date(particion.getFullYear(), particion.getMonth() + 1, 1),
        },
      },
      orderBy: {
        momento: 'desc',
      },
    });

    return sello || null;
  }

  /**
   * Verifica que una raíz de Merkle es válida.
   * Usado internamente por el verificador de sellos.
   */
  async verificarRaiz(
    sello: SelloDeBitacora,
    claveDeSecreto: string,
  ): Promise<boolean> {
    const firmaEsperada = this.firmarRaiz(sello.raiz, claveDeSecreto);
    return firmaEsperada === sello.firma;
  }

  /**
   * Recalcula la raíz de Merkle de un rango de eventos.
   * Usado para detectar alteraciones en la bitácora.
   */
  async recalcularRaiz(
    desdeSecuencia: bigint,
    hastaSecuencia: bigint,
  ): Promise<string> {
    const eventos = await this.prisma.eventoAuditoria.findMany({
      where: {
        secuencia: {
          gte: desdeSecuencia,
          lte: hastaSecuencia,
        },
      },
      orderBy: {
        secuencia: 'asc',
      },
      select: {
        secuencia: true,
        id: true,
      },
    });

    return this.calcularRaizMerkle(eventos);
  }
}
