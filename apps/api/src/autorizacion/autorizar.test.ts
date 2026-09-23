/**
 * `autorizar()` de punta a punta contra PostgreSQL 16 real (CA-19, CA-20, CA-21; ADR-022, ADR-028).
 *
 * Qué se demuestra y cómo:
 * - Los usuarios son filas válidas de `acceso.Usuario`, creadas con los mismos constructores
 *   que usan los tests de esquema de T-03 (`prisma/tests/ayuda/datos-acceso.ts`). Las claves
 *   foráneas `sujeto` y `titularAfectado` de la bitácora se cumplen de verdad; ningún error
 *   se captura ni se tolera.
 * - El evento se lee **de la base**, por SQL directo con `pg` (otra conexión, otro cliente que
 *   el que escribió), y se compara `titularAfectado` contra el id esperado.
 * - Los resolvedores de alcance son dobles, pero **deciden**: miran una tabla de casos
 *   (titular y abogado asignado) y devuelven ES_TITULAR / ESTA_ASIGNADO / SIN_RELACION según
 *   quién pregunte. El mismo resolvedor produce titulares distintos para sujetos distintos.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient, Permiso as PermisoPrisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { crearBaseConMigraciones, type BaseDePrueba, HAY_BASE } from '../../prisma/tests/ayuda/base-de-prueba.js';
import {
  crearAbogadoConPerfil,
  crearAdministrador,
  crearCuentaActiva,
} from '../../prisma/tests/ayuda/datos-acceso.js';
import { autorizar } from './autorizar';
import { convertirPermisoAlPrismaEnum } from '../auditoria/permiso-en-base';
import { registroDeRecursos, validarRegistroDeRecursosAlArrancar } from './registro';
import type {
  ContextoDeAcceso,
  IdRecurso,
  IdSesion,
  IdUsuario,
  Instante,
  NivelAutenticacion,
  Permiso,
  TipoRecurso,
} from '@mejorar/shared/identidad/contrato/v1';
import type { AlcanceResuelto, ResolvedorDeAlcance } from './tipos';

/**
 * Los 25 permisos del contrato. `Record<Permiso, true>` hace que el compilador exija la lista
 * completa y rechace uno inventado: si el contrato agrega un permiso, este archivo no compila
 * hasta que se lo agregue acá, y el test de correspondencia lo prueba contra la base.
 */
const PERMISOS_DEL_CONTRATO: Record<Permiso, true> = {
  'perfil.leer.propio': true,
  'perfil.editar.propio': true,
  'perfil.exportar.propio': true,
  'perfil.declararEspecialidades.propio': true,
  'contrasena.cambiar.propia': true,
  'mfa.inscribir.propio': true,
  'mfa.desactivar.propio': true,
  'mfa.regenerarCodigosDeRespaldo.propio': true,
  'sesion.listar.propia': true,
  'sesion.cerrar.propia': true,
  'auditoria.leer.propia': true,
  'auditoria.leer.total': true,
  'usuario.listar': true,
  'usuario.leer': true,
  'usuario.crearAdministrador': true,
  'usuario.suspender': true,
  'matricula.leer': true,
  'matricula.verificar': true,
  'matricula.suspender': true,
  'restitucionMfa.solicitar.propia': true,
  'restitucionMfa.instruir': true,
  'restitucionMfa.aprobar': true,
  'caso.leer.asignado': true,
  'caso.actuar.asignado': true,
  'caso.recibirAsignacion': true,
};
const TODOS_LOS_PERMISOS = Object.keys(PERMISOS_DEL_CONTRATO) as Permiso[];

interface FilaEvento {
  id: string;
  accion: string;
  sujeto: string | null;
  titularAfectado: string | null;
  tipoRecurso: string | null;
  idRecurso: string | null;
  clasificacion: string;
  permisoEvaluado: string | null;
  resultado: string;
  motivo: string | null;
}

describe.skipIf(!HAY_BASE)('autorizar() contra PostgreSQL real', () => {
  let prisma: PrismaClient;
  let base: BaseDePrueba;

  let idCliente: IdUsuario;
  let idOtroCliente: IdUsuario;
  let idAbogado: IdUsuario;
  let idAdministrador: IdUsuario;

  /** Caso del cliente, asignado al abogado. */
  let idCasoAsignado: IdRecurso<'CASO'>;
  /** Caso de otro cliente, que el abogado NO tiene asignado. */
  let idCasoAjeno: IdRecurso<'CASO'>;

  /** Registro de llamadas a los resolvedores, para verificar qué recibieron. */
  const llamadas: Array<{ tipo: TipoRecurso; sujeto: IdUsuario; idRecurso: string }> = [];

  /** Resolvedor de CASO: decide por la tabla de casos, no devuelve una constante. */
  function resolvedorDeCaso(
    casos: ReadonlyMap<string, { titular: IdUsuario; asignado: IdUsuario | null }>,
  ): ResolvedorDeAlcance {
    return {
      tipo: 'CASO',
      async resolver(sujeto, idRecurso, momento): Promise<AlcanceResuelto> {
        llamadas.push({ tipo: 'CASO', sujeto, idRecurso: idRecurso as string });
        const caso = casos.get(idRecurso as string);
        if (!caso) return { clase: 'SIN_RELACION' };
        if (caso.titular === sujeto) return { clase: 'ES_TITULAR', titularRecurso: caso.titular };
        if (caso.asignado === sujeto) {
          return { clase: 'ESTA_ASIGNADO', desde: momento, titularRecurso: caso.titular };
        }
        return { clase: 'SIN_RELACION', titularRecurso: caso.titular };
      },
    };
  }

  /** Resolvedor de USUARIO/PERFIL: el recurso es la persona misma; el administrador tiene alcance global. */
  function resolvedorDePersona(tipo: 'USUARIO' | 'PERFIL', administradores: ReadonlySet<string>): ResolvedorDeAlcance {
    return {
      tipo,
      async resolver(sujeto, idRecurso): Promise<AlcanceResuelto> {
        llamadas.push({ tipo, sujeto, idRecurso: idRecurso as string });
        const titular = idRecurso as unknown as IdUsuario;
        if (sujeto === titular) return { clase: 'ES_TITULAR', titularRecurso: titular };
        if (administradores.has(sujeto)) return { clase: 'ALCANCE_GLOBAL', titularRecurso: titular };
        return { clase: 'SIN_RELACION', titularRecurso: titular };
      },
    };
  }

  function contextoDe(
    sujeto: IdUsuario,
    permisos: Permiso[],
    nivelAutenticacion: NivelAutenticacion = 'CONTRASENA',
  ): ContextoDeAcceso {
    return {
      sujeto,
      sesion: `ses_${randomUUID()}` as IdSesion,
      permisos: new Set(permisos),
      nivelAutenticacion,
      autenticadoEn: new Date().toISOString() as Instante,
      idCorrelacion: `corr_${randomUUID()}`,
    };
  }

  /** Lee de la base, por SQL directo, todos los eventos de una correlación. */
  async function eventosDe(idCorrelacion: string): Promise<FilaEvento[]> {
    const { rows } = await base.cliente.query<FilaEvento>(
      `SELECT "id", "accion"::text, "sujeto", "titularAfectado", "tipoRecurso"::text, "idRecurso",
              "clasificacion"::text, "permisoEvaluado"::text, "resultado"::text, "motivo"::text
         FROM auditoria."EventoAuditoria"
        WHERE "idCorrelacion" = $1`,
      [idCorrelacion],
    );
    return rows;
  }

  beforeAll(async () => {
    validarRegistroDeRecursosAlArrancar();

    base = await crearBaseConMigraciones('autorizar');
    const url = new URL(process.env.DATABASE_URL_TEST!);
    url.pathname = `/${base.nombreBase}`;
    prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    await prisma.$connect();

    // Usuarios reales y válidos: cuenta ACTIVA con aceptaciones, abogado con perfil
    // profesional, administrador con designación. Van en una transacción que se
    // CONFIRMA (a diferencia de `enTransaccionRevertida` de los tests de esquema): las
    // restricciones diferidas de R-002-03 se evalúan al COMMIT, y las filas tienen que
    // quedar visibles para la conexión de Prisma. Si algo no cierra, el COMMIT falla,
    // el beforeAll falla y la suite entera falla: no hay rama que lo tolere.
    await base.cliente.query('BEGIN');
    idCliente = (await crearCuentaActiva(base.cliente)) as IdUsuario;
    idOtroCliente = (await crearCuentaActiva(base.cliente)) as IdUsuario;
    idAbogado = (await crearAbogadoConPerfil(base.cliente)).usuarioId as IdUsuario;
    idAdministrador = (await crearAdministrador(base.cliente)) as IdUsuario;
    await base.cliente.query('COMMIT');

    // Comprobación de que las filas existen de verdad y con el rol esperado.
    const { rows } = await base.cliente.query<{ id: string; rol: string; estadoCuenta: string }>(
      `SELECT "id", "rol"::text, "estadoCuenta"::text FROM acceso."Usuario" WHERE "id" = ANY($1)`,
      [[idCliente, idOtroCliente, idAbogado, idAdministrador]],
    );
    const porId = new Map(rows.map((r) => [r.id, r]));
    expect(porId.get(idCliente)).toMatchObject({ rol: 'CLIENTE', estadoCuenta: 'ACTIVA' });
    expect(porId.get(idOtroCliente)).toMatchObject({ rol: 'CLIENTE', estadoCuenta: 'ACTIVA' });
    expect(porId.get(idAbogado)).toMatchObject({ rol: 'ABOGADO', estadoCuenta: 'ACTIVA' });
    expect(porId.get(idAdministrador)).toMatchObject({ rol: 'ADMINISTRADOR', estadoCuenta: 'ACTIVA' });

    idCasoAsignado = `caso_${randomUUID()}` as IdRecurso<'CASO'>;
    idCasoAjeno = `caso_${randomUUID()}` as IdRecurso<'CASO'>;
  });

  beforeEach(() => {
    // Los tests que necesitan otro comportamiento pisan el resolvedor de su tipo; acá se
    // restablecen los de base para que ninguno herede el doble de otro.
    llamadas.length = 0;
    registrarResolvedoresDeBase();
  });

  function registrarResolvedoresDeBase(): void {
    const casos = new Map([
      [idCasoAsignado as string, { titular: idCliente, asignado: idAbogado }],
      [idCasoAjeno as string, { titular: idOtroCliente, asignado: null }],
    ]);
    const administradores = new Set<string>([idAdministrador]);
    registroDeRecursos.registrarResolvedor(resolvedorDeCaso(casos));
    registroDeRecursos.registrarResolvedor(resolvedorDePersona('USUARIO', administradores));
    registroDeRecursos.registrarResolvedor(resolvedorDePersona('PERFIL', administradores));
  }

  afterAll(async () => {
    await prisma?.$disconnect();
    await base?.destruir();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CA-21: titularAfectado es el dueño del dato, no quien actúa
  // ───────────────────────────────────────────────────────────────────────────

  it('CA-21, ESTA_ASIGNADO: el abogado lee el caso del cliente y el evento registra titularAfectado = cliente', async () => {
    const contexto = contextoDe(idAbogado, ['caso.leer.asignado']);

    const resultado = await autorizar(
      { permiso: 'caso.leer.asignado', tipo: 'CASO', id: idCasoAsignado },
      contexto,
      prisma,
      new Date().toISOString() as Instante,
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('inalcanzable: el expect anterior ya falló');
    expect(llamadas).toEqual([{ tipo: 'CASO', sujeto: idAbogado, idRecurso: idCasoAsignado }]);

    const eventos = await eventosDe(contexto.idCorrelacion);
    expect(eventos).toHaveLength(1);
    const evento = eventos[0]!;
    expect(evento.id).toBe(resultado.autorizacion.evento);

    expect(evento.titularAfectado).toBe(idCliente);
    expect(evento.titularAfectado).not.toBe(idAbogado);
    expect(evento.sujeto).toBe(idAbogado);

    expect(evento.accion).toBe('RECURSO_LEIDO');
    expect(evento.resultado).toBe('PERMITIDO');
    expect(evento.clasificacion).toBe('PATRIMONIAL_SENSIBLE');
    expect(evento.tipoRecurso).toBe('CASO');
    expect(evento.idRecurso).toBe(idCasoAsignado);
    expect(evento.permisoEvaluado).toBe('caso.leer.asignado');
    expect(evento.motivo).toBeNull();
  });

  it('CA-21, ES_TITULAR: el cliente lee su propio perfil y el evento registra titularAfectado = el mismo cliente', async () => {
    const contexto = contextoDe(idCliente, ['perfil.leer.propio']);

    const resultado = await autorizar(
      { permiso: 'perfil.leer.propio', tipo: 'PERFIL', id: idCliente as unknown as IdRecurso<'PERFIL'> },
      contexto,
      prisma,
      new Date().toISOString() as Instante,
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('inalcanzable');

    const eventos = await eventosDe(contexto.idCorrelacion);
    expect(eventos).toHaveLength(1);
    const evento = eventos[0]!;
    expect(evento.id).toBe(resultado.autorizacion.evento);
    expect(evento.titularAfectado).toBe(idCliente);
    expect(evento.sujeto).toBe(idCliente);
    expect(evento.clasificacion).toBe('PERSONAL');
    expect(evento.permisoEvaluado).toBe('perfil.leer.propio');
  });

  it('CA-21, ALCANCE_GLOBAL: el administrador lee el usuario X y el evento registra titularAfectado = X', async () => {
    const contexto = contextoDe(idAdministrador, ['usuario.leer'], 'CONTRASENA_Y_SEGUNDO_FACTOR');

    const resultado = await autorizar(
      { permiso: 'usuario.leer', tipo: 'USUARIO', id: idOtroCliente as unknown as IdRecurso<'USUARIO'> },
      contexto,
      prisma,
      new Date().toISOString() as Instante,
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('inalcanzable');

    const eventos = await eventosDe(contexto.idCorrelacion);
    expect(eventos).toHaveLength(1);
    const evento = eventos[0]!;
    expect(evento.id).toBe(resultado.autorizacion.evento);
    expect(evento.titularAfectado).toBe(idOtroCliente);
    expect(evento.sujeto).toBe(idAdministrador);
    expect(evento.permisoEvaluado).toBe('usuario.leer');
  });

  it('CA-21, ALCANCE_GLOBAL sin titular informado: titularAfectado queda NULL y no se rellena con el sujeto', async () => {
    registroDeRecursos.registrarResolvedor({
      tipo: 'USUARIO',
      resolver: async () => ({ clase: 'ALCANCE_GLOBAL' }),
    });
    const contexto = contextoDe(idAdministrador, ['usuario.leer'], 'CONTRASENA_Y_SEGUNDO_FACTOR');

    const resultado = await autorizar(
      { permiso: 'usuario.leer', tipo: 'USUARIO', id: `usr_${randomUUID()}` as IdRecurso<'USUARIO'> },
      contexto,
      prisma,
      new Date().toISOString() as Instante,
    );

    expect(resultado.ok).toBe(true);
    const eventos = await eventosDe(contexto.idCorrelacion);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.titularAfectado).toBeNull();
    expect(eventos[0]!.sujeto).toBe(idAdministrador);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CA-19 / CA-20: la denegación también se audita, con el titular correcto
  // ───────────────────────────────────────────────────────────────────────────

  it('CA-19/CA-20/CA-21, SIN_RELACION: el abogado intenta un caso no asignado, se deniega y el evento registra al titular del caso', async () => {
    const contexto = contextoDe(idAbogado, ['caso.leer.asignado']);

    const resultado = await autorizar(
      { permiso: 'caso.leer.asignado', tipo: 'CASO', id: idCasoAjeno },
      contexto,
      prisma,
      new Date().toISOString() as Instante,
    );

    expect(resultado).toEqual({
      ok: false,
      error: { clase: 'AUTORIZACION_DENEGADA', motivo: 'FUERA_DE_ALCANCE' },
    });

    const eventos = await eventosDe(contexto.idCorrelacion);
    expect(eventos).toHaveLength(1);
    const evento = eventos[0]!;
    expect(evento.accion).toBe('ACCESO_DENEGADO');
    expect(evento.resultado).toBe('DENEGADO');
    expect(evento.motivo).toBe('FUERA_DE_ALCANCE');
    expect(evento.titularAfectado).toBe(idOtroCliente);
    expect(evento.sujeto).toBe(idAbogado);
    expect(evento.idRecurso).toBe(idCasoAjeno);
  });

  it('CA-20: un cliente sin el permiso no accede al perfil de otro; la denegación queda con titularAfectado = el otro', async () => {
    const contexto = contextoDe(idCliente, ['perfil.leer.propio']);

    const resultado = await autorizar(
      { permiso: 'usuario.leer', tipo: 'USUARIO', id: idOtroCliente as unknown as IdRecurso<'USUARIO'> },
      contexto,
      prisma,
      new Date().toISOString() as Instante,
    );

    expect(resultado).toEqual({
      ok: false,
      error: { clase: 'AUTORIZACION_DENEGADA', motivo: 'PERMISO_AUSENTE' },
    });
    const eventos = await eventosDe(contexto.idCorrelacion);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.motivo).toBe('PERMISO_AUSENTE');
    expect(eventos[0]!.titularAfectado).toBe(idOtroCliente);
    expect(eventos[0]!.sujeto).toBe(idCliente);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Fallo cerrado (ADR-022, ADR-028 §2)
  // ───────────────────────────────────────────────────────────────────────────

  it('ADR-028 §2: si el evento no se puede escribir (titular inexistente, viola la FK), autorizar falla y no entrega la prueba', async () => {
    const titularInexistente = `usr_${randomUUID()}` as IdUsuario;
    registroDeRecursos.registrarResolvedor({
      tipo: 'CASO',
      resolver: async (_sujeto, _id, momento) => ({
        clase: 'ESTA_ASIGNADO',
        desde: momento,
        titularRecurso: titularInexistente,
      }),
    });
    const contexto = contextoDe(idAbogado, ['caso.leer.asignado']);

    await expect(
      autorizar(
        { permiso: 'caso.leer.asignado', tipo: 'CASO', id: `caso_${randomUUID()}` as IdRecurso<'CASO'> },
        contexto,
        prisma,
        new Date().toISOString() as Instante,
      ),
    ).rejects.toThrow(/No se pudo auditar acceso a CASO/);

    expect(await eventosDe(contexto.idCorrelacion)).toHaveLength(0);
  });

  it('ADR-022: un tipo sin resolvedor de alcance registrado falla cerrado, sin suponer alcance global', async () => {
    // SESION no tiene resolvedor en este archivo (los módulos se aíslan por archivo en Vitest).
    expect(registroDeRecursos.obtenerResolvedor('SESION')).toBeNull();
    const contexto = contextoDe(idCliente, ['sesion.listar.propia']);

    const resultado = await autorizar(
      { permiso: 'sesion.listar.propia', tipo: 'SESION', id: `ses_${randomUUID()}` as IdRecurso<'SESION'> },
      contexto,
      prisma,
      new Date().toISOString() as Instante,
    );

    expect(resultado.ok).toBe(false);
    if (resultado.ok) throw new Error('inalcanzable');
    expect(resultado.error.clase).toBe('ERROR_INTERNO');
    expect(await eventosDe(contexto.idCorrelacion)).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Correspondencia permiso del contrato ↔ enum de Prisma ↔ valor en la base
  // ───────────────────────────────────────────────────────────────────────────

  it('la conversión de permisos es una biyección entre los 25 del contrato y los del enum de Prisma', () => {
    const nombresPrisma = Object.values(PermisoPrisma) as string[];
    const convertidos = TODOS_LOS_PERMISOS.map(convertirPermisoAlPrismaEnum);

    expect(TODOS_LOS_PERMISOS).toHaveLength(25);
    expect(new Set(convertidos).size).toBe(TODOS_LOS_PERMISOS.length); // inyectiva
    expect([...convertidos].sort()).toEqual([...nombresPrisma].sort()); // mismos elementos, en los dos sentidos
  });

  it('cada permiso convertido se guarda en la base con el literal exacto del contrato (@map)', async () => {
    const idCorrelacion = `corr_${randomUUID()}`;
    for (const permiso of TODOS_LOS_PERMISOS) {
      await prisma.eventoAuditoria.create({
        data: {
          id: `evt_${randomUUID()}`,
          accion: 'RECURSO_LEIDO',
          clasificacion: 'INTERNO',
          permisoEvaluado: convertirPermisoAlPrismaEnum(permiso),
          resultado: 'PERMITIDO',
          origenCanal: 'API',
          idCorrelacion,
        },
      });
    }

    const guardados = (await eventosDe(idCorrelacion)).map((e) => e.permisoEvaluado);
    expect([...guardados].sort()).toEqual([...TODOS_LOS_PERMISOS].sort());
  });
});
