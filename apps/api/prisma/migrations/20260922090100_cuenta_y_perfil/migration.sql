-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 0012 — cuenta_y_perfil
-- Feature 002, tarea T-03. Fila `0012` de modelo-datos.md §6.2.
-- Bloque A: A.1 `Usuario`, A.3 `PerfilProfesional`, A.4 `EspecialidadDeclarada`,
-- A.5 `AjustePermiso`, A.6 `ResolucionDeDuplicado`.
--
-- **A.2 `IdentificadorFiscal` NO SE CREA ACÁ NI EN NINGUNA PARTE.** Su
-- migración está escrita y guardada fuera de `migrations/`, en
-- `prisma/migraciones-en-espera/0022_identificador_fiscal/`, y no se ejecuta
-- hasta que se resuelva el escalamiento E-002-1 (finalidad del CUIT/CUIL, que
-- la condición C-002-04(a) exige declarar). Ninguna otra tabla la referencia,
-- así que su ausencia no rompe nada.
--
-- LO QUE PRISMA NO EXPRESA Y VA ACÁ COMO SQL CRUDO:
--   - la columna GENERADA `esAdministrador`;
--   - las claves foráneas COMPUESTAS contra columnas de estado;
--   - todos los `CHECK`;
--   - los índices únicos PARCIALES (Prisma los declara totales y acá se
--     reemplazan CONSERVANDO EL NOMBRE, para que el test los encuentre).
--
-- Reversión: reversion.sql de este mismo directorio.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- A.1 — `acceso.Usuario`
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."Usuario" (
    "id" TEXT NOT NULL,
    "indiceCiegoCorreo" BYTEA,
    "correoCifrado" BYTEA,
    "correoNonce" BYTEA,
    "correoTag" BYTEA,
    "correoIdClave" TEXT,
    "nombreParaMostrarCifrado" BYTEA,
    "nombreParaMostrarNonce" BYTEA,
    "nombreParaMostrarTag" BYTEA,
    "nombreParaMostrarIdClave" TEXT,
    "hashContrasena" TEXT,
    "rol" "acceso"."Rol" NOT NULL,
    -- Columna GENERADA, no replicada por la aplicación. Es el destino de la
    -- clave foránea compuesta de F.1 (R-002-03): como se deriva de `rol`, un
    -- `UPDATE rol` la mueve y la clave foránea de la designación lo rechaza.
    -- Nadie puede dejar de ser administrador teniendo designación.
    "esAdministrador" BOOLEAN NOT NULL GENERATED ALWAYS AS ("rol" = 'ADMINISTRADOR') STORED,
    "estadoCuenta" "acceso"."EstadoCuenta" NOT NULL,
    "estadoMfa" "acceso"."EstadoMfa" NOT NULL DEFAULT 'NO_CONFIGURADO',
    "confirmadoEn" TIMESTAMPTZ(6),
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgadaEn" TIMESTAMPTZ(6),
    "motivoPurga" "acceso"."MotivoPurga",
    "eliminadoEn" TIMESTAMPTZ(6),

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "acceso"."Usuario" IS
  'A.1 — la cuenta. Una fila por persona que puede autenticarse. Unica tabla verdaderamente mutable de la feature; el historial esta en auditoria.EventoAuditoria. Retencion: cuentaNoVerificada = 30 dias sin confirmar (CA-28, purga fisica con lapida); cuenta dada de baja = A_DETERMINAR (escalamiento E-002-3, lo resuelve la 003). Nunca se borra la fila: queda la lapida de §5.4.';

COMMENT ON COLUMN "acceso"."Usuario"."id" IS 'PERS — identificador opaco (ULID/UUIDv7), sin estructura derivable. Clave de reidentificacion.';
COMMENT ON COLUMN "acceso"."Usuario"."indiceCiegoCorreo" IS 'INT — HMAC-SHA-256 del correo normalizado con clave FUERA de la base. Lo unico indexable. No reversible.';
COMMENT ON COLUMN "acceso"."Usuario"."correoCifrado" IS 'PERS↑ — AES-256-GCM, clave k_acceso, AAD = id. Nunca en claro, nunca indexado en claro (D-4).';
COMMENT ON COLUMN "acceso"."Usuario"."correoNonce" IS 'INT — nonce del cifrado del correo.';
COMMENT ON COLUMN "acceso"."Usuario"."correoTag" IS 'INT — etiqueta de autenticacion GCM del correo.';
COMMENT ON COLUMN "acceso"."Usuario"."correoIdClave" IS 'INT — identificador de la clave usada; permite rotar sin tocar el dato (§4.3).';
COMMENT ON COLUMN "acceso"."Usuario"."nombreParaMostrarCifrado" IS 'PERS↑ — AES-256-GCM, k_acceso. SIN indice: no hay consulta por nombre en la 002.';
COMMENT ON COLUMN "acceso"."Usuario"."nombreParaMostrarNonce" IS 'INT — nonce del cifrado del nombre para mostrar.';
COMMENT ON COLUMN "acceso"."Usuario"."nombreParaMostrarTag" IS 'INT — etiqueta GCM del nombre para mostrar.';
COMMENT ON COLUMN "acceso"."Usuario"."nombreParaMostrarIdClave" IS 'INT — identificador de la clave usada.';
COMMENT ON COLUMN "acceso"."Usuario"."hashContrasena" IS 'PERS — formato PHC de argon2id sobre la contrasena pimentada con HMAC. Nunca descifrable, nunca exportable: REVOKE SELECT de columna en la 0020.';
COMMENT ON COLUMN "acceso"."Usuario"."rol" IS 'INT — conjunto de permisos por defecto (CA-18).';
COMMENT ON COLUMN "acceso"."Usuario"."esAdministrador" IS 'INT — columna GENERADA desde rol. Destino de la clave foranea compuesta de F.1 (R-002-03).';
COMMENT ON COLUMN "acceso"."Usuario"."estadoCuenta" IS 'INT — BLOQUEADA_TEMPORALMENTE no es un valor almacenable (E-002-7): se deriva de D.6.';
COMMENT ON COLUMN "acceso"."Usuario"."estadoMfa" IS 'INT — proyeccion de E.1, para poder expresar R-002-01 como CHECK.';
COMMENT ON COLUMN "acceso"."Usuario"."confirmadoEn" IS 'INT — momento de la confirmacion del correo (CA-01, CA-28).';
COMMENT ON COLUMN "acceso"."Usuario"."creadoEn" IS 'INT — alta de la cuenta. Arranca el plazo de purga de CA-28.';
COMMENT ON COLUMN "acceso"."Usuario"."actualizadoEn" IS 'INT — ultima modificacion.';
COMMENT ON COLUMN "acceso"."Usuario"."purgadaEn" IS 'INT — lapida de CA-28 y de la 003 (§5.4).';
COMMENT ON COLUMN "acceso"."Usuario"."motivoPurga" IS 'INT — por que se destruyeron los datos personales.';
COMMENT ON COLUMN "acceso"."Usuario"."eliminadoEn" IS 'INT — baja logica. Ningun camino de la 002 la escribe; existe para que la 003 no altere la tabla.';

-- Invariante 1 — un correo, una cuenta VIVA. Prisma declara este indice como
-- total y no unico; acá se reemplaza por el UNIQUE PARCIAL real, conservando el
-- nombre `uq_usuario_correo` (Q-01). Parcial para que la lápida no bloquee un
-- alta futura con el mismo correo, que es un derecho del titular tras una baja.
DROP INDEX IF EXISTS "acceso"."uq_usuario_correo";
CREATE UNIQUE INDEX "uq_usuario_correo"
  ON "acceso"."Usuario" ("indiceCiegoCorreo")
  WHERE "purgadaEn" IS NULL;

-- Q-15 (CA-28): cuentas nunca confirmadas más viejas que el plazo. PARCIAL: el
-- índice mide la cola de purga, no el padrón.
CREATE INDEX "idx_usuario_sin_confirmar"
  ON "acceso"."Usuario" ("creadoEn")
  WHERE "estadoCuenta" = 'NO_VERIFICADA';

-- Q-18 (CA-22): panel de gestión de usuarios por rol y estado.
CREATE INDEX "idx_usuario_panel"
  ON "acceso"."Usuario" ("rol", "estadoCuenta", "creadoEn" DESC);

-- Destinos de las claves foráneas COMPUESTAS. No aportan unicidad por sí mismas
-- (`id` ya es PK): son el mecanismo de R-002-02, R-002-03 y R-002-16. Con
-- `ON UPDATE RESTRICT` del otro lado, degradar el rol de una cuenta que tiene
-- perfil, sesión, secreto TOTP o designación FALLA EN EL MOTOR.
CREATE UNIQUE INDEX "uq_usuario_id_rol" ON "acceso"."Usuario" ("id", "rol");
CREATE UNIQUE INDEX "uq_usuario_id_esadmin" ON "acceso"."Usuario" ("id", "esAdministrador");

-- Invariante 2 — **R-002-01, CA-32, CA-38.** Una cuenta ADMINISTRADOR o ABOGADO
-- operativa sin segundo factor NO ES REPRESENTABLE.
ALTER TABLE "acceso"."Usuario" ADD CONSTRAINT "ck_usuario_mfa_obligatorio"
  CHECK ("rol" = 'CLIENTE' OR "estadoCuenta" <> 'ACTIVA' OR "estadoMfa" = 'ACTIVO');

-- Invariante 3, primera mitad — **R-002-10.** Purgada si y sólo si hay lápida.
ALTER TABLE "acceso"."Usuario" ADD CONSTRAINT "ck_usuario_purga_coherente"
  CHECK (("estadoCuenta" = 'PURGADA') = ("purgadaEn" IS NOT NULL));

-- Invariante 3, segunda mitad — **R-002-10.** Una lápida con datos adentro no
-- es representable. Es lo que hace verificable la supresión de §5.4 y lo que
-- la feature 003 hereda construido.
ALTER TABLE "acceso"."Usuario" ADD CONSTRAINT "ck_usuario_lapida_vacia"
  CHECK (
    "purgadaEn" IS NULL OR (
      "correoCifrado" IS NULL AND
      "nombreParaMostrarCifrado" IS NULL AND
      "hashContrasena" IS NULL AND
      "indiceCiegoCorreo" IS NULL
    )
  );

-- Invariante 3, tercera mitad — y una cuenta VIVA sin correo tampoco.
ALTER TABLE "acceso"."Usuario" ADD CONSTRAINT "ck_usuario_viva_con_correo"
  CHECK (
    "purgadaEn" IS NOT NULL OR (
      "indiceCiegoCorreo" IS NOT NULL AND "correoCifrado" IS NOT NULL
    )
  );

-- Invariante 4 — redundante A PROPÓSITO. El enum ni siquiera tiene el valor; el
-- `CHECK` está para que el porqué quede escrito en el esquema y no sólo en un
-- documento (escalamiento E-002-7).
-- Se escribe como lista blanca y no como `<> 'BLOQUEADA_TEMPORALMENTE'` porque
-- el valor no existe en el tipo: nombrarlo no compilaría. La lista enumera lo
-- que SÍ se puede almacenar, y el día que alguien agregue el valor al enum este
-- `CHECK` lo frena igual.
ALTER TABLE "acceso"."Usuario" ADD CONSTRAINT "ck_usuario_sin_bloqueo_almacenado"
  CHECK ("estadoCuenta" IN (
    'NO_VERIFICADA', 'ACTIVA', 'PENDIENTE_DE_INSCRIPCION_MFA',
    'RESTITUCION_MFA_EN_CURSO', 'SUSPENDIDA', 'PURGADA'
  ));

-- Invariante 5.
ALTER TABLE "acceso"."Usuario" ADD CONSTRAINT "ck_usuario_confirmada_no_es_no_verificada"
  CHECK ("confirmadoEn" IS NULL OR "estadoCuenta" <> 'NO_VERIFICADA');

-- Coherencia de la purga con su motivo: no hay lápida sin motivo declarado.
ALTER TABLE "acceso"."Usuario" ADD CONSTRAINT "ck_usuario_motivo_purga"
  CHECK (("purgadaEn" IS NULL) = ("motivoPurga" IS NULL));

-- Las invariantes 6 y 7 de A.1 (no hay cuenta ACTIVA sin aceptación de cada
-- clase ni sin información del art. 6; no hay ADMINISTRADOR sin designación y
-- sin evento de auditoría en la misma transacción) son DISPARADORES DIFERIDOS y
-- viven en la migración 0021, porque necesitan tablas que todavía no existen.

-- ═════════════════════════════════════════════════════════════════════════════
-- A.3 — `acceso.PerfilProfesional`
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."PerfilProfesional" (
    "usuarioId" TEXT NOT NULL,
    "rolDelTitular" "acceso"."Rol" NOT NULL,
    "matricula" TEXT NOT NULL,
    "jurisdiccion" "acceso"."Jurisdiccion" NOT NULL,
    "colegioDeclarado" TEXT,
    "solicitadaEn" TIMESTAMPTZ(6) NOT NULL,
    "ultimaDecisionId" TEXT,
    "tieneVerificacionAprobada" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerfilProfesional_pkey" PRIMARY KEY ("usuarioId")
);

COMMENT ON TABLE "acceso"."PerfilProfesional" IS
  'A.3 — lo propio del rol ABOGADO. 1:1 opcional con Usuario. NO tiene columna de estado de verificacion: el estado se deriva en cada lectura (D-2). Retencion: verificacionProfesional = A_DETERMINAR (escalamiento E-002-3, mismo que el E-2 de la 004). Sin purga automatica: R-002-15 lo impide materialmente.';

COMMENT ON COLUMN "acceso"."PerfilProfesional"."usuarioId" IS 'PERS — identificador opaco de la cuenta.';
COMMENT ON COLUMN "acceso"."PerfilProfesional"."rolDelTitular" IS 'INT — replica sostenida por clave foranea compuesta contra Usuario(id, rol), ON UPDATE RESTRICT.';
COMMENT ON COLUMN "acceso"."PerfilProfesional"."matricula" IS 'PERS — EN CLARO y con indice, a proposito: es dato de publicidad registral del colegio y su finalidad es la identificabilidad; cifrarlo impediria verificarlo.';
COMMENT ON COLUMN "acceso"."PerfilProfesional"."jurisdiccion" IS 'PERS — dato que las features 008/012/013 necesitan para el control M-7 (D-002-07).';
COMMENT ON COLUMN "acceso"."PerfilProfesional"."colegioDeclarado" IS 'PERS — lo que DECLARO el abogado. El colegio verificado vive en la evidencia de C.1.';
COMMENT ON COLUMN "acceso"."PerfilProfesional"."solicitadaEn" IS 'INT — arranca el reloj de CA-31.';
COMMENT ON COLUMN "acceso"."PerfilProfesional"."ultimaDecisionId" IS 'INT — puntero al ultimo hecho, para poder indexar (Q-00, Q-10). NO es el estado derivado: no depende del tiempo.';
COMMENT ON COLUMN "acceso"."PerfilProfesional"."tieneVerificacionAprobada" IS 'INT — idem. Lo mantiene el disparador de la 0021 desde C.1.';
COMMENT ON COLUMN "acceso"."PerfilProfesional"."creadoEn" IS 'INT — alta del perfil.';

-- Un perfil profesional colgando de un cliente no es representable.
ALTER TABLE "acceso"."PerfilProfesional" ADD CONSTRAINT "ck_perfil_rol_abogado"
  CHECK ("rolDelTitular" = 'ABOGADO');

CREATE UNIQUE INDEX "uq_perfil_usuario_rol"
  ON "acceso"."PerfilProfesional" ("usuarioId", "rolDelTitular");

-- **R-002-18.** Dos cuentas pueden DECLARAR la misma matrícula (el §7 de la
-- spec exige que el alta no falle en el acto), pero SÓLO UNA puede estar
-- verificada. Índice único PARCIAL; Prisma lo declara total y no único.
DROP INDEX IF EXISTS "acceso"."uq_perfil_matricula_verificada";
CREATE UNIQUE INDEX "uq_perfil_matricula_verificada"
  ON "acceso"."PerfilProfesional" ("jurisdiccion", "matricula")
  WHERE "tieneVerificacionAprobada";

-- Q-00: parte del PerfilDeAutorizacion de cada petición autenticada.
CREATE INDEX "idx_perfil_ultima_decision"
  ON "acceso"."PerfilProfesional" ("ultimaDecisionId");

-- Q-10 (CA-31): cola de verificaciones pendientes por antigüedad. PARCIAL: el
-- tamaño del índice es el de la cola, no el del padrón.
CREATE INDEX "idx_perfil_pendiente"
  ON "acceso"."PerfilProfesional" ("solicitadaEn")
  WHERE "ultimaDecisionId" IS NULL;

ALTER TABLE "acceso"."PerfilProfesional" ADD CONSTRAINT "fk_perfil_usuario_rol"
  FOREIGN KEY ("usuarioId", "rolDelTitular") REFERENCES "acceso"."Usuario"("id", "rol")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- `fk_perfil_ultima_decision` (hacia C.1) la agrega la migración 0014: la tabla
-- de decisiones todavía no existe. La invariante 2 de A.3 —matrícula y
-- jurisdicción inmutables tras una decisión aprobada, R-002-19— es un
-- disparador y vive en la 0021.

-- ═════════════════════════════════════════════════════════════════════════════
-- A.4 — `acceso.EspecialidadDeclarada`
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."EspecialidadDeclarada" (
    "usuarioId" TEXT NOT NULL,
    "especialidad" "acceso"."Especialidad" NOT NULL,
    "declaradaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiradaEn" TIMESTAMPTZ(6),

    CONSTRAINT "EspecialidadDeclarada_pkey" PRIMARY KEY ("usuarioId","especialidad")
);

COMMENT ON TABLE "acceso"."EspecialidadDeclarada" IS
  'A.4 — especialidades declaradas por el abogado (CA-24). Enum CERRADO, no texto libre: un campo libre en el perfil publico de un abogado es una promesa de resultado esperando a ocurrir (constitucion #6). Retencion: la del perfil profesional (A_DETERMINAR, E-002-3). Baja logica con retiradaEn; la declaracion no se borra.';

COMMENT ON COLUMN "acceso"."EspecialidadDeclarada"."usuarioId" IS 'PERS — identificador opaco del perfil profesional.';
COMMENT ON COLUMN "acceso"."EspecialidadDeclarada"."especialidad" IS 'PERS — catalogo cerrado definido por ux-expert; ampliarlo es revision aditiva en compuerta.';
COMMENT ON COLUMN "acceso"."EspecialidadDeclarada"."declaradaEn" IS 'PERS — cuando la declaro.';
COMMENT ON COLUMN "acceso"."EspecialidadDeclarada"."retiradaEn" IS 'PERS — baja logica.';

ALTER TABLE "acceso"."EspecialidadDeclarada" ADD CONSTRAINT "EspecialidadDeclarada_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "acceso"."PerfilProfesional"("usuarioId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═════════════════════════════════════════════════════════════════════════════
-- A.5 — `acceso.AjustePermiso`
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."AjustePermiso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "permiso" "acceso"."Permiso" NOT NULL,
    "efecto" "acceso"."EfectoAjuste" NOT NULL,
    "otorgadoPor" TEXT NOT NULL,
    "momento" TIMESTAMPTZ(6) NOT NULL,
    "vigenciaHasta" TIMESTAMPTZ(6),
    "motivo" "acceso"."MotivoAjustePermiso" NOT NULL,
    "revocadoEn" TIMESTAMPTZ(6),
    "claveIdempotencia" TEXT NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AjustePermiso_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "acceso"."AjustePermiso" IS
  'A.5 — ajuste individual de permiso (contrato §2). Solo insercion salvo revocadoEn. Retencion: vida de la cuenta; es prueba de por que alguien tenia acceso. Sin purga automatica.';

COMMENT ON COLUMN "acceso"."AjustePermiso"."id" IS 'INT — identificador opaco del ajuste.';
COMMENT ON COLUMN "acceso"."AjustePermiso"."usuarioId" IS 'PERS — a quien se le ajusta el permiso.';
COMMENT ON COLUMN "acceso"."AjustePermiso"."permiso" IS 'INT — catalogo cerrado de 25 permisos del contrato.';
COMMENT ON COLUMN "acceso"."AjustePermiso"."efecto" IS 'INT — CONCEDE o RETIRA.';
COMMENT ON COLUMN "acceso"."AjustePermiso"."otorgadoPor" IS 'PERS — quien lo otorgo. Un privilegio sin responsable no es auditable.';
COMMENT ON COLUMN "acceso"."AjustePermiso"."momento" IS 'INT — cuando se otorgo.';
COMMENT ON COLUMN "acceso"."AjustePermiso"."vigenciaHasta" IS 'INT — vencimiento del ajuste, si es temporal.';
COMMENT ON COLUMN "acceso"."AjustePermiso"."motivo" IS 'INT — catalogo cerrado; un texto libre en una tabla de privilegios es donde despues no se entiende por que alguien tenia acceso.';
COMMENT ON COLUMN "acceso"."AjustePermiso"."revocadoEn" IS 'INT — baja logica del ajuste.';
COMMENT ON COLUMN "acceso"."AjustePermiso"."claveIdempotencia" IS 'INT — constitucion #12.';
COMMENT ON COLUMN "acceso"."AjustePermiso"."creadoEn" IS 'INT — alta de la fila.';

CREATE UNIQUE INDEX "uq_ajuste_idempotencia" ON "acceso"."AjustePermiso" ("claveIdempotencia");

-- Q-00: ajustes VIVOS del sujeto de la petición. PARCIAL.
CREATE INDEX "idx_ajuste_vivo"
  ON "acceso"."AjustePermiso" ("usuarioId")
  WHERE "revocadoEn" IS NULL;

CREATE INDEX "idx_ajuste_otorgante" ON "acceso"."AjustePermiso" ("otorgadoPor");

-- **La grieta obvia del mecanismo de ajustes, cerrada en la base.** Sin este
-- `CHECK`, a un administrador se le podría conceder por la puerta de atrás el
-- permiso de apagar su propio segundo factor, y CA-32 ("no puede desactivarse
-- por configuración") sería falso. No hay excepción por rol: el permiso
-- `mfa.desactivar.propio` sólo existe como parte del mapa por defecto del
-- CLIENTE, nunca como concesión individual.
ALTER TABLE "acceso"."AjustePermiso" ADD CONSTRAINT "ck_ajuste_no_concede_apagar_mfa"
  CHECK (NOT ("permiso" = 'mfa.desactivar.propio' AND "efecto" = 'CONCEDE'));

-- Un ajuste vencido antes de otorgarse no es un ajuste.
ALTER TABLE "acceso"."AjustePermiso" ADD CONSTRAINT "ck_ajuste_vigencia_posterior"
  CHECK ("vigenciaHasta" IS NULL OR "vigenciaHasta" > "momento");

ALTER TABLE "acceso"."AjustePermiso" ADD CONSTRAINT "AjustePermiso_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "acceso"."AjustePermiso" ADD CONSTRAINT "AjustePermiso_otorgadoPor_fkey"
  FOREIGN KEY ("otorgadoPor") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═════════════════════════════════════════════════════════════════════════════
-- A.6 — `acceso.ResolucionDeDuplicado`
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."ResolucionDeDuplicado" (
    "id" TEXT NOT NULL,
    "clase" "acceso"."ClaseDeDuplicado" NOT NULL,
    "titularReal" TEXT NOT NULL,
    "altaSecundaria" TEXT,
    "notificadoAlTitularEn" TIMESTAMPTZ(6) NOT NULL,
    "resultado" "acceso"."ResultadoDeDuplicado" NOT NULL DEFAULT 'PENDIENTE',
    "resueltaEn" TIMESTAMPTZ(6),
    "claveIdempotencia" TEXT NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResolucionDeDuplicado_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "acceso"."ResolucionDeDuplicado" IS
  'A.6 — resolucion de un duplicado de correo o de CUIT/CUIL (contrato §9). Es lo que hace que CA-02 y CA-04 no terminen en un callejon sin salida (C-002-06) y que el aviso no se duplique. Retencion: vida de las cuentas involucradas; sin purga automatica.';

COMMENT ON COLUMN "acceso"."ResolucionDeDuplicado"."id" IS 'INT — identificador opaco.';
COMMENT ON COLUMN "acceso"."ResolucionDeDuplicado"."clase" IS 'INT — CORREO o CUIT_CUIL.';
COMMENT ON COLUMN "acceso"."ResolucionDeDuplicado"."titularReal" IS 'PERS — cuenta del titular que ya existia.';
COMMENT ON COLUMN "acceso"."ResolucionDeDuplicado"."altaSecundaria" IS 'PERS — anulable: en el caso CORREO NO se crea una segunda cuenta.';
COMMENT ON COLUMN "acceso"."ResolucionDeDuplicado"."notificadoAlTitularEn" IS 'INT — cuando se le aviso al titular real.';
COMMENT ON COLUMN "acceso"."ResolucionDeDuplicado"."resultado" IS 'INT — PENDIENTE / DESCARTADA / CONFIRMADA_POR_EL_TITULAR.';
COMMENT ON COLUMN "acceso"."ResolucionDeDuplicado"."resueltaEn" IS 'INT — cierre del caso.';
COMMENT ON COLUMN "acceso"."ResolucionDeDuplicado"."claveIdempotencia" IS 'INT — constitucion #12: el aviso no se duplica.';
COMMENT ON COLUMN "acceso"."ResolucionDeDuplicado"."creadoEn" IS 'INT — alta de la fila.';

CREATE UNIQUE INDEX "uq_duplicado_idempotencia" ON "acceso"."ResolucionDeDuplicado" ("claveIdempotencia");
CREATE INDEX "idx_duplicado_titular" ON "acceso"."ResolucionDeDuplicado" ("titularReal");

-- Un duplicado resuelto sin resultado, o un resultado sin cierre, es un caso
-- que nadie puede auditar después.
ALTER TABLE "acceso"."ResolucionDeDuplicado" ADD CONSTRAINT "ck_duplicado_cierre_coherente"
  CHECK (("resueltaEn" IS NULL) = ("resultado" = 'PENDIENTE'));

-- Un duplicado de CORREO no crea segunda cuenta; uno de CUIT/CUIL sí (CA-04).
ALTER TABLE "acceso"."ResolucionDeDuplicado" ADD CONSTRAINT "ck_duplicado_correo_sin_secundaria"
  CHECK ("clase" <> 'CORREO' OR "altaSecundaria" IS NULL);

-- El titular real y el alta secundaria no pueden ser la misma cuenta.
ALTER TABLE "acceso"."ResolucionDeDuplicado" ADD CONSTRAINT "ck_duplicado_cuentas_distintas"
  CHECK ("altaSecundaria" IS NULL OR "altaSecundaria" <> "titularReal");

ALTER TABLE "acceso"."ResolucionDeDuplicado" ADD CONSTRAINT "ResolucionDeDuplicado_titularReal_fkey"
  FOREIGN KEY ("titularReal") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "acceso"."ResolucionDeDuplicado" ADD CONSTRAINT "ResolucionDeDuplicado_altaSecundaria_fkey"
  FOREIGN KEY ("altaSecundaria") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
