import { describe, it, expect, beforeEach } from 'vitest';
import { RegistroDeIdempotenciaEnMemoria, claveDeIdempotenciaValida } from './idempotencia';

describe('Idempotencia', () => {
  describe('claveDeIdempotenciaValida', () => {
    it('acepta claves válidas de 8+ caracteres', () => {
      expect(claveDeIdempotenciaValida('12345678')).toBe(true);
      expect(claveDeIdempotenciaValida('correoPendiente-2026-09-21')).toBe(true);
      expect(claveDeIdempotenciaValida('a'.repeat(255))).toBe(true);
    });

    it('rechaza claves muy cortas', () => {
      expect(claveDeIdempotenciaValida('1234567')).toBe(false);
      expect(claveDeIdempotenciaValida('')).toBe(false);
      expect(claveDeIdempotenciaValida('  ')).toBe(false);
    });

    it('rechaza claves demasiado largas', () => {
      expect(claveDeIdempotenciaValida('a'.repeat(256))).toBe(false);
    });

    it('rechaza claves sólo con espacios', () => {
      expect(claveDeIdempotenciaValida('        ')).toBe(false);
    });
  });

  describe('RegistroDeIdempotenciaEnMemoria', () => {
    let registro: RegistroDeIdempotenciaEnMemoria<string>;

    beforeEach(() => {
      registro = new RegistroDeIdempotenciaEnMemoria<string>();
    });

    it('devuelve null la primera vez que se consulta una clave', async () => {
      const resultado = await registro.recordado('clave-nueva-123');
      expect(resultado).toBeNull();
    });

    it('recuerda un valor y lo devuelve en consultas posteriores', async () => {
      const clave = 'operacion-001';
      const valor = 'id-msg-12345';

      await registro.recordar(clave, valor);
      const recordado = await registro.recordado(clave);

      expect(recordado).toBe(valor);
    });

    it('mantiene múltiples valores simultáneamente', async () => {
      await registro.recordar('clave-1', 'valor-1');
      await registro.recordar('clave-2', 'valor-2');
      await registro.recordar('clave-3', 'valor-3');

      expect(await registro.recordado('clave-1')).toBe('valor-1');
      expect(await registro.recordado('clave-2')).toBe('valor-2');
      expect(await registro.recordado('clave-3')).toBe('valor-3');
    });

    it('puede sobrescribir un valor existente', async () => {
      const clave = 'sobreescribible';

      await registro.recordar(clave, 'primer-valor');
      expect(await registro.recordado(clave)).toBe('primer-valor');

      await registro.recordar(clave, 'segundo-valor');
      expect(await registro.recordado(clave)).toBe('segundo-valor');
    });

    it('descarta la entrada más vieja cuando se alcanza el máximo', async () => {
      const registro2 = new RegistroDeIdempotenciaEnMemoria<string>(3);

      await registro2.recordar('clave-1', 'valor-1');
      await registro2.recordar('clave-2', 'valor-2');
      await registro2.recordar('clave-3', 'valor-3');

      expect(registro2.cantidad).toBe(3);

      // La siguiente entrada debe descartar la más vieja (clave-1)
      await registro2.recordar('clave-4', 'valor-4');

      expect(registro2.cantidad).toBe(3);
      expect(await registro2.recordado('clave-1')).toBeNull();
      expect(await registro2.recordado('clave-4')).toBe('valor-4');
    });

    it('expone el contador de cantidad', async () => {
      expect(registro.cantidad).toBe(0);

      await registro.recordar('clave-1', 'valor-1');
      expect(registro.cantidad).toBe(1);

      await registro.recordar('clave-2', 'valor-2');
      expect(registro.cantidad).toBe(2);
    });

    it('permite limpiar todas las entradas', async () => {
      await registro.recordar('clave-1', 'valor-1');
      await registro.recordar('clave-2', 'valor-2');

      expect(registro.cantidad).toBe(2);

      registro.limpiar();

      expect(registro.cantidad).toBe(0);
      expect(await registro.recordado('clave-1')).toBeNull();
    });
  });
});
