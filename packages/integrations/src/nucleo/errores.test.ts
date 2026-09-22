import { describe, it, expect } from 'vitest';
import {
  crearErrorIntegracion,
  esClaseReintentable,
  type ClaseErrorIntegracion,
  type ProveedorDeIntegracion,
} from './errores';

describe('Errores de integración', () => {
  describe('esClaseReintentable', () => {
    it('clasifica como reintentables los errores de capacidad y red', () => {
      const reintentables: ClaseErrorIntegracion[] = [
        'LIMITE_DE_USO',
        'FALLO_DEL_PROVEEDOR',
        'TIEMPO_AGOTADO',
        'SIN_CONEXION',
        'CIRCUITO_ABIERTO',
      ];

      for (const clase of reintentables) {
        expect(esClaseReintentable(clase)).toBe(true);
      }
    });

    it('clasifica como no reintentables los errores de lógica', () => {
      const noReintentables: ClaseErrorIntegracion[] = [
        'PETICION_INVALIDA',
        'CREDENCIAL_RECHAZADA',
        'CONFIGURACION_AUSENTE',
        'RESPUESTA_INESPERADA',
      ];

      for (const clase of noReintentables) {
        expect(esClaseReintentable(clase)).toBe(false);
      }
    });
  });

  describe('crearErrorIntegracion', () => {
    it('construye un error con los campos obligatorios', () => {
      const error = crearErrorIntegracion({
        proveedor: 'SENDGRID',
        clase: 'FALLO_DEL_PROVEEDOR',
      });

      expect(error.proveedor).toBe('SENDGRID');
      expect(error.clase).toBe('FALLO_DEL_PROVEEDOR');
      expect(error.codigo).toBe('SENDGRID_FALLO_DEL_PROVEEDOR');
      expect(error.reintentable).toBe(true);
      expect(error.mensajeUsuario).toBeTruthy();
      expect(error.codigoDelProveedor).toBeNull();
      expect(error.referencia).toBeNull();
    });

    it('agrega un detalle al código si se proporciona', () => {
      const error = crearErrorIntegracion({
        proveedor: 'SENDGRID',
        clase: 'PETICION_INVALIDA',
        detalle: 'email-invalido',
      });

      expect(error.codigo).toBe('SENDGRID_PETICION_INVALIDA_email-invalido');
    });

    it('acepta un código del proveedor para el registro', () => {
      const error = crearErrorIntegracion({
        proveedor: 'SENDGRID',
        clase: 'CREDENCIAL_RECHAZADA',
        codigoDelProveedor: 'ERR_403_UNAUTHORIZED',
      });

      expect(error.codigoDelProveedor).toBe('ERR_403_UNAUTHORIZED');
    });

    it('acepta una referencia de correlación', () => {
      const error = crearErrorIntegracion({
        proveedor: 'SENDGRID',
        clase: 'TIEMPO_AGOTADO',
        referencia: 'req-xyz-123',
      });

      expect(error.referencia).toBe('req-xyz-123');
    });

    it('acepta un mensaje de usuario personalizado', () => {
      const mensaje = 'Por favor, intentá más tarde.';
      const error = crearErrorIntegracion({
        proveedor: 'BASE_LOCAL_DE_UBICACION',
        clase: 'CONFIGURACION_AUSENTE',
        mensajeUsuario: mensaje,
      });

      expect(error.mensajeUsuario).toBe(mensaje);
    });

    it('usa el mensaje por defecto según la clase si no se proporciona uno', () => {
      const error1 = crearErrorIntegracion({
        proveedor: 'SENDGRID',
        clase: 'TIEMPO_AGOTADO',
      });
      const error2 = crearErrorIntegracion({
        proveedor: 'SENDGRID',
        clase: 'PETICION_INVALIDA',
      });

      expect(error1.mensajeUsuario).not.toBe(error2.mensajeUsuario);
      expect(error1.mensajeUsuario).toContain('tardó');
      expect(error2.mensajeUsuario).toContain('Probá');
    });
  });
});
