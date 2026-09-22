import { describe, it, expect } from 'vitest';
import type { DeclaracionDeCobertura, AdaptadorDeclarado } from './cobertura';

describe('Cobertura', () => {
  describe('DeclaracionDeCobertura', () => {
    it('define la estructura de una declaración válida', () => {
      const cobertura: DeclaracionDeCobertura = {
        puerto: 'PuertoCorreoTransaccional',
        adaptador: 'SendgridMock',
        proveedor: 'SENDGRID',
        usaRed: false,
        esEncargadoDeTratamiento: false,
        cubre: ['Envío de correo transaccional'],
        noCubre: ['Correos de marketing'],
        version: 'mock/1.0',
      };

      expect(cobertura.puerto).toBe('PuertoCorreoTransaccional');
      expect(cobertura.adaptador).toBe('SendgridMock');
      expect(cobertura.usaRed).toBe(false);
      expect(cobertura.esEncargadoDeTratamiento).toBe(false);
      expect(cobertura.cubre).toHaveLength(1);
      expect(cobertura.noCubre).toHaveLength(1);
      expect(cobertura.version).toBe('mock/1.0');
    });

    it('permite versión null para adaptadores sin versionado', () => {
      const cobertura: DeclaracionDeCobertura = {
        puerto: 'PuertoDescripcionDeDispositivo',
        adaptador: 'AnalizadorLocal',
        proveedor: 'ANALIZADOR_LOCAL_DE_DISPOSITIVO',
        usaRed: false,
        esEncargadoDeTratamiento: false,
        cubre: [],
        noCubre: [],
        version: null,
      };

      expect(cobertura.version).toBeNull();
    });

    it('marca correctamente cuándo un adaptador usa red', () => {
      const conRed: DeclaracionDeCobertura = {
        puerto: 'PuertoCorreoTransaccional',
        adaptador: 'SendgridHttp',
        proveedor: 'SENDGRID',
        usaRed: true,
        esEncargadoDeTratamiento: true,
        cubre: [],
        noCubre: [],
        version: '1.0',
      };

      expect(conRed.usaRed).toBe(true);
      expect(conRed.esEncargadoDeTratamiento).toBe(true);
    });

    it('documenta qué cubre y qué no cubre', () => {
      const cobertura: DeclaracionDeCobertura = {
        puerto: 'PuertoUbicacionPorIp',
        adaptador: 'UbicacionPorIpMock',
        proveedor: 'BASE_LOCAL_DE_UBICACION',
        usaRed: false,
        esEncargadoDeTratamiento: false,
        cubre: [
          'País a partir de IPv4 e IPv6',
          'Provincia, aproximada',
        ],
        noCubre: [
          'Ciudad y coordenadas',
          'Redes móviles y proveedores con salida centralizada',
        ],
        version: 'mock-tabla-embebida/2026-09',
      };

      expect(cobertura.cubre).toHaveLength(2);
      expect(cobertura.noCubre).toHaveLength(2);
      expect(cobertura.cubre[0]).toContain('País');
      expect(cobertura.noCubre[0]).toContain('Ciudad');
    });
  });

  describe('AdaptadorDeclarado', () => {
    it('expone la cobertura como propiedad pública', () => {
      class AdaptadorEjemplo implements AdaptadorDeclarado {
        readonly cobertura: DeclaracionDeCobertura = {
          puerto: 'Test',
          adaptador: 'Ejemplo',
          proveedor: 'SENDGRID',
          usaRed: false,
          esEncargadoDeTratamiento: false,
          cubre: [],
          noCubre: [],
          version: null,
        };
      }

      const adaptador = new AdaptadorEjemplo();
      expect(adaptador.cobertura.puerto).toBe('Test');
      expect(adaptador.cobertura.adaptador).toBe('Ejemplo');
    });

    it('permite que distintos adaptadores declaren diferente cobertura', () => {
      class AdaptadorMock implements AdaptadorDeclarado {
        readonly cobertura: DeclaracionDeCobertura = {
          puerto: 'Correo',
          adaptador: 'Mock',
          proveedor: 'SENDGRID',
          usaRed: false,
          esEncargadoDeTratamiento: false,
          cubre: ['Modo de demostración'],
          noCubre: [],
          version: 'mock/1',
        };
      }

      class AdaptadorHttp implements AdaptadorDeclarado {
        readonly cobertura: DeclaracionDeCobertura = {
          puerto: 'Correo',
          adaptador: 'Http',
          proveedor: 'SENDGRID',
          usaRed: true,
          esEncargadoDeTratamiento: true,
          cubre: ['Envío real a través de API'],
          noCubre: [],
          version: 'sendgrid-api/v3',
        };
      }

      const mock = new AdaptadorMock();
      const http = new AdaptadorHttp();

      expect(mock.cobertura.usaRed).toBe(false);
      expect(http.cobertura.usaRed).toBe(true);

      expect(mock.cobertura.esEncargadoDeTratamiento).toBe(false);
      expect(http.cobertura.esEncargadoDeTratamiento).toBe(true);
    });
  });
});
