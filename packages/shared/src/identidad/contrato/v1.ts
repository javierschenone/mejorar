/**
 * Contrato público de Identidad y acceso.
 *
 * | Campo | Valor |
 * | --- | --- |
 * | Contrato | `identidad-y-acceso` |
 * | Versión | `1` (`identidad-y-acceso/v1`), revisión **1** del documento |
 * | Spec de origen | `specs/002-identidad-y-acceso/spec.md` (**v3**, 39 criterios) |
 * | Dictamen | `specs/002-identidad-y-acceso/cumplimiento.md` (APTO CON CONDICIONES, 12) |
 * | Plan | `specs/002-identidad-y-acceso/plan.md` |
 * | Estado | PROPUESTO — pendiente de aprobación humana en G2 |
 * | Autor | `arquitecto` |
 * | Implementan | `dev-dominio` (§2 a §6, §9), `dev-integraciones` (§13), `dev-backend` (§7, §8, §14) |
 *
 * ESTE ARCHIVO ES SÓLO DECLARACIONES. No contiene ni una implementación.
 *
 * Reglas de lectura obligatorias (heredadas de `motor-reglas-legales.ts`):
 *
 * 1. Este archivo es la **fuente normativa** del contrato. La copia que viva en
 *    `packages/shared/src/identidad/contrato/v1.ts` debe ser **idéntica byte a
 *    byte** a la parte de este archivo marcada como `[DOMINIO PURO]`; el
 *    pipeline lo verifica (ADR-017, aplicado a esta feature en `plan.md` §2 y
 *    obligación de frontera F-11).
 * 2. Todo campo cuyo valor puede faltar se declara **requerido y anulable**
 *    (`: T | null`), nunca opcional (`?:`). "No lo sé" es una decisión explícita.
 * 3. Todo objeto es `readonly` en profundidad.
 * 4. Las funciones del dominio **no lanzan excepciones** como flujo de control:
 *    devuelven `Resultado`.
 * 5. El dominio **no lee el reloj, ni el entorno, ni la red, ni el disco**
 *    (ADR-009 capa 2, ADR-016). El instante de evaluación entra por parámetro.
 * 6. Ningún tipo de este contrato admite un campo booleano donde la norma exige
 *    prueba: la aceptación de términos es un registro versionado (§10) y la
 *    verificación de matrícula es un evento con vigencia (§5).
 *
 * Marcas de sección:
 *   `[DOMINIO PURO]`  → `packages/shared`, sin framework, sin `node:*`.
 *   `[BORDE]`         → `apps/api`, necesita criptografía, reloj o persistencia.
 *   `[PUERTO]`        → `packages/integrations`, con mock determinista obligatorio.
 */

/* ───────────────────────────────────────────────────────────────────────────
 * 0. Identificación del contrato
 * ────────────────────────────────────────────────────────────────────────── */

export type VersionContrato = 'identidad-y-acceso/v1';

/* ───────────────────────────────────────────────────────────────────────────
 * 1. Marcas nominales, identificadores opacos, tiempo  [DOMINIO PURO]
 *
 * Mismo criterio que ADR-015: identificadores sin significado, que no derivan
 * de ningún dato de la persona. Este contrato declara su propia marca: no
 * comparte el símbolo con `motor-reglas-legales.ts` y **no debe compartirlo**.
 * `IdUsuario` (una cuenta) y el `IdPersona` del motor (un sujeto
 * despersonalizado de un análisis) son entidades distintas; la correspondencia
 * entre ambos vive en `apps/api` (obligación de frontera F-12 del plan).
 * ────────────────────────────────────────────────────────────────────────── */

declare const marcaIdOpaco: unique symbol;
declare const marcaInstante: unique symbol;
declare const marcaFecha: unique symbol;

export type IdOpaco<TEntidad extends string> = string & {
  readonly [marcaIdOpaco]: TEntidad;
};

export type IdUsuario = IdOpaco<'usuario'>;
export type IdSesion = IdOpaco<'sesion'>;
export type IdFamiliaRefresco = IdOpaco<'familia-refresco'>;
export type IdEventoAuditoria = IdOpaco<'evento-auditoria'>;
export type IdVerificacionProfesional = IdOpaco<'verificacion-profesional'>;
export type IdSolicitudRestitucionMfa = IdOpaco<'solicitud-restitucion-mfa'>;
export type IdAceptacion = IdOpaco<'aceptacion'>;
export type IdDesafio = IdOpaco<'desafio-de-ingreso'>;
export type IdExportacion = IdOpaco<'exportacion'>;

/**
 * Construye un identificador opaco validando que el valor **no** tenga forma de
 * dato identificatorio (7-8 dígitos, 11 dígitos, arroba, espacios). Misma
 * guarda que `crearIdOpaco` del motor, por el mismo motivo (C-10 de la 004,
 * D-002-11 de esta feature).
 */
export declare function crearIdOpaco<TEntidad extends string>(
  entidad: TEntidad,
  valor: string,
): Resultado<IdOpaco<TEntidad>, ErrorIdentidad>;

/** Instante absoluto en UTC, ISO 8601 con milisegundos: `2026-09-21T14:03:11.412Z`. */
export type Instante = string & { readonly [marcaInstante]: 'Instante' };

/** Fecha civil argentina `AAAA-MM-DD`, sin hora. Se usa para vigencias. */
export type FechaCivil = string & { readonly [marcaFecha]: 'FechaCivil' };

/**
 * Instante contra el que se evalúa una regla de este contrato. Tiene marca
 * propia para que no pueda confundirse con cualquier otro instante del sistema:
 * confundir "ahora" con "el momento del hecho" es el defecto que ADR-016
 * previene en el motor y que acá decide si una matrícula está vigente.
 */
export type InstanteDeEvaluacion = Instante & {
  readonly [marcaInstante]: 'InstanteDeEvaluacion';
};

export type Resultado<TValor, TError> =
  | { readonly ok: true; readonly valor: TValor }
  | { readonly ok: false; readonly error: TError };

/**
 * Error de este módulo. **Nunca** se convierte en un mensaje de texto libre
 * hacia el cliente: el borde HTTP lo traduce a una de las respuestas cerradas
 * de §14, que son deliberadamente pocas y poco informativas (R-05, CA-12).
 */
export interface ErrorIdentidad {
  readonly clase: ClaseErrorIdentidad;
  readonly codigo: string;
  readonly referencia: string | null;
}

export type ClaseErrorIdentidad =
  | 'ENTRADA_INVALIDA'
  | 'CREDENCIAL_INVALIDA'
  | 'SEGUNDO_FACTOR_INVALIDO'
  | 'CUENTA_NO_OPERATIVA'
  | 'BLOQUEO_TEMPORAL'
  | 'AUTORIZACION_DENEGADA'
  | 'REAUTENTICACION_REQUERIDA'
  | 'TOKEN_NO_ACEPTABLE'
  | 'REUTILIZACION_DE_REFRESCO'
  | 'POLITICA_DE_CONTRASENA'
  | 'CLASIFICACION_AUSENTE'
  | 'INCONSISTENCIA_INTERNA';

/* ───────────────────────────────────────────────────────────────────────────
 * 2. Roles y permisos  [DOMINIO PURO]   (CA-18, R-07 — ver ADR-022)
 *
 * El rol es **únicamente** el conjunto de permisos que trae por defecto. No
 * aparece en el contexto de autorización (§3) y ningún guarda puede leerlo.
 * ────────────────────────────────────────────────────────────────────────── */

export type Rol = 'CLIENTE' | 'ABOGADO' | 'ADMINISTRADOR';

/**
 * Catálogo cerrado de permisos de la feature 002. Cada feature posterior agrega
 * los suyos como **revisión aditiva** de este contrato; quitar un permiso es un
 * cambio incompatible y exige G2.
 *
 * Convención de nombre: `<recurso>.<acción>[.<alcance>]`, siempre en infinitivo
 * y en castellano. El sufijo `.propio` no es decorativo: marca los permisos
 * cuyo alcance sólo puede resolverse contra un recurso concreto (§3).
 */
export type Permiso =
  // Perfil y datos propios (CA-23, CA-24, CA-25)
  | 'perfil.leer.propio'
  | 'perfil.editar.propio'
  | 'perfil.exportar.propio'
  | 'perfil.declararEspecialidades.propio'
  // Credenciales (CA-16, CA-39, recaudo B-3)
  | 'contrasena.cambiar.propia'
  | 'mfa.inscribir.propio'
  | 'mfa.desactivar.propio'
  | 'mfa.regenerarCodigosDeRespaldo.propio'
  // Sesión (CA-13, CA-14)
  | 'sesion.listar.propia'
  | 'sesion.cerrar.propia'
  // Auditoría (CA-21, dictamen §4.1 advertencia 2)
  | 'auditoria.leer.propia'
  | 'auditoria.leer.total'
  // Back-office de usuarios (CA-22, CA-33, CA-34, R-01)
  | 'usuario.listar'
  | 'usuario.leer'
  | 'usuario.crearAdministrador'
  | 'usuario.suspender'
  // Verificación profesional (CA-05, CA-22, CA-29, CA-30, CA-31)
  | 'matricula.leer'
  | 'matricula.verificar'
  | 'matricula.suspender'
  // Restitución de segundo factor (CA-35 — ver ADR-027)
  | 'restitucionMfa.solicitar.propia'
  | 'restitucionMfa.instruir'
  | 'restitucionMfa.aprobar'
  // Trabajo profesional. Declarados acá porque la vigencia de la matrícula los
  // gobierna (CA-29, CA-30); los **recursos** sobre los que operan los aportan
  // las specs 008/012/013 (obligación de frontera F-09).
  | 'caso.leer.asignado'
  | 'caso.actuar.asignado'
  | 'caso.recibirAsignacion';

/**
 * Mapa rol → permisos por defecto. Es **una tabla de datos**, no código: vive
 * en `packages/shared`, se lee sin levantar infraestructura y un test de forma
 * verifica que su contenido coincide con esta declaración (CA-18).
 *
 * Invariante verificada por test: `mapaRolPermisos.ADMINISTRADOR` **no**
 * contiene `'mfa.desactivar.propio'` (CA-32, ADR-023).
 */
export declare const mapaRolPermisos: Readonly<Record<Rol, readonly Permiso[]>>;

/**
 * Concesión o retiro individual sobre el mapa por defecto. Existe porque el
 * roster real tiene excepciones (un administrador de soporte que no aprueba
 * matrículas) y porque sin esto la única forma de dar un permiso sería crear
 * un rol nuevo, que es exactamente lo que R-07 quiere evitar.
 */
export interface AjusteDePermiso {
  readonly permiso: Permiso;
  readonly efecto: 'CONCEDE' | 'RETIRA';
  readonly otorgadoPor: IdUsuario;
  readonly momento: Instante;
  readonly vigenciaHasta: Instante | null;
}

/**
 * Todo lo que el dominio necesita saber de una cuenta para derivar sus
 * permisos. Es el **único** lugar del sistema donde el rol es visible para una
 * decisión de autorización, y es una función pura y auditable (ADR-022).
 */
export interface PerfilDeAutorizacion {
  readonly sujeto: IdUsuario;
  readonly rol: Rol;
  readonly estadoCuenta: EstadoCuenta;
  readonly estadoMfa: EstadoMfa;
  readonly verificacionProfesional: EstadoVerificacionProfesional | null;
  readonly ajustes: readonly AjusteDePermiso[];
}

/**
 * Deriva el conjunto efectivo de permisos. Pura, total y determinista.
 *
 * Reglas que implementa, todas verificables una por una:
 * - Cuenta que no está `ACTIVA` ⇒ conjunto vacío, salvo las excepciones
 *   explícitas de `permisosDeCuentaNoOperativa` (CA-01, CA-05).
 * - `ADMINISTRADOR` o `ABOGADO` con `estadoMfa !== 'ACTIVO'` ⇒ sólo los
 *   permisos de inscripción de segundo factor (CA-32, CA-38). No hay opción de
 *   configuración que lo evite: no existe la opción (ADR-023).
 * - Matrícula `VENCIDA` ⇒ se retira `'caso.recibirAsignacion'` y se conservan
 *   `'caso.leer.asignado'` y `'caso.actuar.asignado'` (CA-29).
 * - Matrícula `SUSPENDIDA` ⇒ se retiran los tres (CA-30).
 */
export declare function derivarPermisos(
  perfil: PerfilDeAutorizacion,
  momento: InstanteDeEvaluacion,
): ReadonlySet<Permiso>;

/** Permisos que conserva una cuenta no operativa, para que nunca quede sin salida. */
export declare const permisosDeCuentaNoOperativa: Readonly<
  Record<Exclude<EstadoCuenta, 'ACTIVA'>, readonly Permiso[]>
>;

/* ───────────────────────────────────────────────────────────────────────────
 * 3. Autorización como capacidad  [DOMINIO PURO]  (CA-19, CA-20 — ADR-022)
 *
 * La pieza central de toda la aplicación futura. Tres ideas:
 *
 *   (a) El contexto de acceso **no tiene rol**. Un guarda no puede evaluar el
 *       nombre del rol porque el tipo no se lo ofrece.
 *   (b) Un permiso por sí solo no autoriza nada: autorizar exige un recurso
 *       concreto, y la prueba de autorización queda **atada a ese recurso**.
 *   (c) La prueba (`Autorizacion`) es el único argumento con el que la capa de
 *       persistencia acepta leer o escribir. No se puede escribir un camino de
 *       datos que se saltee la autorización porque no se puede construir su
 *       argumento.
 * ────────────────────────────────────────────────────────────────────────── */

export type TipoRecurso =
  | 'USUARIO'
  | 'PERFIL'
  | 'SESION'
  | 'VERIFICACION_PROFESIONAL'
  | 'EVENTO_AUDITORIA'
  | 'SOLICITUD_RESTITUCION_MFA'
  | 'CREDENCIAL'
  // Declarado acá, registrado por las specs 008/012/013 (F-09).
  | 'CASO';

export type IdRecurso<T extends TipoRecurso> = IdOpaco<`recurso:${T}`>;

/**
 * Referencia a un recurso concreto o a una colección. `COLECCION` no es un
 * comodín: obliga a resolver un `FiltroDeAlcance` (abajo), que la consulta
 * **tiene que** incorporar.
 */
export type Objetivo<T extends TipoRecurso> =
  | { readonly clase: 'INDIVIDUAL'; readonly tipo: T; readonly id: IdRecurso<T> }
  | { readonly clase: 'COLECCION'; readonly tipo: T };

/**
 * Lo que el guarda y los casos de uso reciben. **Nótese la ausencia de `rol`.**
 * Es deliberada y es la primera de las cinco capas de ADR-022.
 */
export interface ContextoDeAcceso {
  readonly sujeto: IdUsuario;
  readonly sesion: IdSesion;
  readonly permisos: ReadonlySet<Permiso>;
  readonly nivelAutenticacion: NivelAutenticacion;
  /** Momento en que se completó la autenticación de esta sesión (CA-39, B-3). */
  readonly autenticadoEn: Instante;
  readonly idCorrelacion: string;
}

export type NivelAutenticacion =
  | 'CONTRASENA'
  | 'CONTRASENA_Y_SEGUNDO_FACTOR';

declare const marcaAutorizacion: unique symbol;

/**
 * Prueba de que la autorización ocurrió, para **este** sujeto, **este** permiso
 * y **este** recurso. El símbolo de marca no se exporta: fuera del módulo que
 * implementa `autorizar` el tipo es inconstruible.
 */
export interface Autorizacion<P extends Permiso, T extends TipoRecurso> {
  readonly [marcaAutorizacion]: true;
  readonly permiso: P;
  readonly objetivo: Extract<Objetivo<T>, { clase: 'INDIVIDUAL' }>;
  readonly sujeto: IdUsuario;
  readonly sesion: IdSesion;
  readonly momento: Instante;
  /** Evento emitido por esta autorización, si el recurso lo exigía (§4). */
  readonly evento: IdEventoAuditoria | null;
}

/**
 * Autorización sobre una colección. Lleva el criterio que la consulta está
 * obligada a aplicar. Devolver todas las filas de una tabla y filtrar después
 * en memoria **no** cumple el contrato: el criterio va al `WHERE`.
 */
export interface FiltroDeAlcance<P extends Permiso, T extends TipoRecurso> {
  readonly [marcaAutorizacion]: true;
  readonly permiso: P;
  readonly tipo: T;
  readonly criterio: CriterioDeAlcance;
  readonly sujeto: IdUsuario;
  readonly sesion: IdSesion;
  readonly momento: Instante;
  readonly evento: IdEventoAuditoria | null;
}

export type CriterioDeAlcance =
  | { readonly clase: 'TODOS' }
  | { readonly clase: 'PROPIOS'; readonly titular: IdUsuario }
  | {
      readonly clase: 'ASIGNADOS';
      readonly profesional: IdUsuario;
      readonly vigentesAl: Instante;
    }
  /** Tiene el permiso, pero su alcance está vacío. Lista vacía, nunca 403. */
  | { readonly clase: 'NINGUNO' };

export type DecisionDeAcceso =
  | { readonly decision: 'PERMITIDO' }
  | { readonly decision: 'DENEGADO'; readonly motivo: MotivoDenegacion };

export type MotivoDenegacion =
  | 'PERMISO_AUSENTE'
  | 'FUERA_DE_ALCANCE'
  | 'CUENTA_NO_OPERATIVA'
  | 'MATRICULA_NO_VIGENTE'
  | 'SEGUNDO_FACTOR_REQUERIDO'
  | 'REAUTENTICACION_REQUERIDA'
  | 'CLASIFICACION_AUSENTE';

/**
 * Decisión pura, sin efectos: dado el contexto, el permiso y el alcance ya
 * resuelto, ¿se permite? Está separada de `autorizar` justamente para poder
 * probarla como una tabla de verdad, sin base de datos.
 */
export declare function decidirAcceso(
  contexto: ContextoDeAcceso,
  permiso: Permiso,
  alcance: AlcanceResuelto,
  exigencia: ExigenciaDelRecurso,
): DecisionDeAcceso;

/** Lo que el resolvedor de alcance averiguó sobre la relación sujeto ↔ recurso. */
export type AlcanceResuelto =
  | { readonly clase: 'ES_TITULAR' }
  | { readonly clase: 'ESTA_ASIGNADO'; readonly desde: Instante }
  | { readonly clase: 'ALCANCE_GLOBAL' }
  | { readonly clase: 'SIN_RELACION' }
  | { readonly clase: 'COLECCION'; readonly criterio: CriterioDeAlcance };

/** Exigencias que el tipo de recurso impone más allá del permiso. */
export interface ExigenciaDelRecurso {
  readonly clasificacion: ClasificacionDato;
  readonly exigeSegundoFactor: boolean;
  /** Ventana máxima desde `autenticadoEn` para operaciones sensibles (B-3). */
  readonly ventanaDeReautenticacion: DuracionEnSegundos | null;
}

export type DuracionEnSegundos = number & { readonly __duracion: 'segundos' };

/* ── El borde: quién produce la prueba ─────────────────────────────── [BORDE] */

/**
 * Único constructor de `Autorizacion`. Lo implementa `dev-backend` en
 * `apps/api/src/autorizacion`. Resuelve el alcance (puede consultar la base),
 * llama a `decidirAcceso`, **emite el `EventoAuditoria` cuando la clasificación
 * del recurso lo exige** (§4) y recién entonces devuelve la prueba.
 *
 * Que la auditoría sea un efecto de autorizar, y no una línea que hay que
 * acordarse de escribir, es lo que hace que CA-21 sea estructural.
 */
export declare function autorizar<P extends Permiso, T extends TipoRecurso>(
  contexto: ContextoDeAcceso,
  permiso: P,
  objetivo: Extract<Objetivo<T>, { clase: 'INDIVIDUAL' }>,
): Promise<Resultado<Autorizacion<P, T>, ErrorIdentidad>>;

export declare function autorizarColeccion<P extends Permiso, T extends TipoRecurso>(
  contexto: ContextoDeAcceso,
  permiso: P,
  objetivo: Extract<Objetivo<T>, { clase: 'COLECCION' }>,
): Promise<Resultado<FiltroDeAlcance<P, T>, ErrorIdentidad>>;

/**
 * Registro de tipos de recurso. Cada tipo declara su clasificación y su
 * resolvedor de alcance. **Arranque fallido si falta alguno**: el sistema se
 * niega a levantar, no degrada a permisivo (CA-21, D-002-10).
 */
export interface RegistroDeRecurso<T extends TipoRecurso> {
  readonly tipo: T;
  readonly clasificacion: ClasificacionDato;
  readonly exigeSegundoFactor: boolean;
  readonly ventanaDeReautenticacion: DuracionEnSegundos | null;
  readonly resolverAlcance: ResolvedorDeAlcance<T>;
}

export interface ResolvedorDeAlcance<T extends TipoRecurso> {
  evaluar(
    sujeto: IdUsuario,
    permiso: Permiso,
    objetivo: Objetivo<T>,
    momento: InstanteDeEvaluacion,
  ): Promise<AlcanceResuelto>;
}

export declare function validarRegistroDeRecursos(
  registros: readonly RegistroDeRecurso<TipoRecurso>[],
): Resultado<void, ErrorIdentidad>;

/* ───────────────────────────────────────────────────────────────────────────
 * 4. Clasificación de datos y auditoría  (CA-21, CA-34 — ver ADR-028)
 *
 * `EventoAuditoria` ya existe como andamiaje de la feature 001. Esta feature lo
 * **extiende**, no lo reemplaza: agrega la taxonomía cerrada de acciones, el
 * titular afectado, la clasificación y el sello. La 001 dejó expresamente para
 * acá "taxonomía completa de eventos, retención y encadenamiento de hashes".
 * ────────────────────────────────────────────────────────────────────────── */

export type ClasificacionDato =
  | 'PUBLICO'
  | 'INTERNO'
  | 'PERSONAL'
  | 'PATRIMONIAL_SENSIBLE';

/** Taxonomía cerrada. Agregar una acción es una revisión aditiva del contrato. */
export type AccionAuditada =
  | 'CUENTA_CREADA'
  | 'CUENTA_CONFIRMADA'
  | 'CUENTA_PURGADA'
  | 'ADMINISTRADOR_CREADO'
  | 'ADMINISTRADOR_SEMBRADO'
  | 'ADMINISTRADOR_NOMINALIZADO'
  | 'INGRESO_EXITOSO'
  | 'INGRESO_FALLIDO'
  | 'BLOQUEO_APLICADO'
  | 'SEGUNDO_FACTOR_INSCRIPTO'
  | 'SEGUNDO_FACTOR_DESACTIVADO'
  | 'CODIGOS_DE_RESPALDO_REGENERADOS'
  | 'CODIGO_DE_RESPALDO_CONSUMIDO'
  | 'REFRESCO_ROTADO'
  | 'REUTILIZACION_DE_REFRESCO_DETECTADA'
  | 'SESION_CERRADA'
  | 'TODAS_LAS_SESIONES_CERRADAS'
  | 'CONTRASENA_CAMBIADA'
  | 'RECUPERACION_SOLICITADA'
  | 'RECUPERACION_COMPLETADA'
  | 'ACEPTACION_REGISTRADA'
  | 'MATRICULA_VERIFICADA'
  | 'MATRICULA_RECHAZADA'
  | 'MATRICULA_SUSPENDIDA'
  | 'MATRICULA_VENCIDA'
  | 'RESTITUCION_MFA_SOLICITADA'
  | 'RESTITUCION_MFA_INSTRUIDA'
  | 'RESTITUCION_MFA_RESUELTA'
  | 'DOCUMENTACION_DE_RESTITUCION_DESTRUIDA'
  | 'DATOS_PROPIOS_EXPORTADOS'
  | 'RECURSO_LEIDO'
  | 'RECURSO_MODIFICADO'
  | 'ACCESO_DENEGADO';

/**
 * Evento de la bitácora. Extiende el de la 001 (identificador, momento,
 * usuario, acción, recurso, resultado, origen).
 *
 * Dos campos distintos y no intercambiables:
 * - `sujeto`: **quién actuó**.
 * - `titularAfectado`: **sobre los datos de quién**. Sin este campo indexado no
 *   se puede responder "quién miró mi información" (dictamen §4.1,
 *   advertencia 2), y agregarlo después obliga a reprocesar la bitácora.
 */
export interface EventoAuditoria {
  readonly id: IdEventoAuditoria;
  readonly momento: Instante;
  readonly accion: AccionAuditada;
  readonly sujeto: IdUsuario | null;
  readonly titularAfectado: IdUsuario | null;
  readonly tipoRecurso: TipoRecurso | null;
  readonly idRecurso: string | null;
  readonly clasificacion: ClasificacionDato;
  readonly permisoEvaluado: Permiso | null;
  readonly resultado: 'PERMITIDO' | 'DENEGADO' | 'EJECUTADO' | 'FALLIDO';
  readonly motivo: MotivoDenegacion | null;
  readonly origen: OrigenDeLaAccion;
  readonly idCorrelacion: string;
  /** Sólo valores cerrados. Prohibido el texto libre sobre el caso. */
  readonly datos: readonly DatoDeEvento[];
  /** Número de secuencia dentro de la partición. Lo asigna la base. */
  readonly secuencia: bigint;
}

export interface OrigenDeLaAccion {
  readonly sesion: IdSesion | null;
  readonly ip: DireccionIp | null;
  readonly dispositivo: DescripcionDeDispositivo | null;
  readonly canal: 'WEB' | 'MOVIL' | 'API' | 'PROCESO_INTERNO' | 'SIEMBRA';
}

export interface DatoDeEvento {
  readonly clave: string;
  readonly valor: string | number | boolean | null;
}

/**
 * Sello periódico de la bitácora (ADR-028). Raíz de Merkle firmada sobre los
 * eventos de una ventana. Es lo que permite detectar una alteración hecha por
 * alguien con acceso de escritura a la base, que es el escenario contra el que
 * `REVOKE UPDATE, DELETE` no alcanza.
 */
export interface SelloDeBitacora {
  readonly particion: FechaCivil;
  readonly desdeSecuencia: bigint;
  readonly hastaSecuencia: bigint;
  readonly raiz: string;
  readonly algoritmo: 'SHA-256/MERKLE';
  readonly firma: string;
  readonly kid: string;
  readonly momento: Instante;
}

/* ───────────────────────────────────────────────────────────────────────────
 * 5. Estados de la cuenta y de la verificación profesional  [DOMINIO PURO]
 *    (CA-01, CA-05, CA-28, CA-29, CA-30, CA-31 — ver ADR-026)
 * ────────────────────────────────────────────────────────────────────────── */

export type EstadoCuenta =
  | 'NO_VERIFICADA'
  | 'ACTIVA'
  | 'BLOQUEADA_TEMPORALMENTE'
  | 'PENDIENTE_DE_INSCRIPCION_MFA'
  | 'RESTITUCION_MFA_EN_CURSO'
  | 'SUSPENDIDA'
  | 'PURGADA';

export type EstadoMfa =
  | 'NO_CONFIGURADO'
  | 'INSCRIPCION_PENDIENTE_DE_CONFIRMACION'
  | 'ACTIVO'
  | 'BLOQUEADO_POR_RESTITUCION';

/**
 * Estado de la matrícula. **Es un valor derivado, no un campo almacenado.** Se
 * calcula con `derivarEstadoMatricula` a partir de los hechos registrados y del
 * instante de evaluación. Un campo almacenado exigiría un proceso que lo
 * actualice, y un proceso que no corre deja afirmando "verificado" a una
 * matrícula vencida (dictamen §4.4).
 */
export type EstadoVerificacionProfesional =
  | { readonly estado: 'PENDIENTE'; readonly desde: Instante; readonly plazoVencido: boolean }
  | { readonly estado: 'RECHAZADA'; readonly momento: Instante }
  | {
      readonly estado: 'VIGENTE';
      readonly verificadaEn: Instante;
      readonly vigenciaHasta: FechaCivil;
      readonly evidencia: EvidenciaDeMatricula;
    }
  | {
      readonly estado: 'VENCIDA';
      readonly verificadaEn: Instante;
      readonly vigenciaHasta: FechaCivil;
      readonly evidencia: EvidenciaDeMatricula;
    }
  | {
      readonly estado: 'SUSPENDIDA';
      readonly desde: Instante;
      readonly dispuestaPor: IdUsuario;
      readonly motivo: MotivoDeSuspensionDeMatricula;
    };

export type MotivoDeSuspensionDeMatricula =
  | 'NOTIFICACION_DEL_COLEGIO'
  | 'DENUNCIA_RECIBIDA'
  | 'PEDIDO_DEL_PROFESIONAL'
  | 'DECISION_DE_LA_PLATAFORMA';

/**
 * Evidencia que el administrador vio. Salvaguarda M-1: se registra el
 * fundamento, no sólo la decisión. Una verificación sin evidencia **no se puede
 * construir**, porque todos los campos son requeridos.
 */
export interface EvidenciaDeMatricula {
  readonly colegio: string;
  readonly jurisdiccion: Jurisdiccion;
  readonly numeroDeMatricula: string;
  readonly tomoYFolio: string | null;
  readonly claseDeConstancia: ClaseDeConstancia;
  readonly fechaDeLaConstancia: FechaCivil;
  readonly referenciaDelDocumento: string;
  readonly verificadaPor: IdUsuario;
}

export type ClaseDeConstancia =
  | 'CONSTANCIA_EMITIDA_POR_EL_COLEGIO'
  | 'CONSULTA_AL_PADRON_PUBLICO'
  | 'CREDENCIAL_PROFESIONAL'
  | 'OTRA';

/** Jurisdicción de la matrícula. Limita la asignación de casos (M-7, F-09). */
export type Jurisdiccion =
  | 'CABA'
  | 'BUENOS_AIRES'
  | 'CATAMARCA'
  | 'CHACO'
  | 'CHUBUT'
  | 'CORDOBA'
  | 'CORRIENTES'
  | 'ENTRE_RIOS'
  | 'FORMOSA'
  | 'JUJUY'
  | 'LA_PAMPA'
  | 'LA_RIOJA'
  | 'MENDOZA'
  | 'MISIONES'
  | 'NEUQUEN'
  | 'RIO_NEGRO'
  | 'SALTA'
  | 'SAN_JUAN'
  | 'SAN_LUIS'
  | 'SANTA_CRUZ'
  | 'SANTA_FE'
  | 'SANTIAGO_DEL_ESTERO'
  | 'TIERRA_DEL_FUEGO'
  | 'TUCUMAN'
  | 'FEDERAL';

/** Hechos registrados sobre la matrícula de una cuenta. Sólo se agregan. */
export interface HistoriaDeVerificacion {
  readonly solicitadaEn: Instante;
  readonly decisiones: readonly DecisionDeVerificacion[];
  readonly suspensiones: readonly SuspensionDeMatricula[];
}

export interface DecisionDeVerificacion {
  readonly id: IdVerificacionProfesional;
  readonly momento: Instante;
  readonly resultado: 'APROBADA' | 'RECHAZADA';
  readonly evidencia: EvidenciaDeMatricula | null;
  readonly vigenciaHasta: FechaCivil | null;
}

export interface SuspensionDeMatricula {
  readonly desde: Instante;
  readonly hasta: Instante | null;
  readonly dispuestaPor: IdUsuario;
  readonly motivo: MotivoDeSuspensionDeMatricula;
}

/**
 * Deriva el estado a la fecha. Pura y total. Sin efectos, sin reloj: el
 * vencimiento ocurre por el paso del tiempo, no porque una tarea programada lo
 * marque (CA-29, ADR-026).
 */
export declare function derivarEstadoMatricula(
  historia: HistoriaDeVerificacion,
  momento: InstanteDeEvaluacion,
  plazoMaximoDeRevision: DuracionEnSegundos,
): EstadoVerificacionProfesional;

/**
 * Texto de exhibición de la verificación. Salvaguarda M-6: la interfaz **nunca**
 * afirma "verificado" a secas. Devuelve la clave de la plantilla y sus
 * variables; el texto lo escribe `ux-expert` en el catálogo, nunca esta función.
 */
export declare function claveDeExhibicionDeMatricula(
  estado: EstadoVerificacionProfesional,
): { readonly plantilla: string; readonly variables: readonly DatoDeEvento[] };

/* ───────────────────────────────────────────────────────────────────────────
 * 6. Contraseñas  [DOMINIO PURO para la política]  (CA-03, R-02 — ADR-024)
 * ────────────────────────────────────────────────────────────────────────── */

export interface PoliticaDeContrasena {
  readonly longitudMinima: number;
  readonly longitudMaxima: number;
  /** No hay reglas de composición: NIST SP 800-63B. Sólo longitud y listas. */
  readonly rechazaContrasenasFiltradas: true;
  readonly rechazaDatosDelUsuario: true;
}

export type IncumplimientoDePolitica =
  | 'DEMASIADO_CORTA'
  | 'DEMASIADO_LARGA'
  | 'ESTA_EN_LISTA_DE_FILTRADAS'
  | 'CONTIENE_DATOS_DE_LA_CUENTA'
  | 'SOLO_ESPACIOS';

/**
 * Evalúa la política. CA-03: devuelve **el incumplimiento concreto**, uno solo,
 * el primero que corresponda — no la política entera como un desafío a
 * resolver. Es pura: la pertenencia a la lista de filtradas entra como dato.
 */
export declare function evaluarPoliticaDeContrasena(
  contrasena: string,
  datosDeLaCuenta: readonly string[],
  estaEnListaDeFiltradas: boolean,
  politica: PoliticaDeContrasena,
): Resultado<void, IncumplimientoDePolitica>;

/** Normalización previa obligatoria (Unicode NFKC) antes de hashear o comparar. */
export declare function normalizarContrasena(contrasena: string): string;

/* ── Verificación y almacenamiento ─────────────────────────────────── [BORDE] */

/** Parámetros de `argon2id`. Viajan dentro del propio hash en formato PHC. */
export interface ParametrosArgon2id {
  readonly memoriaEnKib: number;
  readonly iteraciones: number;
  readonly paralelismo: number;
  readonly longitudDeSalEnBytes: number;
  readonly longitudDeSalidaEnBytes: number;
}

export interface ServicioDeContrasenas {
  /** Aplica pimienta (HMAC con clave fuera de la base) y luego `argon2id`. */
  hashear(contrasena: string): Promise<string>;
  /**
   * Verifica en **tiempo constante respecto del resultado**. Cuando la cuenta
   * no existe se invoca igual contra `hashSenuelo` (ADR-025).
   */
  verificar(contrasena: string, hashAlmacenado: string): Promise<boolean>;
  /** `true` si el hash quedó con parámetros viejos: se rehashea al ingresar. */
  requiereRehash(hashAlmacenado: string): boolean;
  readonly hashSenuelo: string;
}

export interface PuertoListaDeContrasenasFiltradas {
  /** Consulta **local**. Nunca una API de un tercero: sería una cesión (art. 25). */
  contiene(contrasenaNormalizada: string): Promise<boolean>;
}

/* ───────────────────────────────────────────────────────────────────────────
 * 7. Tokens y sesión  [BORDE]  (CA-07, CA-10 a CA-14 — ADR-020, ADR-021)
 * ────────────────────────────────────────────────────────────────────────── */

export type TokenDeAcceso = string & { readonly __token: 'acceso' };
export type TokenDeRefresco = string & { readonly __token: 'refresco' };

/**
 * Contenido del token de acceso. Es un JWT compacto firmado con EdDSA.
 *
 * **Lo que NO lleva, y no se agrega sin ADR de reemplazo (R-03, D-002-11):**
 * correo, nombre, CUIT/CUIL, rol, lista de permisos, matrícula, jurisdicción,
 * estado de verificación, IP, ubicación, dispositivo, y cualquier dato
 * patrimonial. Los permisos se derivan por petición (§3): un permiso dentro del
 * token sobreviviría a su revocación hasta el vencimiento, y CA-30 exige efecto
 * inmediato.
 */
export interface ContenidoTokenDeAcceso {
  readonly iss: string;
  readonly aud: 'mejorar-api';
  readonly sub: IdUsuario;
  readonly sid: IdSesion;
  readonly jti: string;
  readonly iat: number;
  readonly nbf: number;
  readonly exp: number;
  readonly aut: NivelAutenticacion;
  /** Segundos desde época en que se completó la autenticación de la sesión. */
  readonly auth_time: number;
}

export interface CabeceraTokenDeAcceso {
  readonly alg: 'EdDSA';
  readonly typ: 'at+jwt';
  readonly kid: string;
}

/**
 * El token de refresco **no es un JWT**: es una cadena opaca
 * `<idFamilia>.<secreto>`, con 256 bits de aleatoriedad en el secreto. Se
 * guarda como HMAC-SHA-256 del secreto; el `idFamilia` permite la búsqueda sin
 * recorrer la tabla.
 */
export interface RefrescoEmitido {
  readonly token: TokenDeRefresco;
  readonly familia: IdFamiliaRefresco;
  readonly sesion: IdSesion;
  readonly emitidoEn: Instante;
  readonly venceEn: Instante;
  readonly generacion: number;
}

export interface ParDeTokens {
  readonly acceso: TokenDeAcceso;
  readonly venceAcceso: Instante;
  readonly refresco: TokenDeRefresco;
  readonly venceRefresco: Instante;
}

export type ResultadoDeRefresco =
  | { readonly clase: 'ROTADO'; readonly tokens: ParDeTokens }
  /** CA-11: no es un error de entrada, es un incidente. Corta todo y notifica. */
  | {
      readonly clase: 'REUTILIZACION_DETECTADA';
      readonly familia: IdFamiliaRefresco;
      readonly sesionesRevocadas: number;
    }
  | { readonly clase: 'NO_ACEPTABLE' };

/**
 * Estado de la sesión, tal como lo ve su dueño (CA-13). La IP y la ubicación
 * son datos personales tratados (R-09): se muestran al titular, se conservan
 * por el plazo de `retencion.sesionCerrada` y se purgan.
 */
export interface SesionVisible {
  readonly id: IdSesion;
  readonly creadaEn: Instante;
  readonly ultimoUso: Instante;
  readonly dispositivo: DescripcionDeDispositivo | null;
  readonly ubicacion: UbicacionAproximada | null;
  readonly esLaActual: boolean;
}

export type DireccionIp = string & { readonly __dato: 'ip' };

export interface DescripcionDeDispositivo {
  /** Categorías cerradas: no se guarda el agente de usuario crudo. */
  readonly clase: 'ESCRITORIO' | 'TELEFONO' | 'TABLETA' | 'APLICACION_MOVIL' | 'DESCONOCIDO';
  readonly sistema: string | null;
  readonly navegador: string | null;
}

export interface UbicacionAproximada {
  readonly pais: string | null;
  readonly provincia: string | null;
  readonly fuente: 'BASE_LOCAL';
}

/**
 * Verificación de vigencia de la sesión en **cada** petición (CA-14). El
 * conjunto de sesiones revocadas es un índice negativo: se escribe al revocar y
 * expira con el token. Si el índice no está disponible, se consulta la base —
 * **nunca** se asume vigente (falla cerrado).
 */
export interface IndiceDeRevocacion {
  estaRevocada(sesion: IdSesion): Promise<boolean>;
  revocar(sesion: IdSesion, hasta: Instante): Promise<void>;
  revocarTodasLasDe(usuario: IdUsuario, hasta: Instante): Promise<void>;
}

/* ───────────────────────────────────────────────────────────────────────────
 * 8. Segundo factor  (CA-08, CA-32, CA-35, CA-38, CA-39 — ADR-023, ADR-027)
 * ────────────────────────────────────────────────────────────────────────── */

export type MetodoSegundoFactor = 'TOTP' | 'CODIGO_DE_RESPALDO';

export interface ParametrosTotp {
  readonly algoritmo: 'SHA1';
  readonly digitos: 6;
  readonly pasoEnSegundos: 30;
  /** Tolerancia de ±1 paso. No se amplía sin ADR: amplía la ventana de robo. */
  readonly ventanaDePasos: 1;
  readonly longitudDelSecretoEnBytes: 20;
}

/**
 * Exigencia de segundo factor por rol. **No es configuración: es una función.**
 * El literal de tipo es lo que hace imposible apagarlo para `ADMINISTRADOR`
 * (CA-32): `ExigeSegundoFactor<'ADMINISTRADOR'>` es el literal `true`, y no hay
 * ninguna clave en el esquema de configuración de arranque que lo contradiga —
 * no existe la clave (ADR-023, mismo mecanismo que ADR-013).
 */
export type ExigeSegundoFactor<R extends Rol> = R extends 'ADMINISTRADOR'
  ? true
  : R extends 'ABOGADO'
    ? true
    : false;

export declare function exigeSegundoFactor<R extends Rol>(rol: R): ExigeSegundoFactor<R>;

/** Inscripción en dos pasos: el secreto no se activa hasta probar un código. */
export interface InscripcionMfa {
  readonly secretoBase32: string;
  readonly uriDeAprovisionamiento: string;
  readonly venceEn: Instante;
}

export interface CodigosDeRespaldo {
  /** Se muestran **una sola vez**. Se guardan con HMAC-SHA-256 y sal por código. */
  readonly codigos: readonly string[];
  readonly generadosEn: Instante;
}

export interface EstadoDeCodigosDeRespaldo {
  readonly restantes: number;
  readonly generadosEn: Instante | null;
}

/**
 * Desafío de ingreso (CA-08). Se emite **siempre**, exista o no la cuenta y sea
 * o no correcta la contraseña: es lo que impide que la respuesta del primer
 * paso revele algo (ADR-025). Para una cuenta inexistente, `siguientePaso` se
 * deriva de forma determinista del identificador, para que la ausencia de
 * desafío tampoco sea una señal.
 */
export interface DesafioDeIngreso {
  readonly id: IdDesafio;
  readonly siguientePaso: 'SEGUNDO_FACTOR' | 'CONFIRMAR';
  readonly metodosAdmitidos: readonly MetodoSegundoFactor[];
  readonly venceEn: Instante;
}

export interface ServicioDeSegundoFactor {
  verificarTotp(secretoCifrado: string, codigo: string, momento: Instante): Promise<boolean>;
  consumirCodigoDeRespaldo(usuario: IdUsuario, codigo: string): Promise<boolean>;
}

/* ── Restitución del segundo factor perdido (CA-35) ───────────────── [BORDE] */

export type EstadoSolicitudRestitucion =
  | 'RECIBIDA'
  | 'ESPERANDO_VERIFICACION_DE_IDENTIDAD'
  | 'EN_ESPERA_OBLIGATORIA'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'CANCELADA_POR_EL_TITULAR';

export interface SolicitudDeRestitucionMfa {
  readonly id: IdSolicitudRestitucionMfa;
  readonly titular: IdUsuario;
  readonly estado: EstadoSolicitudRestitucion;
  readonly solicitadaEn: Instante;
  readonly esperaHasta: Instante | null;
  /** Dos personas distintas para `ABOGADO` y `ADMINISTRADOR` (ADR-027). */
  readonly instruidaPor: IdUsuario | null;
  readonly aprobadaPor: IdUsuario | null;
  readonly verificacion: ConstanciaDeVerificacionDeIdentidad | null;
  readonly documentacionDestruidaEn: Instante | null;
}

/**
 * Lo único que sobrevive al cierre del caso. La documentación en sí se destruye
 * (dictamen §5.B, `retencion.documentacionRecuperacionMFA`): acá queda **que**
 * la verificación ocurrió, quién la hizo y de qué clase fue, nunca el documento
 * ni su contenido.
 */
export interface ConstanciaDeVerificacionDeIdentidad {
  readonly claseDeComprobacion: ClaseDeComprobacionDeIdentidad;
  readonly verificadaPor: IdUsuario;
  readonly momento: Instante;
  readonly resultado: 'COINCIDE' | 'NO_COINCIDE' | 'INSUFICIENTE';
}

/**
 * `[PENDIENTE — escalamiento E-4 del plan]` El catálogo concreto de
 * comprobaciones admisibles y su base legal los define `compliance-legal` con
 * el product owner. El contrato declara la forma para que el circuito no opere
 * sin registro, no para cerrar la decisión.
 */
export type ClaseDeComprobacionDeIdentidad =
  | 'A_DEFINIR_EN_G2'
  | 'CANAL_ALTERNATIVO_YA_REGISTRADO'
  | 'VIDEOLLAMADA_CON_OPERADOR'
  | 'DOCUMENTO_DE_IDENTIDAD';

/* ───────────────────────────────────────────────────────────────────────────
 * 9. Alta, no-revelación y bloqueo  [DOMINIO PURO + BORDE]
 *    (CA-01 a CA-06, CA-09, CA-15 a CA-17, CA-36, CA-37 — ADR-025)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Respuesta única de todos los caminos que no deben revelar existencia: alta,
 * pedido de recuperación, uso de enlace, primer paso del ingreso. **Misma
 * forma, mismo código de estado, mismo tamaño y mismo piso de latencia**, exista
 * o no la cuenta (R-05, CA-02, CA-04, CA-06, CA-15, CA-17).
 */
export interface RespuestaUniforme {
  readonly estado: 'PROCESADO';
  /** Clave de plantilla. El texto está en el catálogo de `ux-expert`. */
  readonly mensaje: string;
}

/**
 * Identificador de tráfico derivado del correo o del CUIT/CUIL con
 * HMAC + clave del servidor. Es la clave con la que se cuentan los intentos
 * fallidos y se aplica el bloqueo **también para cuentas inexistentes**: si sólo
 * se contaran las existentes, el propio bloqueo sería el oráculo de
 * enumeración (ADR-025).
 */
export type ClaveDeTrafico = string & { readonly __clave: 'trafico' };

export interface PoliticaDeBloqueo {
  readonly umbralDeIntentos: number;
  readonly ventana: DuracionEnSegundos;
  readonly duracionDelBloqueo: DuracionEnSegundos;
  /**
   * CA-36 / recaudo A-1. Literal `true`: el bloqueo por intentos fallidos
   * **nunca** inhabilita la recuperación de contraseña. Es un literal y no un
   * booleano configurable justamente para que no se pueda poner en `false`.
   */
  readonly laRecuperacionSiempreDisponible: true;
}

export type DecisionDeBloqueo =
  | { readonly clase: 'PERMITIR' }
  | { readonly clase: 'DEMORAR'; readonly demora: DuracionEnSegundos }
  | { readonly clase: 'BLOQUEAR'; readonly hasta: Instante };

/** Pura: recibe el historial de intentos y decide. Sin reloj, sin base. */
export declare function decidirBloqueo(
  intentosFallidos: readonly Instante[],
  politica: PoliticaDeBloqueo,
  momento: InstanteDeEvaluacion,
): DecisionDeBloqueo;

/** Enlace de un solo uso (confirmación de correo, recuperación). */
export interface EnlaceDeUnSoloUso {
  readonly proposito: 'CONFIRMACION_DE_CORREO' | 'RECUPERACION_DE_CONTRASENA';
  readonly venceEn: Instante;
  readonly usadoEn: Instante | null;
  readonly invalidadoEn: Instante | null;
}

/**
 * Validación del CUIT/CUIL. Reutiliza `shared/src/identidad/cuit.ts`, que ya
 * existe en el dominio (CA-04). La detección de duplicado **no** ocurre en la
 * respuesta sincrónica: ver `ResolucionDeDuplicado`.
 */
export declare function verificarDigitoVerificadorCuit(valor: string): boolean;

/**
 * CA-04: el duplicado de CUIT/CUIL se resuelve **por el canal del titular
 * real**, nunca en la respuesta a quien se registra. La segunda alta se crea
 * `NO_VERIFICADA` como cualquier otra y se resuelve fuera del camino de
 * respuesta.
 */
export interface ResolucionDeDuplicado {
  readonly clase: 'CORREO' | 'CUIT_CUIL';
  readonly notificadoAlTitularEn: Instante;
  readonly altaSecundaria: IdUsuario;
  readonly resultado: 'PENDIENTE' | 'DESCARTADA' | 'CONFIRMADA_POR_EL_TITULAR';
}

/* ───────────────────────────────────────────────────────────────────────────
 * 10. Información del art. 6 y aceptación versionada  (CA-26, CA-27)
 * ────────────────────────────────────────────────────────────────────────── */

export type ClaseDeDocumentoAceptable = 'TERMINOS_Y_CONDICIONES' | 'POLITICA_DE_PRIVACIDAD';

export interface VersionDeDocumento {
  readonly clase: ClaseDeDocumentoAceptable;
  readonly version: string;
  readonly hashDelTexto: string;
  readonly vigenteDesde: Instante;
  readonly vigenteHasta: Instante | null;
  /**
   * Literal `false`: el alcance de estos documentos **no** incluye consulta a
   * bureaus, cesión a terceros ni comunicaciones comerciales (C-002-02). Si
   * alguna vez lo incluyera, el tipo dejaría de compilar y habría que pasar
   * por compuerta, que es exactamente lo que se quiere.
   */
  readonly incluyeFinalidadesDeLa003: false;
}

/**
 * CA-27. **No existe un campo booleano de aceptación en ningún lado.** Esta es
 * la única forma en que una aceptación puede representarse.
 */
export interface AceptacionRegistrada {
  readonly id: IdAceptacion;
  readonly titular: IdUsuario;
  readonly documento: VersionDeDocumento;
  readonly momento: Instante;
  readonly ip: DireccionIp;
  readonly canal: 'WEB' | 'MOVIL';
  readonly casillaMarcada: string;
}

/**
 * Bloques del art. 6 de la Ley 25.326 que la pantalla de alta debe mostrar
 * antes de confirmar (CA-26). El contrato exige que **existan y estén
 * versionados**; el texto lo escribe `ux-expert` y lo ratifica el abogado.
 */
export interface InformacionArticulo6 {
  readonly version: string;
  readonly hashDelTexto: string;
  readonly responsable: { readonly razonSocial: string; readonly domicilio: string };
  readonly campos: readonly CampoDeclaradoEnElAlta[];
  readonly destinatarios: readonly string[];
  readonly canalDeEjercicioDeDerechos: string;
}

export interface CampoDeclaradoEnElAlta {
  readonly campo: 'CORREO' | 'CONTRASENA' | 'NOMBRE_PARA_MOSTRAR' | 'CUIT_CUIL' | 'MATRICULA' | 'JURISDICCION';
  /** Inciso c) del art. 6. El que más se olvida (dictamen §3). */
  readonly caracter: 'OBLIGATORIO' | 'FACULTATIVO';
  readonly claveDeFinalidad: string;
  readonly consecuenciaDeNoDarlo: string;
}

/* ───────────────────────────────────────────────────────────────────────────
 * 11. Retención y purga  (CA-28)
 * ────────────────────────────────────────────────────────────────────────── */

export type ClaveDeRetencion =
  | 'cuentaNoVerificada'
  | 'enlaceConfirmacion'
  | 'enlaceRecuperacion'
  | 'tokenRefrescoUsado'
  | 'intentosFallidos'
  | 'sesionCerrada'
  | 'desafioDeIngreso'
  | 'documentacionRestitucionMfa'
  | 'bitacoraAuditoria';

export interface ReglaDeRetencion {
  readonly clave: ClaveDeRetencion;
  readonly plazo: DuracionEnSegundos | null;
  readonly accion: 'PURGA_FISICA' | 'ANONIMIZACION' | 'A_DETERMINAR';
  readonly fundamento: string;
  /** Constitución #11: ninguna regla con fundamento normativo se da por firme. */
  readonly requiereValidacionProfesional: boolean;
}

export interface ResultadoDePurga {
  readonly clave: ClaveDeRetencion;
  readonly registrosAlcanzados: number;
  readonly momento: Instante;
  readonly evento: IdEventoAuditoria;
}

/* ───────────────────────────────────────────────────────────────────────────
 * 12. Exportación de datos propios  (CA-25)
 *
 * Misma técnica que ADR-015: lo que no debe salir **no compila**.
 * ────────────────────────────────────────────────────────────────────────── */

export type ClaveSecretaProhibidaEnExportacion =
  | 'hashContrasena'
  | 'hashDeContrasena'
  | 'contrasena'
  | 'pimienta'
  | 'secretoTotp'
  | 'secretoBase32'
  | 'codigosDeRespaldo'
  | 'hashCodigoDeRespaldo'
  | 'tokenDeRefresco'
  | 'refresco'
  | 'hashDeRefresco'
  | 'clavePrivada'
  | 'claveDeCifrado';

export type ContieneClaveSecreta<T> = T extends readonly (infer U)[]
  ? ContieneClaveSecreta<U>
  : T extends object
    ? Extract<keyof T, ClaveSecretaProhibidaEnExportacion> extends never
      ? { [K in keyof T]: ContieneClaveSecreta<T[K]> }[keyof T]
      : true
    : never;

/** `never` si el tipo contiene una clave secreta a cualquier profundidad. */
export type SinSecretos<T> = true extends ContieneClaveSecreta<T> ? never : T;

export interface DatosExportados {
  readonly generadoEn: Instante;
  readonly titular: IdUsuario;
  readonly identidad: {
    readonly correo: string;
    readonly nombreParaMostrar: string;
    readonly rol: Rol;
    readonly creadaEn: Instante;
  };
  readonly sesiones: readonly SesionVisible[];
  readonly aceptaciones: readonly AceptacionRegistrada[];
  readonly eventos: readonly EventoAuditoria[];
}

export declare function exportarDatosPropios<T extends DatosExportados>(
  datos: T & SinSecretos<T>,
): Resultado<IdExportacion, ErrorIdentidad>;

/* ───────────────────────────────────────────────────────────────────────────
 * 13. Puertos de terceros  [PUERTO]  (R-09, C-002-10 — ADR-029)
 *
 * Cada puerto tiene mock determinista obligatorio. El sistema completo corre
 * end to end sin una sola credencial (criterio 3 del mandato del arquitecto).
 * ────────────────────────────────────────────────────────────────────────── */

export type ClavePlantillaCorreo =
  | 'CONFIRMACION_DE_CORREO'
  | 'INTENTO_DE_ALTA_CON_CORREO_YA_REGISTRADO'
  | 'INTENTO_DE_ALTA_CON_CUIT_YA_REGISTRADO'
  | 'RECUPERACION_DE_CONTRASENA'
  | 'CONTRASENA_CAMBIADA'
  | 'CUENTA_BLOQUEADA_TEMPORALMENTE'
  | 'REUTILIZACION_DE_REFRESCO'
  | 'SESION_CERRADA_A_DISTANCIA'
  | 'SEGUNDO_FACTOR_ACTIVADO'
  | 'SEGUNDO_FACTOR_DESACTIVADO'
  | 'RESTITUCION_MFA_EN_CURSO'
  | 'RESTITUCION_MFA_RESUELTA'
  | 'MATRICULA_POR_VENCER'
  | 'MATRICULA_VENCIDA'
  | 'MATRICULA_SUSPENDIDA'
  | 'CUENTA_ADMINISTRADORA_CREADA';

/**
 * Todo correo de esta feature es **accionable** (C-002-06): lleva al menos una
 * acción concreta. El tipo lo exige: `acciones` no puede estar vacío.
 */
export interface MensajeTransaccional {
  readonly plantilla: ClavePlantillaCorreo;
  readonly destinatario: string;
  readonly variables: readonly DatoDeEvento[];
  readonly acciones: readonly [AccionDeCorreo, ...AccionDeCorreo[]];
  /** Constitución #12. Dos avisos iguales por el mismo hecho son ruido y alarma. */
  readonly claveDeIdempotencia: string;
}

export interface AccionDeCorreo {
  readonly clave: 'INGRESAR' | 'RECUPERAR_CONTRASENA' | 'CONFIRMAR' | 'PEDIR_ENLACE_NUEVO' | 'VER_SESIONES' | 'CONTACTAR_SOPORTE';
  readonly url: string;
}

export interface PuertoCorreoTransaccional {
  enviar(mensaje: MensajeTransaccional): Promise<Resultado<ConstanciaDeEnvio, ErrorIdentidad>>;
}

export interface ConstanciaDeEnvio {
  readonly idDelProveedor: string | null;
  readonly momento: Instante;
  readonly modo: 'MOCK' | 'SMTP_LOCAL' | 'PROVEEDOR';
}

/**
 * Resolución IP → ubicación aproximada. **Resolución local obligatoria**: la
 * implementación consulta una base descargada, no envía la IP a nadie
 * (dictamen §2.2.b). Por eso el resultado es grueso: país y provincia.
 */
export interface PuertoUbicacionPorIp {
  resolver(ip: DireccionIp): Promise<UbicacionAproximada | null>;
  readonly versionDeLaBase: string;
}

export interface PuertoDescripcionDeDispositivo {
  /** Analiza el agente de usuario **y lo descarta**: sólo devuelve categorías. */
  describir(agenteDeUsuario: string): DescripcionDeDispositivo;
}

/** El reloj es un puerto porque el dominio no lo lee (ADR-016, ADR-009 capa 2). */
export interface PuertoReloj {
  ahora(): Instante;
}

/* ───────────────────────────────────────────────────────────────────────────
 * 14. Borde HTTP  [BORDE]  (CA-12, CA-20)
 *
 * El detalle de rutas está en `plan.md` §3. Acá van las formas que cruzan el
 * borde y las reglas de respuesta que sostienen la no-revelación.
 * ────────────────────────────────────────────────────────────────────────── */

export interface PeticionDeAlta {
  readonly correo: string;
  readonly contrasena: string;
  readonly nombreParaMostrar: string;
  readonly rolSolicitado: 'CLIENTE' | 'ABOGADO';
  readonly cuitCuil: string | null;
  readonly matricula: string | null;
  readonly jurisdiccion: Jurisdiccion | null;
  readonly aceptaciones: readonly {
    readonly clase: ClaseDeDocumentoAceptable;
    readonly version: string;
    readonly hashDelTexto: string;
  }[];
  readonly versionInformacionArticulo6: string;
}

export interface PeticionPrimerPasoDeIngreso {
  readonly correo: string;
  readonly contrasena: string;
}

export interface PeticionSegundoPasoDeIngreso {
  readonly desafio: IdDesafio;
  readonly metodo: MetodoSegundoFactor | null;
  readonly codigo: string | null;
}

export interface PeticionDeRefresco {
  readonly refresco: TokenDeRefresco | null;
}

/**
 * Códigos de respuesta admitidos en los caminos de autenticación. La lista es
 * corta a propósito: cada código adicional es un bit de información para quien
 * enumera.
 *
 * - `202` para todo camino de no-revelación (alta, recuperación, primer paso).
 * - `401` indistinto para credencial inválida, token vencido y token inválido
 *   (CA-12). La distinción existe **sólo** en la bitácora interna.
 * - `403` para autorización denegada (CA-20), incluido el recurso que existe
 *   pero no es del sujeto. No se usa `404` para disimular: con identificadores
 *   opacos no hay enumeración posible y `403` es lo que pide el criterio.
 * - `429` con las mismas cabeceras exista o no la cuenta.
 */
export type CodigoDeRespuestaDeAutenticacion = 200 | 202 | 401 | 403 | 429;

export interface RespuestaDeError {
  readonly error: 'NO_AUTENTICADO' | 'NO_AUTORIZADO' | 'DEMASIADOS_INTENTOS' | 'ENTRADA_INVALIDA';
  readonly mensaje: string;
  readonly idCorrelacion: string;
}

/**
 * Presupuesto de latencia uniforme de los caminos de no-revelación (ADR-025).
 * La respuesta no se emite antes de `pisoEnMilisegundos` contados desde el
 * ingreso de la petición. El ruido aleatorio va **además** del piso, nunca en
 * lugar del piso: promediar anula el ruido, no anula el piso.
 */
export interface PresupuestoDeLatencia {
  readonly pisoEnMilisegundos: number;
  readonly ruidoMaximoEnMilisegundos: number;
  /** Si el trabajo real excede el piso, se registra: el piso quedó chico. */
  readonly alertarSiExcede: true;
}

/* ───────────────────────────────────────────────────────────────────────────
 * 15. Frontera con persistencia
 *
 * Declaraciones de lo que `database-engineer` tiene que sostener. El modelo
 * concreto es suyo (`modelo-datos.md`); acá sólo la forma que el resto del
 * sistema espera. Ver `plan.md` §5 para la lista completa de obligaciones.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Índice ciego sobre un identificador que no puede guardarse en claro ni
 * consultarse por igualdad sin revelarlo: HMAC con clave fuera de la base.
 * Es lo que permite detectar el CUIT/CUIL duplicado sin exponerlo (CA-04).
 */
export type IndiceCiego = string & { readonly __indice: 'ciego' };

export interface ServicioDeIndiceCiego {
  calcular(valorNormalizado: string, dominio: 'CORREO' | 'CUIT_CUIL'): IndiceCiego;
}

/**
 * Lo que la capa de persistencia expone al resto de `apps/api`. **Todos** los
 * métodos exigen la prueba de autorización: no hay forma de leer un perfil sin
 * haber autorizado la lectura de ese perfil.
 */
export interface ConsultasDeIdentidad {
  leerPerfil(
    autorizacion: Autorizacion<'perfil.leer.propio' | 'usuario.leer', 'PERFIL'>,
  ): Promise<Resultado<PerfilVisible, ErrorIdentidad>>;

  listarSesiones(
    filtro: FiltroDeAlcance<'sesion.listar.propia', 'SESION'>,
  ): Promise<readonly SesionVisible[]>;

  cerrarSesion(
    autorizacion: Autorizacion<'sesion.cerrar.propia', 'SESION'>,
  ): Promise<Resultado<void, ErrorIdentidad>>;

  listarEventos(
    filtro: FiltroDeAlcance<'auditoria.leer.propia' | 'auditoria.leer.total', 'EVENTO_AUDITORIA'>,
    pagina: Paginacion,
  ): Promise<readonly EventoAuditoria[]>;

  verificarMatricula(
    autorizacion: Autorizacion<'matricula.verificar', 'VERIFICACION_PROFESIONAL'>,
    evidencia: EvidenciaDeMatricula,
    vigenciaHasta: FechaCivil,
  ): Promise<Resultado<IdVerificacionProfesional, ErrorIdentidad>>;

  suspenderMatricula(
    autorizacion: Autorizacion<'matricula.suspender', 'VERIFICACION_PROFESIONAL'>,
    motivo: MotivoDeSuspensionDeMatricula,
  ): Promise<Resultado<void, ErrorIdentidad>>;

  crearAdministrador(
    autorizacion: Autorizacion<'usuario.crearAdministrador', 'USUARIO'>,
    alta: AltaDeAdministrador,
  ): Promise<Resultado<IdUsuario, ErrorIdentidad>>;
}

export interface Paginacion {
  readonly desde: string | null;
  readonly cantidad: number;
}

export interface PerfilVisible {
  readonly id: IdUsuario;
  readonly correo: string;
  readonly nombreParaMostrar: string;
  readonly rol: Rol;
  readonly estadoCuenta: EstadoCuenta;
  readonly estadoMfa: EstadoMfa;
  readonly cuitCuil: string | null;
  readonly matricula: string | null;
  readonly jurisdiccion: Jurisdiccion | null;
  readonly verificacion: EstadoVerificacionProfesional | null;
  readonly especialidades: readonly string[];
}

/**
 * CA-33: toda cuenta administradora corresponde a una persona humana
 * identificada. No hay alta de administrador sin nombre y sin correo nominal;
 * el tipo no admite una cuenta genérica, y una regla de validación rechaza los
 * buzones de rol conocidos (`admin@`, `soporte@`, `info@`…).
 */
export interface AltaDeAdministrador {
  readonly correoNominal: string;
  readonly nombreCompleto: string;
  readonly documentoDeDesignacion: string;
  readonly creadoPor: IdUsuario | 'SIEMBRA_INICIAL';
}
