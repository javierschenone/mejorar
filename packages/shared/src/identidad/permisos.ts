/**
 * Roles, permisos y derivación — contrato §2, **ADR-022** capas 1 y 2.
 * Criterios CA-18, CA-29, CA-30, CA-32, CA-38, CA-39; regla R-07.
 *
 * Dos ideas que conviene tener presentes al leer:
 *
 * 1. **El rol es sólo el conjunto de permisos que trae por defecto.** Este
 *    archivo es el único lugar del sistema donde una decisión mira el nombre
 *    del rol; de acá para afuera todo se evalúa por permiso concreto. El
 *    `ContextoDeAcceso` ni siquiera tiene campo `rol`.
 * 2. **Los permisos se derivan, no se transportan.** `derivarPermisos` es
 *    pura, total y determinista, y se evalúa **por petición**. Por eso CA-30
 *    —suspender una matrícula corta el acceso al instante— se cumple sin
 *    esperar a que venza ningún token: basta con invalidar la caché del perfil
 *    por versión, que es trabajo del borde (ADR-022 capa 2), y la petición
 *    siguiente ya deriva otro conjunto.
 */

import type {
  AjusteDePermiso,
  EstadoCuenta,
  EstadoVerificacionProfesional,
  InstanteDeEvaluacion,
  PerfilDeAutorizacion,
  Permiso,
  Rol,
} from './contrato/v1';
import { milisegundosDe } from './tiempo';

/* ───────────────────────────────────────────────────────────────────────────
 * Mapa rol → permisos por defecto
 * ────────────────────────────────────────────────────────────────────────── */

/** Permisos del trabajo profesional. La vigencia de la matrícula los gobierna. */
export const PERMISOS_DE_TRABAJO_PROFESIONAL: readonly Permiso[] = [
  'caso.leer.asignado',
  'caso.actuar.asignado',
  'caso.recibirAsignacion',
];

/**
 * Lo único que puede hacer una cuenta de rol profesional que todavía no
 * inscribió su segundo factor (ADR-023 cerrojo 4). No incluye pedir la
 * restitución del factor perdido porque esa ruta **no** está autenticada
 * (`plan.md` §3.2): quien perdió el factor no tiene sesión que autorizar.
 */
export const PERMISOS_DE_INSCRIPCION_DE_SEGUNDO_FACTOR: readonly Permiso[] = ['mfa.inscribir.propio'];

/**
 * Mapa rol → permisos por defecto (CA-18). Es **una tabla de datos**, no
 * código: se lee sin levantar infraestructura y un test verifica sus
 * invariantes.
 *
 * Invariante de CA-32 y CA-38 (ADR-023, cerrojo 3): ni `ADMINISTRADOR` ni
 * `ABOGADO` tienen `'mfa.desactivar.propio'`. El endpoint de desactivación no
 * puede autorizarse para ellos porque no hay permiso que autorizar, aunque
 * alguien llame a la ruta. Cambiar de teléfono no se resuelve desactivando: se
 * reinscribe con `'mfa.inscribir.propio'` y reautenticación fuerte.
 */
export const mapaRolPermisos: Readonly<Record<Rol, readonly Permiso[]>> = {
  CLIENTE: [
    'perfil.leer.propio',
    'perfil.editar.propio',
    'perfil.exportar.propio',
    'contrasena.cambiar.propia',
    'mfa.inscribir.propio',
    // Único rol con desactivación, y aun así exige reautenticación fuerte
    // (CA-39, recaudo B-3).
    'mfa.desactivar.propio',
    'mfa.regenerarCodigosDeRespaldo.propio',
    'sesion.listar.propia',
    'sesion.cerrar.propia',
    'auditoria.leer.propia',
    'restitucionMfa.solicitar.propia',
  ],
  ABOGADO: [
    'perfil.leer.propio',
    'perfil.editar.propio',
    'perfil.exportar.propio',
    'perfil.declararEspecialidades.propio',
    'contrasena.cambiar.propia',
    'mfa.inscribir.propio',
    'mfa.regenerarCodigosDeRespaldo.propio',
    'sesion.listar.propia',
    'sesion.cerrar.propia',
    'auditoria.leer.propia',
    'restitucionMfa.solicitar.propia',
    ...PERMISOS_DE_TRABAJO_PROFESIONAL,
  ],
  ADMINISTRADOR: [
    'perfil.leer.propio',
    'perfil.editar.propio',
    'perfil.exportar.propio',
    'contrasena.cambiar.propia',
    'mfa.inscribir.propio',
    'mfa.regenerarCodigosDeRespaldo.propio',
    'sesion.listar.propia',
    'sesion.cerrar.propia',
    'auditoria.leer.propia',
    'auditoria.leer.total',
    'usuario.listar',
    'usuario.leer',
    'usuario.crearAdministrador',
    'usuario.suspender',
    'matricula.leer',
    'matricula.verificar',
    'matricula.suspender',
    'restitucionMfa.solicitar.propia',
    'restitucionMfa.instruir',
    'restitucionMfa.aprobar',
  ],
};

/**
 * Permisos que **ningún ajuste individual puede conceder**, por rol. Es el
 * quinto cerrojo del MFA no configurable: sin esta lista, un administrador con
 * el permiso `usuario.suspender` podría concederse a sí mismo —o a otro
 * administrador— `'mfa.desactivar.propio'` mediante un `AjusteDePermiso`, y
 * los cuatro cerrojos de ADR-023 quedarían sorteados por la puerta de atrás
 * que el propio contrato abre en §2 para las excepciones del roster.
 */
export const PERMISOS_NO_CONCEDIBLES_POR_AJUSTE: Readonly<Record<Rol, readonly Permiso[]>> = {
  CLIENTE: [],
  ABOGADO: ['mfa.desactivar.propio'],
  ADMINISTRADOR: ['mfa.desactivar.propio'],
};

/**
 * Permisos que conserva una cuenta no operativa, para que nunca quede sin
 * salida (CA-36, recaudo A-1, art. 8 bis de la Ley 24.240).
 *
 * Las salidas de verdad —confirmar el correo, recuperar la contraseña, pedir
 * la restitución del segundo factor— son rutas **sin autenticación**, así que
 * no dependen de esta tabla. Lo que esta tabla evita es la otra cara del
 * callejón: que alguien con sesión abierta y cuenta no operativa vea un portal
 * en blanco, sin siquiera poder cerrar la sesión ni entender qué le pasa.
 */
export const permisosDeCuentaNoOperativa: Readonly<
  Record<Exclude<EstadoCuenta, 'ACTIVA'>, readonly Permiso[]>
> = {
  // Todavía no confirmó el correo: ve su perfil y puede cerrar sesión. Nada más.
  NO_VERIFICADA: ['perfil.leer.propio', 'sesion.listar.propia', 'sesion.cerrar.propia'],
  // El bloqueo por intentos fallidos no toca la recuperación (CA-36), que no
  // pasa por acá. Con sesión abierta, sólo puede cerrarla.
  BLOQUEADA_TEMPORALMENTE: ['perfil.leer.propio', 'sesion.listar.propia', 'sesion.cerrar.propia'],
  // Cuenta profesional recién creada o sembrada: inoperante hasta inscribir su
  // segundo factor (ADR-023, obligación F-14), pero tiene que poder inscribirlo.
  PENDIENTE_DE_INSCRIPCION_MFA: [
    'perfil.leer.propio',
    'mfa.inscribir.propio',
    'sesion.listar.propia',
    'sesion.cerrar.propia',
  ],
  RESTITUCION_MFA_EN_CURSO: ['perfil.leer.propio', 'sesion.listar.propia', 'sesion.cerrar.propia'],
  // Suspendida por la plataforma: conserva el derecho de acceso a sus propios
  // datos (Ley 25.326, art. 14), que no se pierde por estar suspendida.
  SUSPENDIDA: ['perfil.leer.propio', 'perfil.exportar.propio', 'sesion.cerrar.propia'],
  // Purgada: ya no hay datos que mostrar (CA-28).
  PURGADA: [],
};

/* ───────────────────────────────────────────────────────────────────────────
 * Derivación
 * ────────────────────────────────────────────────────────────────────────── */

function ajusteVigente(ajuste: AjusteDePermiso, momento: InstanteDeEvaluacion): boolean {
  const ahora = milisegundosDe(momento);
  if (milisegundosDe(ajuste.momento) > ahora) return false;
  return ajuste.vigenciaHasta === null || milisegundosDe(ajuste.vigenciaHasta) >= ahora;
}

function ordenarPorMomento(ajustes: readonly AjusteDePermiso[]): readonly AjusteDePermiso[] {
  return [...ajustes].sort(
    (uno: AjusteDePermiso, otro: AjusteDePermiso) =>
      milisegundosDe(uno.momento) - milisegundosDe(otro.momento),
  );
}

/**
 * ¿La cuenta tiene un segundo factor efectivamente activo?
 *
 * Se expone porque `decidirAcceso` lo necesita y el `ContextoDeAcceso` no
 * lleva `estadoMfa` (ADR-022 capa 1: el contexto es deliberadamente pobre).
 * El puente es el permiso `'mfa.regenerarCodigosDeRespaldo.propio'`, que
 * `derivarPermisos` retira cuando el segundo factor no está activo: regenerar
 * códigos de respaldo de un factor que no existe no significa nada. Así, la
 * presencia de ese permiso en el conjunto derivado equivale a "esta cuenta
 * tiene segundo factor activo", y la equivalencia está cubierta por test.
 */
export function elSegundoFactorEstaActivo(permisos: ReadonlySet<Permiso>): boolean {
  return permisos.has('mfa.regenerarCodigosDeRespaldo.propio');
}

/** ¿Este estado de matrícula habilita a trabajar como profesional? */
function permisosProfesionalesQueSeRetiran(
  verificacion: EstadoVerificacionProfesional | null,
): readonly Permiso[] {
  if (verificacion === null) return PERMISOS_DE_TRABAJO_PROFESIONAL;
  switch (verificacion.estado) {
    case 'VIGENTE':
      return [];
    // CA-29 / salvaguarda M-2: vencida la vigencia se bloquean los casos
    // NUEVOS y siguen los que están en curso. Un corte abrupto perjudicaría al
    // cliente que ya tiene a ese abogado (constitución #1).
    case 'VENCIDA':
      return ['caso.recibirAsignacion'];
    // CA-30 / M-3: la suspensión es de efecto inmediato y total.
    case 'SUSPENDIDA':
      return PERMISOS_DE_TRABAJO_PROFESIONAL;
    // CA-05: pendiente o rechazada no puede operar como abogado.
    case 'PENDIENTE':
    case 'RECHAZADA':
      return PERMISOS_DE_TRABAJO_PROFESIONAL;
  }
}

/**
 * Deriva el conjunto efectivo de permisos. Pura, total y determinista.
 * Implementa la firma declarada en el contrato §2.
 *
 * El orden de aplicación no es decorativo: **los ajustes individuales se
 * aplican primero y las restricciones después**. Si fuera al revés, un ajuste
 * podría devolverle permisos a una cuenta suspendida, a un abogado con la
 * matrícula suspendida o a un administrador sin segundo factor, y las
 * garantías de CA-30, CA-32 y CA-38 dependerían de que nadie cargue el ajuste
 * equivocado.
 *
 * 1. Se parte del mapa del rol.
 * 2. Se aplican los ajustes individuales vigentes al `momento`, en orden
 *    cronológico; los que conceden un permiso blindado para el rol se ignoran.
 * 3. Cuenta que no está `ACTIVA` ⇒ sólo `permisosDeCuentaNoOperativa`.
 * 4. Rol profesional sin segundo factor activo ⇒ sólo inscripción (ADR-023).
 * 5. Segundo factor no activo ⇒ se retiran desactivar y regenerar códigos.
 * 6. Matrícula no vigente ⇒ se retiran los permisos de trabajo profesional
 *    según CA-29 y CA-30.
 */
export function derivarPermisos(
  perfil: PerfilDeAutorizacion,
  momento: InstanteDeEvaluacion,
): ReadonlySet<Permiso> {
  const permisos = new Set<Permiso>(mapaRolPermisos[perfil.rol]);

  // (2) Ajustes individuales.
  const blindados = PERMISOS_NO_CONCEDIBLES_POR_AJUSTE[perfil.rol];
  for (const ajuste of ordenarPorMomento(perfil.ajustes)) {
    if (!ajusteVigente(ajuste, momento)) continue;
    if (ajuste.efecto === 'RETIRA') {
      permisos.delete(ajuste.permiso);
      continue;
    }
    if (blindados.includes(ajuste.permiso)) continue;
    permisos.add(ajuste.permiso);
  }

  // (3) Cuenta no operativa.
  if (perfil.estadoCuenta !== 'ACTIVA') {
    const conservados = permisosDeCuentaNoOperativa[perfil.estadoCuenta];
    for (const permiso of [...permisos]) {
      if (!conservados.includes(permiso)) permisos.delete(permiso);
    }
    return permisos;
  }

  // (4) Cerrojo 4 de ADR-023: rol profesional sin segundo factor activo.
  const exigeFactor = perfil.rol === 'ADMINISTRADOR' || perfil.rol === 'ABOGADO';
  if (exigeFactor && perfil.estadoMfa !== 'ACTIVO') {
    for (const permiso of [...permisos]) {
      if (!PERMISOS_DE_INSCRIPCION_DE_SEGUNDO_FACTOR.includes(permiso)) permisos.delete(permiso);
    }
    return permisos;
  }

  // (5) Coherencia del segundo factor: no se desactiva ni se regeneran códigos
  // de un factor que no está activo. Es además el puente que usa
  // `elSegundoFactorEstaActivo`.
  if (perfil.estadoMfa !== 'ACTIVO') {
    permisos.delete('mfa.desactivar.propio');
    permisos.delete('mfa.regenerarCodigosDeRespaldo.propio');
  }

  // (6) Vigencia de la matrícula (CA-29, CA-30). Sólo alcanza al rol ABOGADO:
  // los permisos profesionales no están en los otros dos mapas.
  if (perfil.rol === 'ABOGADO') {
    for (const permiso of permisosProfesionalesQueSeRetiran(perfil.verificacionProfesional)) {
      permisos.delete(permiso);
    }
  }

  return permisos;
}
