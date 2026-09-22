/**
 * Catálogo cerrado de plantillas de correo transaccional.
 *
 * **Acá no hay texto de producto.** El asunto y el cuerpo los escribe
 * `ux-expert` y viven en la plantilla del proveedor (o en el catálogo de
 * microcopy el día que exista); este archivo define sólo la **estructura** que
 * cada plantilla exige, que es lo que un adaptador puede verificar:
 *
 * - qué acciones tiene que llevar el correo — C-002-06: **todo correo de esta
 *   feature es accionable**, y el contrato ya lo exige por tipos con una tupla
 *   no vacía; acá se exige además que sean *las que corresponden*, porque un
 *   aviso de bloqueo con un botón "Ingresar" y nada más es accionable en el
 *   tipo y burla en la práctica;
 * - qué variables puede llevar, con vocabulario cerrado. Todo lo que no esté
 *   en la lista se rechaza antes de salir. Es la barrera concreta de la
 *   minimización del ADR-029: **nunca** un dato patrimonial, ni el CUIT/CUIL,
 *   ni el estado del expediente viajan al proveedor.
 *
 * El `Record` es total sobre `ClavePlantillaCorreo`: agregar una plantilla al
 * contrato sin declararla acá no compila.
 */

import type { AccionDeCorreo, ClavePlantillaCorreo } from '../contrato';

export type ClaveDeAccion = AccionDeCorreo['clave'];

export interface DefinicionDePlantilla {
  /**
   * Acciones que el correo debe incluir. Al menos una, y todas presentes:
   * es la diferencia entre "el tipo exige una acción" y "el correo sirve".
   */
  readonly accionesRequeridas: readonly [ClaveDeAccion, ...ClaveDeAccion[]];
  /** Vocabulario cerrado de variables. Vacío significa: ninguna variable. */
  readonly variablesPermitidas: readonly string[];
  /**
   * Para qué se manda, en una línea. Es documentación interna y trazabilidad
   * al criterio de aceptación, no texto que vea nadie.
   */
  readonly motivo: string;
}

/**
 * Variables comunes a casi todas las plantillas. Todas son valores cerrados o
 * datos que la persona ya tiene: su propio nombre para mostrar, una fecha, un
 * plazo. Ninguna dice nada de su situación patrimonial.
 */
const NOMBRE = 'nombreParaMostrar';
const VENCE_EN = 'venceEn';
const MOMENTO = 'momento';
const DISPOSITIVO = 'dispositivo';
const UBICACION = 'ubicacion';

export const CATALOGO_DE_PLANTILLAS: Readonly<
  Record<ClavePlantillaCorreo, DefinicionDePlantilla>
> = {
  CONFIRMACION_DE_CORREO: {
    accionesRequeridas: ['CONFIRMAR', 'PEDIR_ENLACE_NUEVO'],
    variablesPermitidas: [NOMBRE, VENCE_EN],
    motivo: 'CA-01: confirmar la dirección declarada en el alta.',
  },
  INTENTO_DE_ALTA_CON_CORREO_YA_REGISTRADO: {
    accionesRequeridas: ['INGRESAR', 'RECUPERAR_CONTRASENA'],
    variablesPermitidas: [MOMENTO],
    motivo:
      'CA-02 y CA-04: alguien intentó registrarse con una dirección que ya existe. La respuesta al navegador es idéntica a la del alta exitosa; quien recibe la salida real es el titular, por correo.',
  },
  INTENTO_DE_ALTA_CON_CUIT_YA_REGISTRADO: {
    accionesRequeridas: ['INGRESAR', 'CONTACTAR_SOPORTE'],
    variablesPermitidas: [MOMENTO],
    motivo: 'CA-04: mismo criterio que el anterior, para el identificador fiscal.',
  },
  RECUPERACION_DE_CONTRASENA: {
    accionesRequeridas: ['RECUPERAR_CONTRASENA', 'PEDIR_ENLACE_NUEVO'],
    variablesPermitidas: [NOMBRE, VENCE_EN],
    motivo: 'CA-15: enlace de un solo uso para volver a entrar.',
  },
  CONTRASENA_CAMBIADA: {
    accionesRequeridas: ['VER_SESIONES', 'CONTACTAR_SOPORTE'],
    variablesPermitidas: [MOMENTO, DISPOSITIVO, UBICACION],
    motivo:
      'CA-16: aviso de que la contraseña cambió. Si no fue la persona, la salida es ver y cerrar sesiones.',
  },
  CUENTA_BLOQUEADA_TEMPORALMENTE: {
    accionesRequeridas: ['RECUPERAR_CONTRASENA', 'CONTACTAR_SOPORTE'],
    variablesPermitidas: [VENCE_EN, MOMENTO],
    motivo:
      'CA-36 y CA-37: el bloqueo siempre tiene salida, y el correo la tiene que ofrecer. Un aviso de bloqueo sin camino de vuelta deja a la persona afuera.',
  },
  REUTILIZACION_DE_REFRESCO: {
    accionesRequeridas: ['VER_SESIONES', 'RECUPERAR_CONTRASENA'],
    variablesPermitidas: [MOMENTO, DISPOSITIVO, UBICACION],
    motivo: 'CA-11: se detectó reutilización de un token y se cortó la familia entera.',
  },
  SESION_CERRADA_A_DISTANCIA: {
    accionesRequeridas: ['VER_SESIONES'],
    variablesPermitidas: [MOMENTO, DISPOSITIVO, UBICACION],
    motivo: 'CA-14: aviso de cierre remoto de una sesión.',
  },
  SEGUNDO_FACTOR_ACTIVADO: {
    accionesRequeridas: ['VER_SESIONES', 'CONTACTAR_SOPORTE'],
    variablesPermitidas: [MOMENTO],
    motivo: 'CA-32: cambio en las credenciales de la cuenta, siempre avisado.',
  },
  SEGUNDO_FACTOR_DESACTIVADO: {
    accionesRequeridas: ['VER_SESIONES', 'CONTACTAR_SOPORTE'],
    variablesPermitidas: [MOMENTO],
    motivo: 'CA-32: el aviso importa más al desactivar que al activar.',
  },
  RESTITUCION_MFA_EN_CURSO: {
    accionesRequeridas: ['CONTACTAR_SOPORTE'],
    variablesPermitidas: [VENCE_EN, MOMENTO],
    motivo:
      'CA-35: hay una solicitud de restitución en curso y la espera es cancelable por el titular. Si no la pidió él, tiene que poder frenarla.',
  },
  RESTITUCION_MFA_RESUELTA: {
    accionesRequeridas: ['INGRESAR', 'CONTACTAR_SOPORTE'],
    variablesPermitidas: [MOMENTO],
    motivo: 'CA-35: resultado de la solicitud.',
  },
  MATRICULA_POR_VENCER: {
    accionesRequeridas: ['INGRESAR'],
    variablesPermitidas: [NOMBRE, VENCE_EN],
    motivo: 'CA-29: la verificación vence y hay que renovarla antes de perder el acceso.',
  },
  MATRICULA_VENCIDA: {
    accionesRequeridas: ['INGRESAR', 'CONTACTAR_SOPORTE'],
    variablesPermitidas: [NOMBRE, MOMENTO],
    motivo: 'CA-29: la verificación venció.',
  },
  MATRICULA_SUSPENDIDA: {
    accionesRequeridas: ['CONTACTAR_SOPORTE'],
    variablesPermitidas: [NOMBRE, MOMENTO],
    motivo:
      'CA-30: suspensión inmediata. El motivo concreto no viaja en el correo: va en la plataforma, donde el acceso está autenticado.',
  },
  CUENTA_ADMINISTRADORA_CREADA: {
    accionesRequeridas: ['CONFIRMAR', 'CONTACTAR_SOPORTE'],
    variablesPermitidas: [NOMBRE, VENCE_EN],
    motivo: 'CA-33: las cuentas administradoras son nominadas y su creación se avisa.',
  },
};

export const CLAVES_DE_PLANTILLA = Object.keys(
  CATALOGO_DE_PLANTILLAS,
) as readonly ClavePlantillaCorreo[];
