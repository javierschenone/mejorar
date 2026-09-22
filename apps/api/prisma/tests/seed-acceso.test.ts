/**
 * El seed de demostración (`prisma/seed.ts`, modelo-datos §6.5).
 *
 * Que el seed **corra hasta el `COMMIT`** ya es la mitad del test: la
 * transacción no cierra si falta la designación del administrador, si falta su
 * evento de auditoría, si alguna cuenta llegó a `ACTIVA` sin sus dos
 * aceptaciones, o si la siembra quedó viva. Los cuatro disparadores diferidos
 * se evalúan ahí. El resto de los casos verifica que los datos sirvan para lo
 * que §6.5 dice que sirven: que los tres portales tengan algo que mostrar y
 * que la purga de CA-28 tenga qué purgar.
 */

import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  BaseDePrueba,
  crearBaseConMigraciones,
  HAY_BASE,
  MOTIVO_OMISION,
} from './ayuda/base-de-prueba.js';

const ejecutar = promisify(execFile);
const RAIZ_API = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe.skipIf(!HAY_BASE)('002 · Seed de demostración', () => {
  let base: BaseDePrueba;
  let cliente: Client;

  beforeAll(async () => {
    base = await crearBaseConMigraciones('a002sed');
    cliente = base.cliente;

    const url = new URL(process.env.DATABASE_URL_TEST!);
    url.pathname = `/${base.nombreBase}`;

    // Se corre DOS VECES a propósito: §6.5 exige que sea idempotente, y la
    // forma de saberlo no es leer el código sino correrlo de nuevo.
    for (let i = 0; i < 2; i += 1) {
      await ejecutar(
        process.execPath,
        ['--experimental-strip-types', '--disable-warning=ExperimentalWarning',
         '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'prisma/seed.ts'],
        { cwd: RAIZ_API, env: { ...process.env, DATABASE_URL: url.toString() } },
      );
    }
  }, 120_000);

  afterAll(async () => {
    await base?.destruir();
  });

  it('corre dos veces y no duplica nada', async () => {
    const { rows } = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM acceso."Usuario"`,
    );
    expect(rows[0]!.n).toBe('5');
  });

  it('CA-39 · hay un CLIENTE confirmado SIN segundo factor, con una sesión abierta y una cerrada', async () => {
    const { rows } = await cliente.query<{ estado: string; mfa: string }>(
      `SELECT "estadoCuenta" AS estado, "estadoMfa" AS mfa FROM acceso."Usuario" WHERE "rol" = 'CLIENTE' AND "confirmadoEn" IS NOT NULL`,
    );
    expect(rows).toEqual([{ estado: 'ACTIVA', mfa: 'NO_CONFIGURADO' }]);

    const { rows: sesiones } = await cliente.query<{ abiertas: string; cerradas: string }>(
      `SELECT count(*) FILTER (WHERE "cerradaEn" IS NULL)::text AS abiertas,
              count(*) FILTER (WHERE "cerradaEn" IS NOT NULL)::text AS cerradas
         FROM acceso."Sesion"`,
    );
    expect(sesiones[0]).toEqual({ abiertas: '1', cerradas: '1' });
  });

  it('CA-13 · las sesiones traen ubicación y dispositivo, y NUNCA la IP en claro', async () => {
    const { rows } = await cliente.query<{ pais: string; provincia: string; clase: string }>(
      `SELECT "ubicacionPais" AS pais, "ubicacionProvincia" AS provincia,
              "dispositivoClase"::text AS clase
         FROM acceso."Sesion" WHERE "cerradaEn" IS NULL`,
    );
    expect(rows[0]!.pais).toBe('AR');
    expect(rows[0]!.provincia).toBeTruthy();
    expect(rows[0]!.clase).toBe('APLICACION_MOVIL');

    // `ipHash` es `bytea` y no parece una dirección: si alguien sembrara la IP
    // en claro, acá se vería.
    const { rows: ip } = await cliente.query<{ texto: string }>(
      `SELECT encode("ipHash", 'escape') AS texto FROM acceso."Sesion" WHERE "cerradaEn" IS NULL`,
    );
    expect(ip[0]!.texto).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  it('CA-38 · el abogado verificado tiene evidencia completa, vigencia futura y MFA activo', async () => {
    const { rows } = await cliente.query<{
      resultado: string; vence: string; colegio: string; huella: string; mfa: string;
    }>(
      `SELECT d."resultado"::text AS resultado, d."vigenciaHasta"::text AS vence,
              d."evidenciaColegio" AS colegio, d."evidenciaHuellaDocumento" AS huella,
              u."estadoMfa"::text AS mfa
         FROM acceso."DecisionDeVerificacion" d
         JOIN acceso."Usuario" u ON u."id" = d."perfilUsuarioId"`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.resultado).toBe('APROBADA');
    expect(new Date(rows[0]!.vence).getTime()).toBeGreaterThan(Date.now());
    expect(rows[0]!.colegio).toBeTruthy();
    expect(rows[0]!.huella).toMatch(/^sha256:/);
    expect(rows[0]!.mfa).toBe('ACTIVO');
  });

  it('CA-31 · la cola de verificaciones pendientes tiene contenido el primer día', async () => {
    // Un tablero vacío no se puede revisar. Q-10 con su índice parcial.
    const { rows } = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM acceso."PerfilProfesional" WHERE "ultimaDecisionId" IS NULL`,
    );
    expect(rows[0]!.n).toBe('1');
    const { rows: esc } = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM acceso."EscalamientoDeVerificacion" WHERE "resueltoEn" IS NULL`,
    );
    expect(esc[0]!.n).toBe('1');
  });

  it('CA-33 y recaudo C-2 · el administrador es nominal y la siembra NO queda viva', async () => {
    const { rows } = await cliente.query<{ siembra: boolean; nominalizada: string | null }>(
      `SELECT "esSiembra" AS siembra, "nominalizadaEn"::text AS nominalizada
         FROM acceso."DesignacionDeAdministrador"`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.siembra).toBe(true);
    // El estado "siembra viva" no se distribuye.
    expect(rows[0]!.nominalizada).not.toBeNull();
  });

  it('CA-34 · la creación del administrador quedó auditada', async () => {
    const { rows } = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM auditoria."EventoAuditoria"
        WHERE "accion" IN ('ADMINISTRADOR_CREADO', 'ADMINISTRADOR_SEMBRADO')`,
    );
    expect(rows[0]!.n).toBe('1');
  });

  it('CA-28 · hay una cuenta nunca confirmada y vieja, para que la purga tenga qué purgar', async () => {
    const { rows } = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM acceso."Usuario"
        WHERE "estadoCuenta" = 'NO_VERIFICADA' AND "creadoEn" < now() - interval '30 days'`,
    );
    expect(rows[0]!.n).toBe('1');
  });

  it('R-002-04 · el catálogo de buzones de rol queda sembrado y el mecanismo deja de estar inerte', async () => {
    const { rows } = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM acceso."CorreoDeRolProhibido"`,
    );
    expect(Number(rows[0]!.n)).toBeGreaterThanOrEqual(10);
  });

  it('D-4 · ningún correo ni nombre quedó en claro en la base', async () => {
    // El seed cifra de verdad: si alguien "simplificara" guardando texto, el
    // dominio de los correos de demostración aparecería tal cual dentro de la
    // columna. Se busca esa cadena —17 caracteres— y no un byte suelto: en
    // bytes aleatorios un byte cualquiera aparece siempre, y un test que falla
    // por azar no es un test.
    const dominio = process.env.MEJORAR_DOMINIO_CORREO ?? 'mejorar.example';
    const { rows } = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM acceso."Usuario"
        WHERE position($1 in encode("correoCifrado", 'escape')) > 0
           OR position('Carla' in encode("nombreParaMostrarCifrado", 'escape')) > 0`,
      [dominio],
    );
    expect(rows[0]!.n).toBe('0');

    // Y el índice ciego tampoco revela: es un HMAC de 32 bytes.
    const { rows: indice } = await cliente.query<{ largo: number }>(
      `SELECT DISTINCT length("indiceCiegoCorreo") AS largo FROM acceso."Usuario"`,
    );
    expect(indice).toEqual([{ largo: 32 }]);
  });

  it('CA-10 de la 001 · "mi actividad reciente" de cada titular muestra sólo lo propio', async () => {
    const { rows } = await cliente.query<{ titular: string; n: string }>(
      `SELECT "titularAfectado" AS titular, count(*)::text AS n
         FROM auditoria."EventoAuditoria" WHERE "titularAfectado" IS NOT NULL
        GROUP BY 1 ORDER BY 1`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(rows.every((r) => Number(r.n) >= 1)).toBe(true);
  });
});

describe.skipIf(HAY_BASE)('002 · Seed de demostración', () => {
  it.skip(`omitido — ${MOTIVO_OMISION}`, () => {});
});
