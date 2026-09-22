import { describe, it, expect } from 'vitest';
import { verificarMensaje, envioFallido } from './puerto';
import type { MensajeTransaccional, AccionDeCorreo } from '../contrato';

describe('Puerto de correo transaccional', () => {
  describe('verificarMensaje', () => {
    function crearMensaje(overrides: Partial<MensajeTransaccional> = {}): MensajeTransaccional {
      // CONFIRMACION_DE_CORREO requiere CONFIRMAR y PEDIR_ENLACE_NUEVO
      const acciones: readonly [AccionDeCorreo, ...AccionDeCorreo[]] = [
        { clave: 'CONFIRMAR', url: 'https://mejorar.app/confirmar' },
        { clave: 'PEDIR_ENLACE_NUEVO', url: 'https://mejorar.app/nuevo-enlace' },
      ];
      return {
        destinatario: 'usuario@example.com',
        claveDeIdempotencia: 'msg-2026-09-21-001',
        plantilla: 'CONFIRMACION_DE_CORREO',
        acciones,
        variables: [],
        ...overrides,
      };
    }

    it('acepta un mensaje bien formado', () => {
      const mensaje = crearMensaje({
        destinatario: 'javier@example.com',
        claveDeIdempotencia: '12345678',
      });

      expect(verificarMensaje(mensaje)).toBeNull();
    });

    it('rechaza destinatario mal formado', () => {
      const error = verificarMensaje(crearMensaje({ destinatario: 'no-es-correo' }));

      expect(error).not.toBeNull();
      expect(error?.codigo).toContain('SENDGRID_PETICION_INVALIDA');
      expect(error?.codigo).toContain('destinatario');
    });

    it('rechaza clave de idempotencia demasiado corta', () => {
      const error = verificarMensaje(crearMensaje({ claveDeIdempotencia: '123' }));

      expect(error).not.toBeNull();
      expect(error?.codigo).toContain('clave-de-idempotencia');
    });

    it('rechaza plantilla desconocida', () => {
      const mensaje = crearMensaje({
        plantilla: 'PLANTILLA_INEXISTENTE' as any,
      });

      const error = verificarMensaje(mensaje);

      expect(error).not.toBeNull();
      expect(error?.codigo).toContain('plantilla-desconocida');
    });

    it('rechaza correo sin acciones', () => {
      const mensaje = crearMensaje({
        acciones: [] as any,
      });

      const error = verificarMensaje(mensaje);

      expect(error).not.toBeNull();
      expect(error?.codigo).toContain('correo-sin-accion');
    });

    it('rechaza una acción con URL no segura', () => {
      const error = verificarMensaje(
        crearMensaje({
          acciones: [
            { clave: 'CONFIRMAR', url: 'http://inseguro.com' },
            { clave: 'PEDIR_ENLACE_NUEVO', url: 'https://mejorar.app/nuevo' },
          ] as any,
        }),
      );

      expect(error).not.toBeNull();
      expect(error?.codigo).toContain('accion-sin-enlace-seguro');
    });

    it('rechaza variable con clave prohibida: CUIL', () => {
      const error = verificarMensaje(
        crearMensaje({
          variables: [
            { clave: 'cuil', valor: '12345678901' },
          ] as any,
        }),
      );

      expect(error).not.toBeNull();
      expect(error?.codigo).toContain('variable-con-clave-prohibida');
    });

    it('rechaza variable con CUIT/CUIL en el valor', () => {
      const error = verificarMensaje(
        crearMensaje({
          plantilla: 'CONFIRMACION_DE_CORREO',
          variables: [
            { clave: 'nombreParaMostrar', valor: '20-12345678-9' },
          ] as any,
        }),
      );

      expect(error).not.toBeNull();
      expect(error?.codigo).toContain('identificador-fiscal');
    });

    it('rechaza variable con datos patrimoniales (símbolo $)', () => {
      const error = verificarMensaje(
        crearMensaje({
          variables: [
            { clave: 'nombreParaMostrar', valor: '$1234,56' },
          ] as any,
        }),
      );

      expect(error).not.toBeNull();
      expect(error?.codigo).toContain('dato-patrimonial');
    });

    it('rechaza variable demasiado larga', () => {
      const error = verificarMensaje(
        crearMensaje({
          variables: [
            { clave: 'nombreParaMostrar', valor: 'a'.repeat(121) },
          ] as any,
        }),
      );

      expect(error).not.toBeNull();
      expect(error?.codigo).toContain('variable-demasiado-larga');
    });

    it('rechaza variable fuera del vocabulario permitido', () => {
      const error = verificarMensaje(
        crearMensaje({
          variables: [
            { clave: 'variableArbitraria', valor: 'algo' },
          ] as any,
        }),
      );

      expect(error).not.toBeNull();
      expect(error?.codigo).toContain('variable-fuera-del-vocabulario');
    });

    it('acepta variables válidas de la plantilla', () => {
      const error = verificarMensaje(
        crearMensaje({
          variables: [
            { clave: 'nombreParaMostrar', valor: 'Juan' },
            { clave: 'venceEn', valor: '24 horas' },
          ] as any,
        }),
      );

      expect(error).toBeNull();
    });
  });

  describe('envioFallido', () => {
    it('construye un resultado de error válido', () => {
      const resultado = envioFallido({
        clase: 'ENTRADA_INVALIDA',
        codigo: 'SENDGRID_PETICION_INVALIDA_email',
        referencia: 'ref-001',
      });

      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.error.clase).toBe('ENTRADA_INVALIDA');
        expect(resultado.error.codigo).toContain('email');
        expect(resultado.error.referencia).toBe('ref-001');
      }
    });
  });
});
