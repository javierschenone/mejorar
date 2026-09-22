/**
 * Roles, permisos y derivación — ADR-022 capas 1 y 2.
 *
 * CA-18: el mapa rol → permisos es una tabla de datos verificable.
 * CA-29, CA-30: vigencia de matrícula y efecto inmediato al suspender.
 * CA-32, CA-38: MFA obligatorio para ADMINISTRADOR y ABOGADO.
 * R-07: autorización por permiso concreto, nunca por rol.
 *
 * Las pruebas verifican que el mapa existe, que sus invariantes se cumplen,
 * y que la derivación incorpora los ajustes y restricciones correctamente.
 */

import { describe, expect, it } from 'vitest';

import type { AjusteDePermiso, Instante, PerfilDeAutorizacion } from './contrato/v1';
import { derivarPermisos, elSegundoFactorEstaActivo, mapaRolPermisos, permisosDeCuentaNoOperativa } from './permisos';
import { comoInstante } from './tiempo';

function instante(texto: string): Instante {
  const resultado = comoInstante(texto);
  if (!resultado.ok) throw new Error(`instante de prueba inválido: ${texto}`);
  return resultado.valor;
}

describe('CA-18 — mapa rol → permisos por defecto', () => {
  it('el mapa contiene exactamente los tres roles', () => {
    expect(Object.keys(mapaRolPermisos)).toEqual(['CLIENTE', 'ABOGADO', 'ADMINISTRADOR']);
  });

  it('CLIENTE tiene permisos de perfil, sesión, MFA e inscripción de restitución', () => {
    const permisos = mapaRolPermisos.CLIENTE;
    expect(permisos).toContain('perfil.leer.propio');
    expect(permisos).toContain('perfil.editar.propio');
    expect(permisos).toContain('sesion.listar.propia');
    expect(permisos).toContain('mfa.inscribir.propio');
    expect(permisos).toContain('mfa.desactivar.propio'); // único rol con esta potestad
    expect(permisos).toContain('contrasena.cambiar.propia');
  });

  it('ABOGADO tiene permisos de profesional además de CLIENTE (menos desactivar MFA)', () => {
    const permisos = mapaRolPermisos.ABOGADO;
    expect(permisos).toContain('perfil.leer.propio');
    expect(permisos).toContain('perfil.editar.propio');
    expect(permisos).toContain('perfil.declararEspecialidades.propio');
    expect(permisos).toContain('caso.leer.asignado');
    expect(permisos).toContain('caso.actuar.asignado');
    expect(permisos).toContain('caso.recibirAsignacion');
    expect(permisos).toContain('mfa.inscribir.propio');
    expect(permisos).not.toContain('mfa.desactivar.propio');
  });

  it('ADMINISTRADOR tiene permisos de auditoría y gestión de usuarios', () => {
    const permisos = mapaRolPermisos.ADMINISTRADOR;
    expect(permisos).toContain('auditoria.leer.total');
    expect(permisos).toContain('usuario.listar');
    expect(permisos).toContain('usuario.leer');
    expect(permisos).toContain('usuario.crearAdministrador');
    expect(permisos).toContain('usuario.suspender');
    expect(permisos).toContain('matricula.verificar');
    expect(permisos).not.toContain('mfa.desactivar.propio');
  });

  it('CA-32: ADMINISTRADOR NO tiene mfa.desactivar.propio', () => {
    expect(mapaRolPermisos.ADMINISTRADOR).not.toContain('mfa.desactivar.propio');
  });

  it('CA-38: ABOGADO NO tiene mfa.desactivar.propio', () => {
    expect(mapaRolPermisos.ABOGADO).not.toContain('mfa.desactivar.propio');
  });

  it('CA-39: CLIENTE ES el único que puede desactivar MFA', () => {
    expect(mapaRolPermisos.CLIENTE).toContain('mfa.desactivar.propio');
    expect(mapaRolPermisos.ABOGADO).not.toContain('mfa.desactivar.propio');
    expect(mapaRolPermisos.ADMINISTRADOR).not.toContain('mfa.desactivar.propio');
  });

  it('el mapa es de solo lectura en profundidad (verificable por tipo)', () => {
    // El mapa mapaRolPermisos es readonly en el tipo, lo que evita mutaciones
    // accidentales durante el desarrollo. La verificación ocurre en el
    // compilador TypeScript, no en runtime.
    expect(mapaRolPermisos.CLIENTE.length).toBeGreaterThan(0);
  });
});

describe('CA-18 — permisos de cuenta no operativa', () => {
  it('cuenta NO_VERIFICADA: solo perfil, listar y cerrar sesión', () => {
    const permisos = permisosDeCuentaNoOperativa.NO_VERIFICADA;
    expect(permisos).toEqual(['perfil.leer.propio', 'sesion.listar.propia', 'sesion.cerrar.propia']);
  });

  it('cuenta BLOQUEADA_TEMPORALMENTE: solo perfil y sesión', () => {
    const permisos = permisosDeCuentaNoOperativa.BLOQUEADA_TEMPORALMENTE;
    expect(permisos).toEqual(['perfil.leer.propio', 'sesion.listar.propia', 'sesion.cerrar.propia']);
  });

  it('cuenta PENDIENTE_DE_INSCRIPCION_MFA: permite inscribir segundo factor', () => {
    const permisos = permisosDeCuentaNoOperativa.PENDIENTE_DE_INSCRIPCION_MFA;
    expect(permisos).toContain('mfa.inscribir.propio');
    expect(permisos).toContain('perfil.leer.propio');
  });

  it('cuenta SUSPENDIDA: acceso a datos propios pero no a operaciones', () => {
    const permisos = permisosDeCuentaNoOperativa.SUSPENDIDA;
    expect(permisos).toContain('perfil.leer.propio');
    expect(permisos).toContain('perfil.exportar.propio');
    expect(permisos).not.toContain('mfa.inscribir.propio');
  });

  it('cuenta PURGADA: sin permisos', () => {
    expect(permisosDeCuentaNoOperativa.PURGADA).toEqual([]);
  });
});

describe('derivarPermisos — función pura de derivación', () => {
  const momento = instante('2026-01-15T10:00:00.000Z');

  it('cliente ACTIVO con MFA activo: todos los permisos de CLIENTE', () => {
    const perfil: PerfilDeAutorizacion = {
      sujeto: 'user-1' as any,
      rol: 'CLIENTE',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'ACTIVO',
      verificacionProfesional: null,
      ajustes: [],
    };

    const permisos = derivarPermisos(perfil, momento);

    expect(permisos.size).toBe(mapaRolPermisos.CLIENTE.length);
    for (const permiso of mapaRolPermisos.CLIENTE) {
      expect(permisos.has(permiso)).toBe(true);
    }
  });

  it('abogado ACTIVO con MFA activo: todos los permisos de ABOGADO', () => {
    const perfil: PerfilDeAutorizacion = {
      sujeto: 'user-2' as any,
      rol: 'ABOGADO',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'ACTIVO',
      verificacionProfesional: { estado: 'VIGENTE', verificadaEn: momento, vigenciaHasta: '2026-06-15', evidencia: {} as any },
      ajustes: [],
    };

    const permisos = derivarPermisos(perfil, momento);

    for (const permiso of mapaRolPermisos.ABOGADO) {
      expect(permisos.has(permiso)).toBe(true);
    }
  });

  it('administrador ACTIVO con MFA activo: todos los permisos de ADMINISTRADOR', () => {
    const perfil: PerfilDeAutorizacion = {
      sujeto: 'user-3' as any,
      rol: 'ADMINISTRADOR',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'ACTIVO',
      verificacionProfesional: null,
      ajustes: [],
    };

    const permisos = derivarPermisos(perfil, momento);

    for (const permiso of mapaRolPermisos.ADMINISTRADOR) {
      expect(permisos.has(permiso)).toBe(true);
    }
  });

  it('cuenta NO_VERIFICADA: solo permisos de NO_VERIFICADA', () => {
    const perfil: PerfilDeAutorizacion = {
      sujeto: 'user-1' as any,
      rol: 'CLIENTE',
      estadoCuenta: 'NO_VERIFICADA',
      estadoMfa: 'NO_CONFIGURADO',
      verificacionProfesional: null,
      ajustes: [],
    };

    const permisos = derivarPermisos(perfil, momento);

    const esperados = permisosDeCuentaNoOperativa.NO_VERIFICADA;
    expect(permisos.size).toBe(esperados.length);
    for (const permiso of esperados) {
      expect(permisos.has(permiso)).toBe(true);
    }
  });

  it('CA-30: matrícula SUSPENDIDA retira todos los permisos de trabajo profesional', () => {
    const perfil: PerfilDeAutorizacion = {
      sujeto: 'user-2' as any,
      rol: 'ABOGADO',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'ACTIVO',
      verificacionProfesional: {
        estado: 'SUSPENDIDA',
        desde: instante('2026-01-10T00:00:00.000Z'),
        dispuestaPor: 'admin-1' as any,
        motivo: 'NOTIFICACION_DEL_COLEGIO',
      },
      ajustes: [],
    };

    const permisos = derivarPermisos(perfil, momento);

    expect(permisos.has('caso.leer.asignado')).toBe(false);
    expect(permisos.has('caso.actuar.asignado')).toBe(false);
    expect(permisos.has('caso.recibirAsignacion')).toBe(false);
    expect(permisos.has('perfil.leer.propio')).toBe(true); // Otros sí permanecen
  });

  it('CA-29: matrícula VENCIDA retira solo caso.recibirAsignacion', () => {
    const perfil: PerfilDeAutorizacion = {
      sujeto: 'user-2' as any,
      rol: 'ABOGADO',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'ACTIVO',
      verificacionProfesional: {
        estado: 'VENCIDA',
        verificadaEn: instante('2025-01-15T00:00:00.000Z'),
        vigenciaHasta: '2025-12-31',
        evidencia: {} as any,
      },
      ajustes: [],
    };

    const permisos = derivarPermisos(perfil, momento);

    expect(permisos.has('caso.recibirAsignacion')).toBe(false);
    expect(permisos.has('caso.leer.asignado')).toBe(true);
    expect(permisos.has('caso.actuar.asignado')).toBe(true);
  });

  it('ADR-023 cerrojo 4: rol profesional sin MFA activo solo puede inscribir segundo factor', () => {
    const perfil: PerfilDeAutorizacion = {
      sujeto: 'user-2' as any,
      rol: 'ABOGADO',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'NO_CONFIGURADO', // Sin MFA
      verificacionProfesional: { estado: 'VIGENTE', verificadaEn: momento, vigenciaHasta: '2026-06-15', evidencia: {} as any },
      ajustes: [],
    };

    const permisos = derivarPermisos(perfil, momento);

    // Solo puede inscribir
    expect(permisos.size).toBe(1);
    expect(permisos.has('mfa.inscribir.propio')).toBe(true);
    expect(permisos.has('caso.leer.asignado')).toBe(false);
  });

  it('CA-32: administrador sin MFA activo: solo puede inscribir', () => {
    const perfil: PerfilDeAutorizacion = {
      sujeto: 'user-3' as any,
      rol: 'ADMINISTRADOR',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'INSCRIPCION_PENDIENTE_DE_CONFIRMACION',
      verificacionProfesional: null,
      ajustes: [],
    };

    const permisos = derivarPermisos(perfil, momento);

    expect(permisos.size).toBe(1);
    expect(permisos.has('mfa.inscribir.propio')).toBe(true);
  });
});

describe('derivarPermisos — ajustes individuales de permiso', () => {
  const momento = instante('2026-01-15T10:00:00.000Z');

  it('ajuste CONCEDE: agrega permiso que no estaba en el mapa', () => {
    const perfil: PerfilDeAutorizacion = {
      sujeto: 'user-1' as any,
      rol: 'CLIENTE',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'ACTIVO',
      verificacionProfesional: null,
      ajustes: [
        {
          permiso: 'auditoria.leer.total',
          efecto: 'CONCEDE',
          otorgadoPor: 'admin-1' as any,
          momento: instante('2026-01-10T10:00:00.000Z'),
          vigenciaHasta: null,
        },
      ],
    };

    const permisos = derivarPermisos(perfil, momento);

    expect(permisos.has('auditoria.leer.total')).toBe(true);
  });

  it('ajuste RETIRA: quita permiso que estaba en el mapa', () => {
    const perfil: PerfilDeAutorizacion = {
      sujeto: 'user-1' as any,
      rol: 'CLIENTE',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'ACTIVO',
      verificacionProfesional: null,
      ajustes: [
        {
          permiso: 'mfa.inscribir.propio',
          efecto: 'RETIRA',
          otorgadoPor: 'admin-1' as any,
          momento: instante('2026-01-10T10:00:00.000Z'),
          vigenciaHasta: null,
        },
      ],
    };

    const permisos = derivarPermisos(perfil, momento);

    expect(permisos.has('mfa.inscribir.propio')).toBe(false);
  });

  it('ajustes se aplican en orden cronológico', () => {
    const perfil: PerfilDeAutorizacion = {
      sujeto: 'user-2' as any,
      rol: 'ABOGADO',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'ACTIVO',
      verificacionProfesional: { estado: 'VIGENTE', verificadaEn: momento, vigenciaHasta: '2026-06-15', evidencia: {} as any },
      ajustes: [
        {
          permiso: 'auditoria.leer.total',
          efecto: 'RETIRA',
          otorgadoPor: 'admin-1' as any,
          momento: instante('2026-01-05T10:00:00.000Z'),
          vigenciaHasta: null,
        },
        {
          permiso: 'auditoria.leer.total',
          efecto: 'CONCEDE',
          otorgadoPor: 'admin-1' as any,
          momento: instante('2026-01-10T10:00:00.000Z'),
          vigenciaHasta: null,
        },
      ],
    };

    const permisos = derivarPermisos(perfil, momento);

    // El ajuste posterior gana: tiene el permiso
    expect(permisos.has('auditoria.leer.total')).toBe(true);
  });

  it('ajuste vencido no se aplica', () => {
    const perfil: PerfilDeAutorizacion = {
      sujeto: 'user-2' as any,
      rol: 'ABOGADO',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'ACTIVO',
      verificacionProfesional: { estado: 'VIGENTE', verificadaEn: momento, vigenciaHasta: '2026-06-15', evidencia: {} as any },
      ajustes: [
        {
          permiso: 'auditoria.leer.total',
          efecto: 'CONCEDE',
          otorgadoPor: 'admin-1' as any,
          momento: instante('2026-01-05T10:00:00.000Z'),
          vigenciaHasta: instante('2026-01-10T23:59:59.999Z'), // Vence antes del momento
        },
      ],
    };

    const permisos = derivarPermisos(perfil, momento);

    expect(permisos.has('auditoria.leer.total')).toBe(false);
  });

  it('ajuste CONCEDE de permiso blindado (mfa.desactivar para ABOGADO) se ignora', () => {
    const perfil: PerfilDeAutorizacion = {
      sujeto: 'user-2' as any,
      rol: 'ABOGADO',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'ACTIVO',
      verificacionProfesional: { estado: 'VIGENTE', verificadaEn: momento, vigenciaHasta: '2026-06-15', evidencia: {} as any },
      ajustes: [
        {
          permiso: 'mfa.desactivar.propio',
          efecto: 'CONCEDE',
          otorgadoPor: 'admin-1' as any,
          momento: instante('2026-01-10T10:00:00.000Z'),
          vigenciaHasta: null,
        },
      ],
    };

    const permisos = derivarPermisos(perfil, momento);

    // No se puede conceder porque está blindado para ABOGADO
    expect(permisos.has('mfa.desactivar.propio')).toBe(false);
  });
});

describe('elSegundoFactorEstaActivo — puente con permisos', () => {
  const momento = instante('2026-01-15T10:00:00.000Z');

  it('si el segundo factor está ACTIVO: elSegundoFactorEstaActivo retorna true', () => {
    const perfil: PerfilDeAutorizacion = {
      sujeto: 'user-1' as any,
      rol: 'CLIENTE',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'ACTIVO',
      verificacionProfesional: null,
      ajustes: [],
    };

    const permisos = derivarPermisos(perfil, momento);

    expect(elSegundoFactorEstaActivo(permisos)).toBe(true);
  });

  it('si el segundo factor NO está ACTIVO: elSegundoFactorEstaActivo retorna false', () => {
    const perfil: PerfilDeAutorizacion = {
      sujeto: 'user-1' as any,
      rol: 'CLIENTE',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'NO_CONFIGURADO',
      verificacionProfesional: null,
      ajustes: [],
    };

    const permisos = derivarPermisos(perfil, momento);

    expect(elSegundoFactorEstaActivo(permisos)).toBe(false);
  });

  it('el puente se basa en mfa.regenerarCodigosDeRespaldo.propio', () => {
    // El nombre revela la intención: si puedes regenerar códigos,
    // el factor existe (aunque no es la forma más elegante, es lo que hay).

    const permisos = new Set(['mfa.regenerarCodigosDeRespaldo.propio']);
    expect(elSegundoFactorEstaActivo(permisos)).toBe(true);

    const permisosOtros = new Set(['perfil.leer.propio']);
    expect(elSegundoFactorEstaActivo(permisosOtros)).toBe(false);
  });
});
