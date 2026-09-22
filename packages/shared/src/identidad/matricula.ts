/**
 * Estado de la matrícula profesional — contrato §5, **ADR-026**.
 * Criterios CA-05, CA-22, CA-24, CA-29, CA-30, CA-31.
 * Condición C-002-07, salvaguardas M-1 a M-4 y M-6.
 *
 * **Se registran hechos; el estado se calcula.** No hay ninguna columna que
 * guarde "vigente": un campo almacenado exige un proceso que lo actualice, y
 * un proceso que no corrió un fin de semana deja al sistema afirmando que una
 * matrícula está vigente cuando venció el viernes. Acá el vencimiento ocurre
 * por el paso del tiempo, no porque una tarea lo marque.
 *
 * Y una razón que no es técnica: mostrar "abogado verificado" es una
 * afirmación de la plataforma al consumidor sobre una característica esencial
 * del servicio (Ley 24.240, arts. 4 y 8; la plataforma está dentro de la
 * cadena de prestación, art. 40). "Matrícula verificada el {fecha} contra
 * {constancia}" es sostenible; "verificado" a secas, no. Por eso este módulo
 * **no produce texto**: devuelve la clave de una plantilla y sus variables, y
 * ninguna clave de estado verificado existe sin la variable de fecha.
 */

import type {
  DatoDeEvento,
  DecisionDeVerificacion,
  DuracionEnSegundos,
  EstadoVerificacionProfesional,
  EvidenciaDeMatricula,
  HistoriaDeVerificacion,
  InstanteDeEvaluacion,
  SuspensionDeMatricula,
} from './contrato/v1';
import { estaDentroDeLaVigencia, fechaCivilArgentinaDe, milisegundosDe, segundosEntre } from './tiempo';

/**
 * Claves de plantilla de exhibición. El texto lo escribe `ux-expert` en el
 * catálogo; este módulo sólo nombra la clave.
 *
 * Nótese que ninguna clave dice "verificado". Las dos que corresponden a una
 * matrícula efectivamente verificada dicen `verificada-el`, que es la forma
 * que obliga a la fecha (salvaguarda M-6). Hay un test que falla si alguna
 * clave de este catálogo contiene la palabra "verificado" o si una clave de
 * estado verificado no trae la variable `fechaDeVerificacion`.
 */
export type ClaveDePlantillaDeMatricula =
  | 'matricula.pendiente'
  | 'matricula.pendiente.plazo-vencido'
  | 'matricula.rechazada'
  | 'matricula.verificada-el'
  | 'matricula.verificada-el.vigencia-vencida'
  | 'matricula.en-revision';

/** Claves de plantilla que afirman que hubo una verificación. Exigen fecha. */
export const PLANTILLAS_QUE_AFIRMAN_VERIFICACION: readonly ClaveDePlantillaDeMatricula[] = [
  'matricula.verificada-el',
  'matricula.verificada-el.vigencia-vencida',
];

/* ───────────────────────────────────────────────────────────────────────────
 * Derivación del estado
 * ────────────────────────────────────────────────────────────────────────── */

function suspensionVigenteA(
  suspension: SuspensionDeMatricula,
  momentoEnMilisegundos: number,
): boolean {
  if (milisegundosDe(suspension.desde) > momentoEnMilisegundos) return false;
  return suspension.hasta === null || milisegundosDe(suspension.hasta) > momentoEnMilisegundos;
}

function ultimaSuspensionVigente(
  historia: HistoriaDeVerificacion,
  momentoEnMilisegundos: number,
): SuspensionDeMatricula | null {
  let ultima: SuspensionDeMatricula | null = null;
  for (const suspension of historia.suspensiones) {
    if (!suspensionVigenteA(suspension, momentoEnMilisegundos)) continue;
    if (ultima === null || milisegundosDe(suspension.desde) >= milisegundosDe(ultima.desde)) {
      ultima = suspension;
    }
  }
  return ultima;
}

function ultimaDecisionTomada(
  historia: HistoriaDeVerificacion,
  momentoEnMilisegundos: number,
): DecisionDeVerificacion | null {
  let ultima: DecisionDeVerificacion | null = null;
  for (const decision of historia.decisiones) {
    if (milisegundosDe(decision.momento) > momentoEnMilisegundos) continue;
    if (ultima === null || milisegundosDe(decision.momento) >= milisegundosDe(ultima.momento)) {
      ultima = decision;
    }
  }
  return ultima;
}

function pendiente(
  historia: HistoriaDeVerificacion,
  momento: InstanteDeEvaluacion,
  plazoMaximoDeRevision: DuracionEnSegundos,
): EstadoVerificacionProfesional {
  return {
    estado: 'PENDIENTE',
    desde: historia.solicitadaEn,
    // CA-31: transcurrido el plazo, se escala al back-office. El cálculo es
    // parte del estado derivado y no de una tarea programada, justamente para
    // que el escalamiento no dependa de que la tarea haya corrido.
    plazoVencido: segundosEntre(historia.solicitadaEn, momento) > plazoMaximoDeRevision,
  };
}

/**
 * Deriva el estado a la fecha. Pura y total. Implementa la firma declarada en
 * el contrato §5.
 *
 * Precedencia, y el motivo de cada escalón:
 *
 * 1. **Suspensión vigente** manda sobre todo lo demás (CA-30, M-3): es de
 *    efecto inmediato y no espera al vencimiento de la vigencia.
 * 2. Si no hubo ninguna decisión todavía, la matrícula está **pendiente**, con
 *    `plazoVencido` calculado contra el plazo máximo de revisión (CA-31).
 * 3. La **última** decisión tomada manda sobre las anteriores: una matrícula
 *    rechazada y vuelta a aprobar queda aprobada, y al revés también.
 * 4. Una aprobación sin evidencia o sin `vigenciaHasta` **no se toma como
 *    aprobación**: se trata como si no hubiera ocurrido y el estado vuelve a
 *    pendiente. La salvaguarda M-1 exige que la evidencia sea estructuralmente
 *    obligatoria; acá, ante un dato incompleto, el sistema no afirma. Es la
 *    misma regla que la constitución impone en todos lados: ante la duda, no
 *    se afirma nada.
 * 5. Aprobada y con la vigencia corriendo ⇒ `VIGENTE`; cumplida la vigencia ⇒
 *    `VENCIDA` (CA-29). El último día de vigencia cuenta **entero**, en hora
 *    argentina: ver `tiempo.ts`.
 */
export function derivarEstadoMatricula(
  historia: HistoriaDeVerificacion,
  momento: InstanteDeEvaluacion,
  plazoMaximoDeRevision: DuracionEnSegundos,
): EstadoVerificacionProfesional {
  const ahora = milisegundosDe(momento);

  const suspension = ultimaSuspensionVigente(historia, ahora);
  if (suspension !== null) {
    return {
      estado: 'SUSPENDIDA',
      desde: suspension.desde,
      dispuestaPor: suspension.dispuestaPor,
      motivo: suspension.motivo,
    };
  }

  const decision = ultimaDecisionTomada(historia, ahora);
  if (decision === null) return pendiente(historia, momento, plazoMaximoDeRevision);

  if (decision.resultado === 'RECHAZADA') {
    return { estado: 'RECHAZADA', momento: decision.momento };
  }

  const evidencia: EvidenciaDeMatricula | null = decision.evidencia;
  const vigenciaHasta = decision.vigenciaHasta;
  if (evidencia === null || vigenciaHasta === null) {
    return pendiente(historia, momento, plazoMaximoDeRevision);
  }

  return estaDentroDeLaVigencia(momento, vigenciaHasta)
    ? { estado: 'VIGENTE', verificadaEn: decision.momento, vigenciaHasta, evidencia }
    : { estado: 'VENCIDA', verificadaEn: decision.momento, vigenciaHasta, evidencia };
}

/* ───────────────────────────────────────────────────────────────────────────
 * Exhibición (salvaguarda M-6)
 * ────────────────────────────────────────────────────────────────────────── */

function dato(clave: string, valor: string | number | boolean | null): DatoDeEvento {
  return { clave, valor };
}

/**
 * Texto de exhibición de la verificación. Implementa la firma declarada en el
 * contrato §5.
 *
 * Devuelve la clave de la plantilla y sus variables; **el texto no se arma
 * acá**. Dos motivos: el microcopy es de `ux-expert` y lo ratifica el abogado,
 * y una función de dominio que redacta lenguaje sobre una persona es
 * exactamente lo que la constitución no quiere.
 *
 * La fecha de verificación viaja como **fecha civil argentina**, no como
 * instante: es lo que la pantalla muestra, y convertirla en el borde invita a
 * que cada portal elija su propia zona horaria y muestre un día distinto.
 */
export function claveDeExhibicionDeMatricula(estado: EstadoVerificacionProfesional): {
  readonly plantilla: string;
  readonly variables: readonly DatoDeEvento[];
} {
  switch (estado.estado) {
    case 'PENDIENTE':
      return {
        plantilla: estado.plazoVencido ? 'matricula.pendiente.plazo-vencido' : 'matricula.pendiente',
        variables: [
          dato('solicitadaEl', fechaCivilArgentinaDe(estado.desde)),
          dato('plazoVencido', estado.plazoVencido),
        ],
      };
    case 'RECHAZADA':
      return {
        plantilla: 'matricula.rechazada',
        variables: [dato('decididaEl', fechaCivilArgentinaDe(estado.momento))],
      };
    case 'VIGENTE':
    case 'VENCIDA':
      return {
        plantilla:
          estado.estado === 'VIGENTE' ? 'matricula.verificada-el' : 'matricula.verificada-el.vigencia-vencida',
        variables: [
          // M-6: sin esta variable la plantilla no puede renderizarse. La
          // interfaz nunca dice "verificada" sin decir cuándo y contra qué.
          dato('fechaDeVerificacion', fechaCivilArgentinaDe(estado.verificadaEn)),
          dato('vigenciaHasta', estado.vigenciaHasta),
          dato('colegio', estado.evidencia.colegio),
          dato('jurisdiccion', estado.evidencia.jurisdiccion),
          dato('numeroDeMatricula', estado.evidencia.numeroDeMatricula),
          dato('claseDeConstancia', estado.evidencia.claseDeConstancia),
          dato('fechaDeLaConstancia', estado.evidencia.fechaDeLaConstancia),
        ],
      };
    case 'SUSPENDIDA':
      return {
        plantilla: 'matricula.en-revision',
        variables: [dato('desde', fechaCivilArgentinaDe(estado.desde)), dato('motivo', estado.motivo)],
      };
  }
}
