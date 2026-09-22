/**
 * Feature 002, §4 y §7.4: clasificación de sensibilidad, minimización,
 * privilegios de columna y aislamiento multi-perfil.
 *
 * Es el archivo que hace exigibles la regla 5 y la regla 7 del mandato del
 * `database-engineer`. Las tres defensas de §4.2 se verifican acá, y el
 * aislamiento se prueba **cambiando de rol de verdad** con `SET ROLE`: una
 * política de fila que nadie ejerció es una declaración, no una garantía.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  BaseDePrueba,
  crearBaseConMigraciones,
  HAY_BASE,
  MOTIVO_OMISION,
} from './ayuda/base-de-prueba.js';
import { crearCuentaActiva, registrarEvento } from './ayuda/datos-acceso.js';

/** Prefijos admitidos. `PERS↑` es `PERS` con tratamiento de `PATR` (§0.6). */
const PATRON_CLASIFICACION = /^(PUB|INT|PERS|PATR)\b/;

/**
 * `ClaveProhibidaPorMinimizacion` adaptada a esta feature: la lista de §4.2
 * punto 1, que es la que corresponde a `acceso` y `auditoria`. No incluye
 * `correo` ni `nombre` ni `cuit` como prohibidos —la 002 sí trata esos datos—:
 * lo que se verifica sobre ellos es que NO estén en claro (punto 3).
 */
const CLAVES_PROHIBIDAS = [
  'domicilio', 'direccion', 'calle', 'localidad', 'codigoPostal', 'barrio',
  'telefono', 'celular', 'fechaNacimiento', 'edad', 'nacionalidad', 'genero',
  'estadoCivil', 'cbu', 'numeroTarjeta', 'ultimosDigitos', 'numeroCuenta',
  'ingreso', 'salario', 'dni', 'numeroDocumento', 'tipoDocumento',
  'agenteDeUsuario', 'userAgent', 'foto', 'legajo', 'empleador',
].map((c) => c.toLowerCase());

describe.skipIf(!HAY_BASE)('002 · Clasificación, minimización y aislamiento', () => {
  let base: BaseDePrueba;
  let cliente: Client;

  beforeAll(async () => {
    base = await crearBaseConMigraciones('a002cls');
    cliente = base.cliente;
  });

  afterAll(async () => {
    await base?.destruir();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // §4.1 — regla 5 del mandato: cada campo, su clasificación
  // ───────────────────────────────────────────────────────────────────────────

  it('§4.1 · toda columna de `acceso` y `auditoria` está clasificada', async () => {
    const { rows } = await cliente.query<{ f: string; comentario: string | null }>(
      `SELECT n.nspname || '.' || c.relname || '.' || a.attname AS f,
              col_description(a.attrelid, a.attnum) AS comentario
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname IN ('acceso', 'auditoria')
          AND c.relkind IN ('r', 'p')
          -- Las particiones heredan el comentario del padre; se clasifica el padre.
          AND NOT EXISTS (SELECT 1 FROM pg_inherits i WHERE i.inhrelid = c.oid)
          AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY 1`,
    );
    expect(rows.length).toBeGreaterThan(100);
    const sinClasificar = rows
      .filter((r) => r.comentario === null || !PATRON_CLASIFICACION.test(r.comentario.trim()))
      .map((r) => r.f);
    expect(
      sinClasificar,
      'columnas sin clasificación de sensibilidad (regla 5 del mandato, modelo-datos §4.1)',
    ).toEqual([]);
  });

  it('§4.1 · toda tabla documenta su propósito y su retención', async () => {
    const { rows } = await cliente.query<{ tabla: string; comentario: string | null }>(
      `SELECT n.nspname || '.' || c.relname AS tabla, obj_description(c.oid) AS comentario
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname IN ('acceso', 'auditoria') AND c.relkind IN ('r', 'p')
          AND NOT EXISTS (SELECT 1 FROM pg_inherits i WHERE i.inhrelid = c.oid)
        ORDER BY 1`,
    );
    const sinComentario = rows.filter((r) => !r.comentario?.trim()).map((r) => r.tabla);
    expect(sinComentario).toEqual([]);
    const sinRetencion = rows
      .filter((r) => !/retenci[óo]n/i.test(r.comentario ?? ''))
      .map((r) => r.tabla);
    expect(sinRetencion, 'cada entidad, su plazo (§5.1)').toEqual([]);
  });

  it('§0.6 · en esta feature no hay ni un campo PATRIMONIAL SENSIBLE, y es contraintuitivo', async () => {
    // La 002 no guarda ni un peso, ni una deuda, ni un informe crediticio. Lo
    // que sí tiene es una franja de campos PERS cuya sensibilidad POR CONTEXTO
    // es más alta de lo que la etiqueta sugiere: saber que Fulano tiene cuenta
    // acá es una inferencia patrimonial sobre Fulano. Esos llevan tratamiento
    // de PATR y se marcan `PERS↑`. La etiqueta no se infla: se infla el
    // tratamiento, que es lo que protege.
    const { rows } = await cliente.query<{ f: string }>(
      `SELECT c.relname || '.' || a.attname AS f
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname IN ('acceso', 'auditoria') AND c.relkind IN ('r', 'p')
          AND a.attnum > 0 AND NOT a.attisdropped
          AND col_description(a.attrelid, a.attnum) LIKE 'PATR%'`,
    );
    expect(rows.map((r) => r.f)).toEqual([]);
  });

  it('§0.6 · y los campos `PERS↑` son exactamente los que van cifrados en reposo', async () => {
    const { rows } = await cliente.query<{ f: string; tipo: string }>(
      `SELECT c.relname || '.' || a.attname AS f, format_type(a.atttypid, NULL) AS tipo
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'acceso' AND c.relkind = 'r'
          AND a.attnum > 0 AND NOT a.attisdropped
          AND col_description(a.attrelid, a.attnum) LIKE 'PERS↑%'
        ORDER BY 1`,
    );
    expect(rows.map((r) => r.f)).toEqual([
      'AceptacionRegistrada.ipCifrada',
      'DesignacionDeAdministrador.nombreCompletoCifrado',
      'SecretoTotp.secretoCifrado',
      'Usuario.correoCifrado',
      'Usuario.nombreParaMostrarCifrado',
    ]);
    // Cifrado en reposo significa `bytea`: si alguno fuera `text`, alguien
    // "desanduvo" D-4 por comodidad.
    expect(rows.every((r) => r.tipo === 'bytea')).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // §4.2 — las tres defensas de minimización
  // ───────────────────────────────────────────────────────────────────────────

  it('§4.2 (1) · ninguna columna se llama como un dato que esta feature no necesita', async () => {
    const { rows } = await cliente.query<{ tabla: string; columna: string }>(
      `SELECT table_name AS tabla, column_name AS columna
         FROM information_schema.columns
        WHERE table_schema IN ('acceso', 'auditoria') ORDER BY 1, 2`,
    );
    const infractoras = rows
      .filter((r) => CLAVES_PROHIBIDAS.includes(r.columna.toLowerCase()))
      .map((r) => `${r.tabla}.${r.columna}`);
    expect(
      infractoras,
      'la 002 no recolecta domicilio, teléfono, fecha de nacimiento, DNI ni datos bancarios',
    ).toEqual([]);
  });

  it('§4.2 (3) · ni el correo, ni el nombre, ni el CUIT están en claro', async () => {
    // Si alguien "desanda" D-4 por comodidad, el pipeline lo frena acá.
    const { rows } = await cliente.query<{ f: string }>(
      `SELECT table_name || '.' || column_name AS f
         FROM information_schema.columns
        WHERE table_schema = 'acceso'
          AND data_type IN ('text', 'character varying')
          -- Las columnas que terminan en IdClave son el identificador de la
          -- clave de cifrado, no el dato: son INT y tienen que ser legibles
          -- para poder rotar (§4.3).
          AND column_name NOT ILIKE '%IdClave'
          AND (column_name ILIKE '%correo%' OR column_name ILIKE '%email%'
            OR column_name ILIKE '%cuit%' OR column_name ILIKE '%cuil%'
            OR column_name ILIKE '%nombre%')
        ORDER BY 1`,
    );
    expect(rows.map((r) => r.f)).toEqual([]);
  });

  it('§4.2 (3) · el único nombre de persona legible está cifrado, y el índice ciego no es reversible', async () => {
    const { rows } = await cliente.query<{ f: string; tipo: string }>(
      `SELECT table_name || '.' || column_name AS f, data_type AS tipo
         FROM information_schema.columns
        WHERE table_schema = 'acceso' AND column_name ILIKE '%indiceCiego%' ORDER BY 1`,
    );
    // Los índices ciegos son HMAC y por eso son `bytea`: lo único indexable, y
    // no reversible sin `k_indice`, que vive fuera de la base (§4.3).
    expect(rows.map((r) => r.f)).toEqual([
      'CorreoDeRolProhibido.indiceCiego',
      'Usuario.indiceCiegoCorreo',
    ]);
    expect(rows.every((r) => r.tipo === 'bytea')).toBe(true);
  });

  it('§3 · no hay índice sobre el nombre para mostrar ni sobre la IP de la sesión', async () => {
    // Índices descartados por no tener consulta (regla 8 del mandato). El de
    // `ipHash` además facilitaría justo la correlación masiva que la
    // minimización desalienta.
    const { rows } = await cliente.query<{ indice: string }>(
      `SELECT indexname AS indice FROM pg_indexes
        WHERE schemaname = 'acceso'
          AND (indexdef ILIKE '%nombreParaMostrar%' OR indexdef ILIKE '%ipHash%')
        ORDER BY 1`,
    );
    expect(rows.map((r) => r.indice)).toEqual([]);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // §4.4 — lo que no se exporta
  // ───────────────────────────────────────────────────────────────────────────

  it('§4.4 · ningún rol salvo `rol_acceso` puede leer las columnas secretas', async () => {
    const { rows } = await cliente.query<{ rol: string; tabla: string; columna: string }>(
      `SELECT g.grantee AS rol, g.table_name AS tabla, g.column_name AS columna
         FROM information_schema.column_privileges g
        WHERE g.table_schema = 'acceso'
          AND g.privilege_type = 'SELECT'
          AND g.grantee IN ('rol_cliente', 'rol_abogado', 'rol_admin', 'rol_auditoria')
          AND acceso.es_columna_secreta(g.table_name::text, g.column_name::text)
        ORDER BY 1, 2, 3`,
    );
    expect(
      rows.map((r) => `${r.rol}:${r.tabla}.${r.columna}`),
      'una exportación mal diseñada es una fuga con forma de derecho; tiene que fallar en dos capas',
    ).toEqual([]);
  });

  it('§4.4 · y `rol_acceso` sí las lee: es el único que las necesita', async () => {
    const { rows } = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM information_schema.table_privileges
        WHERE table_schema = 'acceso' AND table_name = 'Usuario'
          AND grantee = 'rol_acceso' AND privilege_type = 'SELECT'`,
    );
    expect(rows[0]!.n).toBe('1');
  });

  it('§4.4 · el inventario de columnas secretas cubre las cinco que el documento nombra', async () => {
    const { rows } = await cliente.query<{ f: string }>(
      `SELECT c.relname || '.' || a.attname AS f
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'acceso' AND c.relkind = 'r'
          AND a.attnum > 0 AND NOT a.attisdropped
          AND acceso.es_columna_secreta(c.relname::text, a.attname::text)
        ORDER BY 1`,
    );
    expect(rows.map((r) => r.f)).toEqual([
      'CodigoDeRespaldo.hashDelCodigo',
      'EnlaceDeUnSoloUso.hashDelSecreto',
      'SecretoTotp.secretoCifrado',
      'SecretoTotp.secretoNonce',
      'SecretoTotp.secretoTag',
      'TokenDeRefresco.hashDelSecreto',
      'Usuario.hashContrasena',
    ]);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // §7.4 — aislamiento multi-perfil, ejercido de verdad
  // ───────────────────────────────────────────────────────────────────────────

  it('§7.4 · RLS está habilitada Y FORZADA en las tablas del titular', async () => {
    const { rows } = await cliente.query<{ tabla: string; habilitada: boolean; forzada: boolean }>(
      `SELECT c.relname AS tabla, c.relrowsecurity AS habilitada, c.relforcerowsecurity AS forzada
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'acceso' AND c.relkind = 'r' AND c.relrowsecurity
        ORDER BY 1`,
    );
    expect(rows.length).toBe(16);
    expect(rows.every((r) => r.forzada)).toBe(true);
    // `FORCE` es lo que impide que el DUEÑO de la tabla se saltee las
    // políticas. Sin él, RLS es una decoración para cualquiera que administre
    // la base.
    const { rows: bitacora } = await cliente.query<{ habilitada: boolean; forzada: boolean }>(
      `SELECT relrowsecurity AS habilitada, relforcerowsecurity AS forzada
         FROM pg_class WHERE oid = 'auditoria."EventoAuditoria"'::regclass`,
    );
    expect(bitacora[0]).toEqual({ habilitada: true, forzada: true });
  });

  it('§7.4 · un cliente sólo alcanza sus propias filas, y se comprueba cambiando de rol', async () => {
    const ana = await crearCuentaActiva(cliente);
    const beto = await crearCuentaActiva(cliente);

    await cliente.query('BEGIN');
    try {
      await cliente.query(`SET LOCAL ROLE rol_cliente`);
      await cliente.query(`SELECT set_config('app.id_usuario', $1, true)`, [ana]);

      const { rows } = await cliente.query<{ id: string }>(
        `SELECT "id" FROM acceso."Usuario" ORDER BY 1`,
      );
      expect(rows.map((r) => r.id)).toEqual([ana]);
      expect(rows.map((r) => r.id)).not.toContain(beto);
    } finally {
      await cliente.query('ROLLBACK');
    }
  });

  it('§7.4 · sin `app.id_usuario` fijada, el cliente no ve NADA: negar es el modo por defecto', async () => {
    await crearCuentaActiva(cliente);
    await cliente.query('BEGIN');
    try {
      await cliente.query(`SET LOCAL ROLE rol_cliente`);
      const { rows } = await cliente.query(`SELECT "id" FROM acceso."Usuario"`);
      expect(rows).toEqual([]);
    } finally {
      await cliente.query('ROLLBACK');
    }
  });

  it('§7.4 · un cliente no puede ni mirar la tabla de designaciones de administrador', async () => {
    await cliente.query('BEGIN');
    try {
      await cliente.query(`SET LOCAL ROLE rol_cliente`);
      await expect(
        cliente.query(`SELECT * FROM acceso."DesignacionDeAdministrador"`),
      ).rejects.toMatchObject({ code: '42501' });
    } finally {
      await cliente.query('ROLLBACK');
    }
  });

  it('§7.4 · ni el perfil profesional de nadie: no es asunto suyo', async () => {
    await cliente.query('BEGIN');
    try {
      await cliente.query(`SET LOCAL ROLE rol_cliente`);
      await expect(
        cliente.query(`SELECT * FROM acceso."PerfilProfesional"`),
      ).rejects.toMatchObject({ code: '42501' });
    } finally {
      await cliente.query('ROLLBACK');
    }
  });

  it('§4.4 · un administrador gestiona cuentas pero no lee credenciales', async () => {
    await cliente.query('BEGIN');
    try {
      await cliente.query(`SET LOCAL ROLE rol_admin`);
      // Los metadatos, sí.
      await expect(
        cliente.query(`SELECT "id", "rol", "estadoCuenta" FROM acceso."Usuario"`),
      ).resolves.toBeTruthy();
      // El hash de la contraseña, no. Cada intento va en su punto de guardado:
      // un error aborta la transacción y el siguiente caso no se ejecutaría.
      await cliente.query('SAVEPOINT p1');
      await expect(
        cliente.query(`SELECT "hashContrasena" FROM acceso."Usuario"`),
      ).rejects.toMatchObject({ code: '42501' });
      await cliente.query('ROLLBACK TO SAVEPOINT p1');

      await cliente.query('SAVEPOINT p2');
      await expect(
        cliente.query(`SELECT "secretoCifrado" FROM acceso."SecretoTotp"`),
      ).rejects.toMatchObject({ code: '42501' });
      await cliente.query('ROLLBACK TO SAVEPOINT p2');
    } finally {
      await cliente.query('ROLLBACK');
    }
  });

  it('CA-21 · "¿quién miró mi información?" devuelve lo propio y nada más', async () => {
    const ana = await crearCuentaActiva(cliente);
    const beto = await crearCuentaActiva(cliente);
    await registrarEvento(cliente, {
      accion: 'RECURSO_LEIDO', sujeto: beto, titularAfectado: ana, clasificacion: 'PERSONAL',
    });
    await registrarEvento(cliente, {
      accion: 'RECURSO_LEIDO', sujeto: beto, titularAfectado: beto, clasificacion: 'PERSONAL',
    });

    await cliente.query('BEGIN');
    try {
      await cliente.query(`SET LOCAL ROLE rol_cliente`);
      await cliente.query(`SELECT set_config('app.id_usuario', $1, true)`, [ana]);
      const { rows } = await cliente.query<{ titular: string; sujeto: string }>(
        `SELECT "titularAfectado" AS titular, "sujeto" FROM auditoria."EventoAuditoria"`,
      );
      // Ana ve el evento en el que ella es la titular afectada —quién miró sus
      // datos— y ninguno de los de Beto sobre Beto.
      expect(rows).toEqual([{ titular: ana, sujeto: beto }]);
    } finally {
      await cliente.query('ROLLBACK');
    }
  });

  it('R-002-12 · ni siquiera `rol_auditoria` tiene privilegio para modificar la bitácora', async () => {
    const { rows } = await cliente.query<{ rol: string; privilegio: string }>(
      `SELECT grantee AS rol, privilege_type AS privilegio
         FROM information_schema.table_privileges
        WHERE table_schema = 'auditoria' AND table_name = 'EventoAuditoria'
          AND privilege_type IN ('UPDATE', 'DELETE', 'TRUNCATE')
          AND grantee <> 'mejorar'
        ORDER BY 1, 2`,
    );
    expect(rows.map((r) => `${r.rol}:${r.privilegio}`)).toEqual([]);
  });

  it('D-1 · la feature no metió una sola tabla en `motor`, ni tocó `identidad`', async () => {
    const { rows } = await cliente.query<{ tabla: string }>(
      `SELECT tablename AS tabla FROM pg_tables WHERE schemaname = 'motor' ORDER BY 1`,
    );
    // Las mismas ocho del Bloque A de la 004, ni una más.
    expect(rows).toHaveLength(8);

    const { rows: identidad } = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'identidad' AND c.relkind IN ('r', 'p', 'v', 'm')`,
    );
    expect(identidad[0]!.n).toBe('0');
  });

  it('D-1 · y `rol_acceso` no tiene ningún privilegio sobre el esquema `identidad`', async () => {
    const { rows } = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM information_schema.table_privileges
        WHERE table_schema = 'identidad' AND grantee = 'rol_acceso'`,
    );
    expect(rows[0]!.n).toBe('0');
    const { rows: uso } = await cliente.query<{ tiene: boolean }>(
      `SELECT has_schema_privilege('rol_acceso', 'identidad', 'USAGE') AS tiene`,
    );
    expect(uso[0]!.tiene).toBe(false);
  });
});

describe.skipIf(HAY_BASE)('002 · Clasificación, minimización y aislamiento', () => {
  it.skip(`omitido — ${MOTIVO_OMISION}`, () => {});
});
