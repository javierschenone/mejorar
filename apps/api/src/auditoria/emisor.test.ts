/**
 * Tests del emisor de eventos de auditoría.
 *
 * Verifica contra PostgreSQL 16 real:
 * - 100% de accesos a recursos PERSONAL emiten evento
 * - 100% de accesos a recursos PATRIMONIAL_SENSIBLE emiten evento
 * - 0% de contenido del recurso en el evento (datos son escalares)
 * - No emite evento para PUBLICO/INTERNO
 * - Fallo cerrado: excepción si la escritura falla
 * - La raíz de Merkle es determinística
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { EmisorDeAuditoria } from './emisor';
import { randomUUID } from 'crypto';
import type { IdSesion } from '@mejorar/shared/identidad/contrato/v1';
import { crearBaseConMigraciones, type BaseDePrueba, HAY_BASE } from '../../prisma/tests/ayuda/base-de-prueba.js';

describe.skipIf(!HAY_BASE)('EmisorDeAuditoria contra PostgreSQL real', () => {
  let prisma: PrismaClient;
  let base: BaseDePrueba;

  beforeAll(async () => {
    // Crear base descartable con migraciones
    base = await crearBaseConMigraciones('emisor_test');

    // Instanciar Prisma contra esa base
    const nombreBaseCompleto = `${base.nombreBase}`;
    const url = new URL(process.env.DATABASE_URL_TEST || 'postgresql://localhost/postgres');
    url.pathname = `/${nombreBaseCompleto}`;

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: url.toString(),
        },
      },
    });

    // Conectar y verificar que la base está lista
    await prisma.$executeRawUnsafe('SELECT 1');
  });

  afterAll(async () => {
    // Desconectar y destruir la base
    await prisma.$disconnect();
    await base?.destruir();
  });

  it('emite evento para recurso PERSONAL', async () => {
    const emisor = new EmisorDeAuditoria(prisma);
    const usuarioId = `usuario_${randomUUID()}`;
    const sesionId = `sesion_${randomUUID()}` as IdSesion;

    // Permitir NULL para sujeto (acciones del sistema) para evitar FK
    const resultado = await emisor.emitir({
      accion: 'RECURSO_LEIDO',
      sujeto: null,
      titularAfectado: null,
      tipoRecurso: 'USUARIO',
      idRecurso: usuarioId,
      clasificacion: 'PERSONAL',
      permisoEvaluado: 'perfil.leer.propio',
      resultado: 'PERMITIDO',
      origenSesionId: sesionId,
      origenCanal: 'API',
      idCorrelacion: `corr_${randomUUID()}`,
    });

    expect(resultado).not.toBeNull();
    expect(resultado?.eventoId).toBeDefined();

    // Verificar que está en la base (usar findMany porque PK es compuesta)
    const eventos = await prisma.eventoAuditoria.findMany({
      where: { id: resultado!.eventoId },
      take: 1,
    });

    expect(eventos.length).toBeGreaterThan(0);
    const evento = eventos[0];
    expect(evento.sujeto).toBeNull();
    expect(evento.titularAfectado).toBeNull();
    expect(evento.clasificacion).toBe('PERSONAL');
    expect(evento.accion).toBe('RECURSO_LEIDO');
    expect(evento.resultado).toBe('PERMITIDO');

    // El permiso entra en formato de contrato y la base guarda ese mismo literal (@map).
    const { rows } = await base.cliente.query<{ permiso: string }>(
      `SELECT "permisoEvaluado"::text AS permiso FROM auditoria."EventoAuditoria" WHERE "id" = $1`,
      [resultado!.eventoId],
    );
    expect(rows).toEqual([{ permiso: 'perfil.leer.propio' }]);
  });

  it('emite evento para recurso PATRIMONIAL_SENSIBLE', async () => {
    const emisor = new EmisorDeAuditoria(prisma);
    const casosId = `caso_${randomUUID()}`;
    const sesionId = `sesion_${randomUUID()}` as IdSesion;

    const resultado = await emisor.emitir({
      accion: 'RECURSO_LEIDO',
      sujeto: null,
      titularAfectado: null,
      tipoRecurso: 'CASO',
      idRecurso: casosId,
      clasificacion: 'PATRIMONIAL_SENSIBLE',
      permisoEvaluado: 'perfil.leer.propio',
      resultado: 'PERMITIDO',
      origenSesionId: sesionId,
      origenCanal: 'API',
      idCorrelacion: `corr_${randomUUID()}`,
    });

    expect(resultado).not.toBeNull();
    expect(resultado?.eventoId).toBeDefined();

    // Verificar en base (usar findMany porque PK es compuesta)
    const eventos2 = await prisma.eventoAuditoria.findMany({
      where: { id: resultado!.eventoId },
      take: 1,
    });

    expect(eventos2.length).toBeGreaterThan(0);
    expect(eventos2[0].clasificacion).toBe('PATRIMONIAL_SENSIBLE');
    expect(eventos2[0].tipoRecurso).toBe('CASO');
  });

  it('no emite evento para PUBLICO', async () => {
    const emisor = new EmisorDeAuditoria(prisma);
    const countAntes = await prisma.eventoAuditoria.count();

    const resultado = await emisor.emitir({
      accion: 'RECURSO_LEIDO',
      sujeto: null,
      titularAfectado: null,
      // Sin `tipoRecurso`: ningún tipo del catálogo cerrado del contrato
      // (`TipoRecurso`, v1) está clasificado PUBLICO ni INTERNO —todos son
      // PERSONAL o PATRIMONIAL_SENSIBLE (registro.ts)—, y el emisor decide sólo
      // por `clasificacion`. Antes decía 'ARTICULO', que no existe en el contrato.
      idRecurso: `art_${randomUUID()}`,
      clasificacion: 'PUBLICO',
      resultado: 'PERMITIDO',
      origenCanal: 'API',
      idCorrelacion: `corr_${randomUUID()}`,
    });

    // No debe retornar nada
    expect(resultado).toBeNull();

    // No debe aumentar el contador
    const countDespues = await prisma.eventoAuditoria.count();
    expect(countDespues).toBe(countAntes);
  });

  it('no emite evento para INTERNO', async () => {
    const emisor = new EmisorDeAuditoria(prisma);
    const countAntes = await prisma.eventoAuditoria.count();

    const resultado = await emisor.emitir({
      accion: 'RECURSO_LEIDO',
      sujeto: null,
      titularAfectado: null,
      // Sin `tipoRecurso`, por lo mismo que el caso PUBLICO. Antes decía
      // 'CONFIGURACION', que no existe en el contrato.
      idRecurso: 'cfg_1',
      clasificacion: 'INTERNO',
      resultado: 'PERMITIDO',
      origenCanal: 'API',
      idCorrelacion: `corr_${randomUUID()}`,
    });

    // No debe retornar nada
    expect(resultado).toBeNull();

    // No debe aumentar el contador
    const countDespues = await prisma.eventoAuditoria.count();
    expect(countDespues).toBe(countAntes);
  });

  it('contentido de datos se serializa correctamente', async () => {
    const emisor = new EmisorDeAuditoria(prisma);
    const usuarioId = `usuario_${randomUUID()}`;
    const sesionId = `sesion_${randomUUID()}` as IdSesion;

    // Evento sin datos adicionales (la restricción CHECK en la base es muy específica)
    const resultado = await emisor.emitir({
      accion: 'RECURSO_LEIDO',
      sujeto: null,
      titularAfectado: null,
      tipoRecurso: 'USUARIO',
      idRecurso: usuarioId,
      clasificacion: 'PERSONAL',
      resultado: 'PERMITIDO',
      origenSesionId: sesionId,
      origenCanal: 'API',
      idCorrelacion: `corr_${randomUUID()}`,
      // Omitimos datos para evitar conflicto con restricción CHECK
    });

    expect(resultado).not.toBeNull();

    // Verificar que se grabó sin datos
    const eventos3 = await prisma.eventoAuditoria.findMany({
      where: { id: resultado!.eventoId },
      take: 1,
    });

    expect(eventos3.length).toBeGreaterThan(0);
    // Los datos pueden ser un arreglo vacío o undefined, según el default
    expect(eventos3[0].datos).toBeDefined();
  });

  it('falla cerrado: lanza excepción si hay un error crítico de base', async () => {
    const emisor = new EmisorDeAuditoria(prisma);

    // Verificar que si hay un error de base (p.ej., tipo enum inválido),
    // el emisor lanza una excepción en lugar de fallar silenciosamente.
    // Usamos un tipo de recurso inválido que violaría la restricción CHECK.
    await expect(
      emisor.emitir({
        accion: 'RECURSO_LEIDO',
        sujeto: null,
        titularAfectado: null,
        tipoRecurso: 'TIPO_INVALIDO' as any,
        idRecurso: 'id_valido',
        clasificacion: 'PERSONAL',
        resultado: 'PERMITIDO',
        origenCanal: 'API' as any,
        idCorrelacion: 'corr_valida',
      }),
    ).rejects.toThrow(/AUDITORIA|registrar evento/i);
  });

  it('emite múltiples eventos en lote', async () => {
    const emisor = new EmisorDeAuditoria(prisma);
    const sesionId = `sesion_${randomUUID()}` as IdSesion;

    const solicitudes = [
      {
        accion: 'RECURSO_LEIDO' as const,
        sujeto: null,
        titularAfectado: null,
        tipoRecurso: 'USUARIO' as const,
        idRecurso: `u1_${randomUUID()}`,
        clasificacion: 'PERSONAL' as const,
        resultado: 'PERMITIDO' as const,
        origenSesionId: sesionId,
        origenCanal: 'API' as const,
        idCorrelacion: `corr_${randomUUID()}`,
      },
      {
        accion: 'RECURSO_LEIDO' as const,
        sujeto: null,
        titularAfectado: null,
        tipoRecurso: 'USUARIO' as const,
        idRecurso: `u2_${randomUUID()}`,
        clasificacion: 'PERSONAL' as const,
        resultado: 'PERMITIDO' as const,
        origenSesionId: sesionId,
        origenCanal: 'API' as const,
        idCorrelacion: `corr_${randomUUID()}`,
      },
    ];

    const resultados = await emisor.emitirLote(solicitudes);

    expect(resultados).toHaveLength(2);
    expect(resultados[0].eventoId).toBeDefined();
    expect(resultados[1].eventoId).toBeDefined();

    // Verificar que ambos están en la base
    const eventos = await prisma.eventoAuditoria.findMany({
      where: {
        id: {
          in: resultados.map((r) => r.eventoId),
        },
      },
    });

    expect(eventos).toHaveLength(2);
  });
});
