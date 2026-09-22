/**
 * Decisión de acceso — contrato §3, **ADR-022**. Criterios CA-19, CA-20.
 *
 * Esta es la mitad pura del mecanismo central de toda la aplicación que viene
 * después. La otra mitad, `autorizar`, vive en `apps/api` porque necesita
 * consultar la base para resolver el alcance y emitir el evento de auditoría.
 * Están separadas justamente para que **esta** se pueda probar como una tabla
 * de verdad, sin levantar nada, y para que la puedan leer personas que no
 * programan.
 *
 * Lo que hace que el control no se pueda saltear no está acá sino en el tipo
 * `Autorizacion<P, T>` del contrato: su marca es un `unique symbol` que **no
 * se exporta**, así que fuera del módulo que implementa `autorizar` el tipo es
 * inconstruible. La capa de datos no acepta otro argumento, de modo que un
 * camino de datos sin autorización no se puede escribir: no se puede construir
 * su argumento. Este archivo, deliberadamente, **no construye ninguna prueba**:
 * si lo hiciera, la garantía se rompería acá.
 *
 * ── Límite conocido de la firma declarada ──
 * `decidirAcceso` no recibe el instante de evaluación, y `ExigenciaDelRecurso`
 * trae `ventanaDeReautenticacion`. Sin un "ahora" no se puede comparar esa
 * ventana contra `contexto.autenticadoEn`, así que la frescura de la
 * autenticación **la tiene que verificar `autorizar` en el borde**, antes de
 * llamar acá, y devolver `REAUTENTICACION_REQUERIDA`. Se deja anotado como
 * escalamiento al orquestador: o la firma del contrato suma el instante, o la
 * obligación queda declarada para `dev-backend`. Mientras tanto,
 * `reautenticacionVencida` de este mismo archivo hace el cálculo puro, para
 * que el borde no lo reinvente.
 */

import type {
  AlcanceResuelto,
  ContextoDeAcceso,
  DecisionDeAcceso,
  DuracionEnSegundos,
  ExigenciaDelRecurso,
  Instante,
  MotivoDenegacion,
  Permiso,
} from './contrato/v1';
import { elSegundoFactorEstaActivo } from './permisos';
import { segundosEntre } from './tiempo';

const PERMITIDO: DecisionDeAcceso = { decision: 'PERMITIDO' };

function denegar(motivo: MotivoDenegacion): DecisionDeAcceso {
  return { decision: 'DENEGADO', motivo };
}

/**
 * ¿El alcance resuelto alcanza para tocar el recurso?
 *
 * `COLECCION` siempre pasa, incluso con criterio `NINGUNO`: tener el permiso y
 * no tener alcance devuelve **lista vacía, nunca 403** (ADR-022 capa 5). Que
 * te digan "no tenés permiso" cuando en realidad no tenés nada que ver es
 * información de más y además confunde.
 */
function alcanceSuficiente(alcance: AlcanceResuelto): boolean {
  switch (alcance.clase) {
    case 'ES_TITULAR':
    case 'ESTA_ASIGNADO':
    case 'ALCANCE_GLOBAL':
    case 'COLECCION':
      return true;
    case 'SIN_RELACION':
      return false;
  }
}

/**
 * Decisión pura, sin efectos. Implementa la firma declarada en el contrato §3.
 *
 * El orden de las comprobaciones es el orden en que conviene denegar:
 *
 * 1. **Permiso ausente** (CA-18, R-07). Se evalúa por permiso concreto, nunca
 *    por nombre de rol — el contexto ni siquiera lo tiene.
 * 2. **Fuera de alcance** (CA-19). Tener `caso.leer.asignado` no habilita a
 *    leer *cualquier* caso: habilita a leer los asignados a ese abogado, y eso
 *    se verifica en cada consulta, no sólo en el listado.
 * 3. **Segundo factor** cuando el recurso lo exige (ADR-022, recaudo B-3).
 *
 * Los motivos `CUENTA_NO_OPERATIVA`, `MATRICULA_NO_VIGENTE` y
 * `CLASIFICACION_AUSENTE` del contrato **no se producen acá**: los dos
 * primeros ya se manifestaron como permisos ausentes en `derivarPermisos`, y
 * el tercero lo produce la validación del registro de recursos al arrancar.
 * Están en el vocabulario para que el borde pueda ser más preciso en la
 * bitácora, no para que esta función los adivine.
 */
export function decidirAcceso(
  contexto: ContextoDeAcceso,
  permiso: Permiso,
  alcance: AlcanceResuelto,
  exigencia: ExigenciaDelRecurso,
): DecisionDeAcceso {
  if (!contexto.permisos.has(permiso)) return denegar('PERMISO_AUSENTE');
  if (!alcanceSuficiente(alcance)) return denegar('FUERA_DE_ALCANCE');

  if (exigencia.exigeSegundoFactor && contexto.nivelAutenticacion !== 'CONTRASENA_Y_SEGUNDO_FACTOR') {
    // ADR-022, aclaración sobre `exigeSegundoFactor`: la exigencia significa
    // **reautenticación fuerte**, y se satisface con contraseña cuando la
    // cuenta no tiene segundo factor configurado — no se puede exigir lo que
    // no existe. Si se denegara igual, un cliente sin MFA no podría inscribir
    // su MFA ni cambiar su contraseña: un callejón sin salida, que es
    // exactamente lo que C-002-06 prohíbe.
    if (elSegundoFactorEstaActivo(contexto.permisos)) return denegar('SEGUNDO_FACTOR_REQUERIDO');
  }

  return PERMITIDO;
}

/**
 * ¿La autenticación de esta sesión quedó vieja para una operación sensible?
 *
 * Cálculo puro que el borde necesita para producir `REAUTENTICACION_REQUERIDA`
 * (recaudo B-3, ventana de `CREDENCIAL`). Sin ventana declarada, no hay
 * exigencia de frescura. Ver el límite anotado en el encabezado del archivo.
 */
export function reautenticacionVencida(
  autenticadoEn: Instante,
  ventana: DuracionEnSegundos | null,
  momento: Instante,
): boolean {
  if (ventana === null) return false;
  return segundosEntre(autenticadoEn, momento) > ventana;
}
