/**
 * Puerto de correo transaccional (§13 del contrato, ADR-029 punto 3).
 *
 * Es el **único encargado de tratamiento** de toda la feature 002: de los
 * cuatro terceros que la condición C-002-10 podía haber traído, tres se
 * resolvieron localmente y queda éste. Por decisión del product owner
 * (registro de compuertas, entrada 052) el proveedor es **Sendgrid** (R-12),
 * que procesa en los Estados Unidos: antes de producción hacen falta la
 * evaluación de transferencia internacional del art. 12 y el acuerdo de
 * tratamiento firmado. Eso **no bloquea el desarrollo** —el modo mock no toca
 * a nadie— pero sí el pasaje a producción, y está declarado en la cobertura
 * del adaptador para que el sistema lo sepa y no se entere en el despliegue.
 *
 * Tres reglas que valen para los tres modos (mock, SMTP local, proveedor):
 *
 * 1. **El envío nunca ocurre en el camino de respuesta** (ADR-025). Este
 *    puerto se invoca desde la cola, no desde el controlador.
 * 2. **Clave de idempotencia obligatoria** (constitución #12). Dos avisos
 *    iguales por el mismo hecho no salen dos veces.
 * 3. **Minimización del contenido.** Al proveedor viajan la dirección, la
 *    plantilla y variables de valores cerrados. Nada más. Lo verifica
 *    `verificarMensaje` **antes** de cualquier salida.
 */

import {
  claveDeIdempotenciaValida,
  crearErrorIntegracion,
  type ErrorIntegracion,
} from '../../nucleo';
import type {
  ConstanciaDeEnvio,
  DatoDeEvento,
  MensajeTransaccional,
  PuertoCorreoTransaccional,
  Resultado,
} from '../contrato';
import { CATALOGO_DE_PLANTILLAS } from './plantillas';

export type {
  ConstanciaDeEnvio,
  MensajeTransaccional,
  PuertoCorreoTransaccional,
};

export type ModoDeEnvio = ConstanciaDeEnvio['modo'];

/**
 * Validación de dirección **conservadora a propósito**. No se trata de decidir
 * si una dirección existe —eso lo dice el rebote— sino de no mandarle al
 * proveedor algo que obviamente no es una dirección.
 */
const FORMA_DE_CORREO = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[A-Za-z]{2,}$/;

/** Claves de variable prohibidas sin importar la plantilla. */
const CLAVES_PROHIBIDAS = [
  'cuit',
  'cuil',
  'dni',
  'documento',
  'deuda',
  'monto',
  'saldo',
  'importe',
  'quita',
  'acreedor',
  'entidad',
  'expediente',
  'caso',
  'contrasena',
  'password',
  'token',
  'codigo',
  'secreto',
];

/**
 * Un valor de 11 dígitos, con o sin guiones, es un CUIT/CUIL. Un valor con
 * símbolo de peso o separador de miles es plata. Ninguno de los dos viaja.
 */
const FORMA_DE_IDENTIFICADOR_FISCAL = /^\d{2}-?\d{8}-?\d$/;
const FORMA_DE_DINERO = /(\$|ARS)\s*\d|\d{1,3}(\.\d{3})+(,\d+)?/;

function violacion(detalle: string): ErrorIntegracion {
  return crearErrorIntegracion({
    proveedor: 'SENDGRID',
    clase: 'PETICION_INVALIDA',
    detalle,
  });
}

/**
 * Verifica el mensaje completo antes de que salga: dirección, idempotencia,
 * plantilla conocida, acciones requeridas presentes y variables dentro del
 * vocabulario cerrado.
 *
 * Devuelve `null` si está bien. Lo llaman **todos** los adaptadores, incluido
 * el mock: si la verificación sólo corriera en el adaptador real, el defecto
 * aparecería en producción y no en el test, que es exactamente al revés de lo
 * que queremos.
 */
export function verificarMensaje(mensaje: MensajeTransaccional): ErrorIntegracion | null {
  if (!FORMA_DE_CORREO.test(mensaje.destinatario)) {
    return violacion('destinatario-mal-formado');
  }
  if (!claveDeIdempotenciaValida(mensaje.claveDeIdempotencia)) {
    return violacion('clave-de-idempotencia-invalida');
  }

  const definicion = CATALOGO_DE_PLANTILLAS[mensaje.plantilla];
  if (definicion === undefined) {
    return violacion('plantilla-desconocida');
  }

  if (mensaje.acciones.length === 0) {
    // El tipo del contrato ya lo impide en compilación; esto atrapa el caso en
    // que el mensaje llegó desde JSON sin pasar por el tipo.
    return violacion('correo-sin-accion');
  }
  const presentes = new Set(mensaje.acciones.map((accion) => accion.clave));
  for (const requerida of definicion.accionesRequeridas) {
    if (!presentes.has(requerida)) return violacion(`falta-accion-${requerida}`);
  }
  for (const accion of mensaje.acciones) {
    if (!/^https:\/\//.test(accion.url)) return violacion('accion-sin-enlace-seguro');
  }

  for (const variable of mensaje.variables) {
    const error = verificarVariable(variable, definicion.variablesPermitidas);
    if (error !== null) return error;
  }

  return null;
}

function verificarVariable(
  variable: DatoDeEvento,
  permitidas: readonly string[],
): ErrorIntegracion | null {
  const clave = variable.clave.toLowerCase();
  if (CLAVES_PROHIBIDAS.some((prohibida) => clave.includes(prohibida))) {
    return violacion('variable-con-clave-prohibida');
  }
  if (!permitidas.includes(variable.clave)) {
    return violacion('variable-fuera-del-vocabulario');
  }
  if (typeof variable.valor === 'string') {
    if (FORMA_DE_IDENTIFICADOR_FISCAL.test(variable.valor.trim())) {
      return violacion('variable-con-identificador-fiscal');
    }
    if (FORMA_DE_DINERO.test(variable.valor)) {
      return violacion('variable-con-dato-patrimonial');
    }
    if (variable.valor.length > 120) {
      return violacion('variable-demasiado-larga');
    }
  }
  return null;
}

/** Atajo de resultado, para que los adaptadores no repitan la forma. */
export function envioFallido<T>(error: {
  clase: 'ENTRADA_INVALIDA' | 'INCONSISTENCIA_INTERNA';
  codigo: string;
  referencia: string | null;
}): Resultado<T, { clase: 'ENTRADA_INVALIDA' | 'INCONSISTENCIA_INTERNA'; codigo: string; referencia: string | null }> {
  return { ok: false, error };
}
