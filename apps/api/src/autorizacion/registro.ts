/**
 * Registro de tipos de recurso con sus exigencias de autorización.
 *
 * Implementa ADR-022: "la clasificación por tipo de recurso la fija este plan y se
 * ratifica contra la de campo por campo que escribe `database-engineer`".
 * `validarRegistroDeRecursos` corre al arrancar: **si falta un tipo, el proceso no
 * levanta**.
 */

import type {
  ClasificacionDato,
  DuracionEnSegundos,
  TipoRecurso,
} from '@mejorar/shared/identidad/contrato/v1';
import { ExigenciaDelRecursoRegistrada, ResolvedorDeAlcance } from './tipos';

/**
 * Tabla de clasificación de datos por tipo de recurso (ADR-022 §"La clasificación").
 * Se declara acá en el plan: la clasificación **por campo** la escribe `database-engineer`.
 */
const CLASIFICACION_POR_TIPO: Readonly<Record<TipoRecurso, ClasificacionDato>> = {
  USUARIO: 'PERSONAL',
  PERFIL: 'PERSONAL',
  SESION: 'PERSONAL',
  CREDENCIAL: 'PERSONAL',
  VERIFICACION_PROFESIONAL: 'PERSONAL',
  EVENTO_AUDITORIA: 'PERSONAL',
  SOLICITUD_RESTITUCION_MFA: 'PERSONAL',
  CASO: 'PATRIMONIAL_SENSIBLE',
};

/**
 * Exigencias por tipo de recurso (segundo factor, ventana de reautenticación).
 * Son las únicas con exigencia en la 002; las features posteriores las amplifican.
 */
const EXIGENCIAS_POR_TIPO: Readonly<Record<TipoRecurso, { segundoFactor: boolean; ventana: DuracionEnSegundos | null }>> = {
  USUARIO: { segundoFactor: false, ventana: null },
  PERFIL: { segundoFactor: false, ventana: null },
  SESION: { segundoFactor: false, ventana: null },
  CREDENCIAL: { segundoFactor: true, ventana: 300 as DuracionEnSegundos }, // 5 minutos
  VERIFICACION_PROFESIONAL: { segundoFactor: true, ventana: null },
  EVENTO_AUDITORIA: { segundoFactor: true, ventana: null },
  SOLICITUD_RESTITUCION_MFA: { segundoFactor: true, ventana: 300 as DuracionEnSegundos }, // 5 minutos
  CASO: { segundoFactor: false, ventana: null }, // Lo fijan 008/012/013
};

/**
 * Registro global de tipos de recurso con sus exigencias.
 */
class RegistroDeRecursos {
  private exigencias: Map<TipoRecurso, ExigenciaDelRecursoRegistrada> = new Map();
  private resolvedores: Map<TipoRecurso, ResolvedorDeAlcance> = new Map();

  /**
   * Valida que todos los tipos de recurso estén registrados con clasificación.
   * Se llama al arrancar la aplicación. Si falla, el proceso no levanta.
   */
  validar(): void {
    const tiposDelSistema: TipoRecurso[] = [
      'USUARIO',
      'PERFIL',
      'SESION',
      'CREDENCIAL',
      'VERIFICACION_PROFESIONAL',
      'EVENTO_AUDITORIA',
      'SOLICITUD_RESTITUCION_MFA',
      'CASO',
    ];

    for (const tipo of tiposDelSistema) {
      const clasificacion = CLASIFICACION_POR_TIPO[tipo];
      if (!clasificacion) {
        throw new Error(
          `[FALLA CERRADO] Tipo de recurso '${tipo}' no tiene clasificación de sensibilidad registrada. ` +
            'Esta es una falla de diseño: todos los tipos deben declarar su clasificación al arrancar.',
        );
      }

      const exigencia = EXIGENCIAS_POR_TIPO[tipo];
      if (!exigencia) {
        throw new Error(
          `[FALLA CERRADO] Tipo de recurso '${tipo}' no tiene exigencias registradas. ` +
            'Esta es una falla de diseño.',
        );
      }

      this.exigencias.set(tipo, {
        tipo,
        clasificacion,
        exigeSegundoFactor: exigencia.segundoFactor,
        ventanaDeReautenticacion: exigencia.ventana,
      });
    }
  }

  /**
   * Obtiene las exigencias de un tipo de recurso.
   * Retorna error si el tipo no está registrado (no debería ocurrir después de `validar`).
   */
  obtenerExigencia(tipo: TipoRecurso): ExigenciaDelRecursoRegistrada | null {
    return this.exigencias.get(tipo) || null;
  }

  /**
   * Registra un resolvedor de alcance para un tipo de recurso.
   * Puede ser llamado luego de la validación para agregar resolvedores específicos
   * del dominio (p.ej., CASO es registrado por las specs 008/012/013).
   */
  registrarResolvedor(resolvedor: ResolvedorDeAlcance): void {
    this.resolvedores.set(resolvedor.tipo, resolvedor);
  }

  /**
   * Obtiene el resolvedor de alcance para un tipo de recurso.
   */
  obtenerResolvedor(tipo: TipoRecurso): ResolvedorDeAlcance | null {
    return this.resolvedores.get(tipo) || null;
  }

  /**
   * Lista todos los tipos registrados.
   */
  tipos(): ReadonlyArray<TipoRecurso> {
    return Array.from(this.exigencias.keys());
  }
}

// Instancia global
export const registroDeRecursos = new RegistroDeRecursos();

/**
 * Valida el registro al arrancar.
 * Se llama una sola vez en `main.ts` o en el bootstrap de NestJS.
 */
export function validarRegistroDeRecursosAlArrancar(): void {
  registroDeRecursos.validar();
}
