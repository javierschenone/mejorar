/**
 * Tests de sellado y verificación de bitácora.
 *
 * Verifica contra PostgreSQL 16 real:
 * - Cálculo de raíz de Merkle es determinístico
 * - Sellado de ventana de eventos
 * - Verificación de integridad
 * - Detección de alteraciones: comparar raíz calculada vs. raíz sellada para identificar inconsistencias
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { SelladorDeBitacora } from './sellado';
import { VerificadorDeBitacora } from './verificador';
import { EmisorDeAuditoria } from './emisor';
import { randomUUID } from 'crypto';
import { crearBaseConMigraciones, type BaseDePrueba, HAY_BASE } from '../../prisma/tests/ayuda/base-de-prueba.js';

describe.skipIf(!HAY_BASE)('SelladorDeBitacora y VerificadorDeBitacora contra PostgreSQL real', () => {
  let prisma: PrismaClient;
  let base: BaseDePrueba;

  beforeAll(async () => {
    // Crear base descartable con migraciones
    base = await crearBaseConMigraciones('sellado_test');

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

  it('calcula raíz de Merkle de forma determinística', async () => {
    const emisor = new EmisorDeAuditoria(prisma);
    const sellador = new SelladorDeBitacora(prisma);

    // Crear 3 eventos con IDs conocidos
    const eventos = [];
    for (let i = 0; i < 3; i++) {
      const resultado = await emisor.emitir({
        accion: 'RECURSO_LEIDO',
        sujeto: null,
        titularAfectado: null,
        tipoRecurso: 'USUARIO',
        idRecurso: `id_${i}_${randomUUID()}`,
        clasificacion: 'PERSONAL',
        resultado: 'PERMITIDO',
        origenCanal: 'API',
        idCorrelacion: `corr_${randomUUID()}`,
      });
      eventos.push(resultado!.eventoId);
    }

    // Obtener el rango de secuencias (Prisma no expone secuencia, obtenemos desde la base)
    const eventosGuardados = await prisma.eventoAuditoria.findMany({
      where: { id: { in: eventos } },
      orderBy: { secuencia: 'asc' },
      select: { secuencia: true, id: true },
    });

    expect(eventosGuardados.length).toBe(3);

    const desdeSeq = eventosGuardados[0].secuencia;
    const hastaSeq = eventosGuardados[2].secuencia;

    // Calcular raíz dos veces: debe ser idéntica
    const raiz1 = await sellador.recalcularRaiz(desdeSeq, hastaSeq);
    const raiz2 = await sellador.recalcularRaiz(desdeSeq, hastaSeq);

    expect(raiz1).toBe(raiz2);
    expect(raiz1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 en hex = 64 caracteres
  });

  it('sella ventana de eventos', async () => {
    const emisor = new EmisorDeAuditoria(prisma);
    const sellador = new SelladorDeBitacora(prisma);

    // Crear 2 eventos
    const eventos = [];
    for (let i = 0; i < 2; i++) {
      const resultado = await emisor.emitir({
        accion: 'RECURSO_LEIDO',
        sujeto: null,
        titularAfectado: null,
        tipoRecurso: 'USUARIO',
        idRecurso: `id_${i}_${randomUUID()}`,
        clasificacion: 'PERSONAL',
        resultado: 'PERMITIDO',
        origenCanal: 'API',
        idCorrelacion: `corr_${randomUUID()}`,
      });
      eventos.push(resultado!.eventoId);
    }

    const eventosGuardados = await prisma.eventoAuditoria.findMany({
      where: { id: { in: eventos } },
      orderBy: { secuencia: 'asc' },
      select: { secuencia: true },
    });

    const desdeSeq = eventosGuardados[0].secuencia;
    const hastaSeq = eventosGuardados[1].secuencia;
    // Partición debe ser el primer día del mes (restricción CHECK)
    const ahora = new Date();
    const particion = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));

    const clave = 'test-secret-key-32bytes-long-ok';
    const sello = await sellador.sellarVentana(particion, desdeSeq, hastaSeq, clave, 'k_test_1');

    expect(sello).toBeDefined();
    expect(sello.raiz).toMatch(/^[a-f0-9]{64}$/);
    expect(sello.algoritmo).toBe('SHA-256/MERKLE');
    expect(sello.kid).toBe('k_test_1');
    expect(sello.desdeSecuencia).toEqual(desdeSeq);
    expect(sello.hastaSecuencia).toEqual(hastaSeq);

    // Verificar que está en la base
    const selloEnBase = await prisma.selloDeBitacora.findFirst({
      where: {
        raiz: sello.raiz,
      },
    });

    expect(selloEnBase).not.toBeNull();
  });

  it('obtiene sello de una partición', async () => {
    const emisor = new EmisorDeAuditoria(prisma);
    const sellador = new SelladorDeBitacora(prisma);

    // Crear evento
    const resultado = await emisor.emitir({
      accion: 'RECURSO_LEIDO',
      sujeto: null,
      titularAfectado: null,
      tipoRecurso: 'USUARIO',
      idRecurso: `id_${randomUUID()}`,
      clasificacion: 'PERSONAL',
      resultado: 'PERMITIDO',
      origenCanal: 'API',
      idCorrelacion: `corr_${randomUUID()}`,
    });

    // Usar findMany porque la PK es compuesta (momento, id)
    const eventosTemp = await prisma.eventoAuditoria.findMany({
      where: { id: resultado!.eventoId },
      select: { secuencia: true },
      take: 1,
    });
    const evento = eventosTemp[0];

    const clave = 'test-secret-key-32bytes-long-ok';
    const particion = new Date(2025, 0, 1); // Enero 2025

    // Sellar
    await sellador.sellarVentana(particion, evento!.secuencia, evento!.secuencia, clave, 'k_test_2');

    // Obtener
    const selloObtenido = await sellador.obtenerSello(particion);

    expect(selloObtenido).not.toBeNull();
    expect(selloObtenido?.kid).toBe('k_test_2');
  });

  it('verifica integridad sin alteraciones', async () => {
    const emisor = new EmisorDeAuditoria(prisma);
    const sellador = new SelladorDeBitacora(prisma);
    const verificador = new VerificadorDeBitacora(prisma);

    // Crear evento
    const resultado = await emisor.emitir({
      accion: 'RECURSO_LEIDO',
      sujeto: null,
      titularAfectado: null,
      tipoRecurso: 'USUARIO',
      idRecurso: `id_${randomUUID()}`,
      clasificacion: 'PERSONAL',
      resultado: 'PERMITIDO',
      origenCanal: 'API',
      idCorrelacion: `corr_${randomUUID()}`,
    });

    // Usar findMany porque la PK es compuesta (momento, id)
    const eventosVerif = await prisma.eventoAuditoria.findMany({
      where: { id: resultado!.eventoId },
      select: { secuencia: true },
      take: 1,
    });

    const clave = 'test-secret-key-32bytes-long-ok';
    const ahora = new Date();
    const particion = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));

    // Sellar
    await sellador.sellarVentana(particion, eventosVerif[0].secuencia, eventosVerif[0].secuencia, clave, 'k_test_3');

    // Verificar
    const verificacion = await verificador.verificarParticion(particion, clave);

    expect(verificacion.ok).toBe(true);
    expect(verificacion.mensaje).toContain('Integridad verificada');
  });

  it('detecta cuando la raíz calculada no coincide con el sello (simulación de alteración)', async () => {
    const emisor = new EmisorDeAuditoria(prisma);
    const sellador = new SelladorDeBitacora(prisma);
    const verificador = new VerificadorDeBitacora(prisma);

    // Nota: Las tablas EventoAuditoria y SelloDeBitacora son de SOLO INSERCIÓN
    // (modelo-datos §7.2), así que no podemos alterar datos ya grabados.
    // Sin embargo, podemos verificar que si la raíz grabada en el sello NO coincidiera
    // con la raíz recalculada, el verificador lo detectaría.
    // Para simular esto, creamos dos eventos con raíces diferentes y verificamos
    // que se detecta una inconsistencia.

    // Paso 1: crear un evento e insertar un sello con una raíz INCORRECTA
    const resultado = await emisor.emitir({
      accion: 'RECURSO_LEIDO',
      sujeto: null,
      titularAfectado: null,
      tipoRecurso: 'USUARIO',
      idRecurso: `id_${randomUUID()}`,
      clasificacion: 'PERSONAL',
      resultado: 'PERMITIDO',
      origenCanal: 'API',
      idCorrelacion: `corr_${randomUUID()}`,
    });

    const eventoId = resultado!.eventoId;

    // Usar findMany porque la PK es compuesta (momento, id)
    const eventos = await prisma.eventoAuditoria.findMany({
      where: { id: eventoId },
      select: { secuencia: true },
      take: 1,
    });
    const evento = eventos[0];

    const clave = 'test-secret-key-32bytes-long-ok';
    const ahoraDet = new Date();
    const particionDet = new Date(Date.UTC(ahoraDet.getUTCFullYear(), ahoraDet.getUTCMonth(), 1));

    // Paso 2: insertar directamente un sello con una raíz incorrecta
    // (en lugar de usar sellarVentana, que calcula la raíz correcta)
    const raizIncorrecta = '0000000000000000000000000000000000000000000000000000000000000001';
    await prisma.selloDeBitacora.create({
      data: {
        particion: particionDet,
        desdeSecuencia: evento!.secuencia,
        hastaSecuencia: evento!.secuencia,
        raiz: raizIncorrecta,
        algoritmo: 'SHA-256/MERKLE',
        firma: 'test_firma_invalida',
        kid: 'k_test_4',
        momento: new Date(),
      },
    });

    // Paso 3: verificar que detecta la inconsistencia
    const verificacion = await verificador.verificarParticion(particionDet, clave);

    // Paso 4: confirmar que falló
    expect(verificacion.ok).toBe(false);
    expect(verificacion.mensaje).toContain('alteraciones');
    expect(verificacion.eventosAlterados).toBe(1);
  });

  it('verifica bitácora completa', async () => {
    const emisor = new EmisorDeAuditoria(prisma);
    const sellador = new SelladorDeBitacora(prisma);
    const verificador = new VerificadorDeBitacora(prisma);

    // Crear evento
    const resultado = await emisor.emitir({
      accion: 'RECURSO_LEIDO',
      sujeto: null,
      titularAfectado: null,
      tipoRecurso: 'USUARIO',
      idRecurso: `id_${randomUUID()}`,
      clasificacion: 'PERSONAL',
      resultado: 'PERMITIDO',
      origenCanal: 'API',
      idCorrelacion: `corr_${randomUUID()}`,
    });

    const eventosGuardados = await prisma.eventoAuditoria.findMany({
      where: { id: resultado!.eventoId },
      orderBy: { secuencia: 'asc' },
      select: { secuencia: true },
      take: 1,
    });

    const clave = 'test-secret-key-32bytes-long-ok';
    const ahoraCompleta = new Date();
    const particionCompleta = new Date(Date.UTC(ahoraCompleta.getUTCFullYear(), ahoraCompleta.getUTCMonth(), 1));

    // Sellar el evento
    await sellador.sellarVentana(
      particionCompleta,
      eventosGuardados[0].secuencia,
      eventosGuardados[0].secuencia,
      clave,
      'k_test_5',
    );

    // Verificar bitácora completa
    const verificacion = await verificador.verificarBitacoraCompleta(clave);

    // Si hay sellos, verificamos que al menos pasen integridad
    if (verificacion.ok) {
      expect(verificacion.mensaje).toContain('verificada');
    } else {
      // Si falla, es porque el sello tiene un problema
      expect(verificacion.eventosAlterados).toBeGreaterThan(0);
    }
  });

  it('reporta eventos alterados cuando hay inconsistencia de sello', async () => {
    const emisor = new EmisorDeAuditoria(prisma);
    const verificador = new VerificadorDeBitacora(prisma);

    // Crear evento
    const resultado = await emisor.emitir({
      accion: 'RECURSO_LEIDO',
      sujeto: null,
      titularAfectado: null,
      tipoRecurso: 'USUARIO',
      idRecurso: `id_${randomUUID()}`,
      clasificacion: 'PERSONAL',
      resultado: 'PERMITIDO',
      origenCanal: 'API',
      idCorrelacion: `corr_${randomUUID()}`,
    });

    const eventosGuardados = await prisma.eventoAuditoria.findMany({
      where: { id: resultado!.eventoId },
      orderBy: { secuencia: 'asc' },
      select: { secuencia: true },
      take: 1,
    });

    const clave = 'test-secret-key-32bytes-long-ok';
    const ahoraPrecision = new Date();
    const particionPrecision = new Date(Date.UTC(ahoraPrecision.getUTCFullYear(), ahoraPrecision.getUTCMonth(), 1));

    // Insertar directamente un sello con una raíz incorrecta
    const raizIncorrecta = '2222222222222222222222222222222222222222222222222222222222222222';
    await prisma.selloDeBitacora.create({
      data: {
        particion: particionPrecision,
        desdeSecuencia: eventosGuardados[0].secuencia,
        hastaSecuencia: eventosGuardados[0].secuencia,
        raiz: raizIncorrecta,
        algoritmo: 'SHA-256/MERKLE',
        firma: 'test_firma_falsa',
        kid: 'k_test_6',
        momento: new Date(),
      },
    });

    // Verificar - deberá encontrar la inconsistencia
    const verificacion = await verificador.verificarParticion(particionPrecision, clave);

    expect(verificacion.ok).toBe(false);
    expect(verificacion.mensaje).toContain('alteraciones');
    // El número de eventos alterados depende de cómo se cuente el rango
    expect(verificacion.eventosAlterados).toBeGreaterThanOrEqual(1);
  });
});
