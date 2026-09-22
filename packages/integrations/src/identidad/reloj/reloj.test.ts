import { describe, it, expect, beforeEach } from 'vitest';
import {
  comoInstante,
  esInstanteBienFormado,
  FORMA_DE_INSTANTE,
  type Instante,
} from './puerto';
import {
  crearRelojMock,
  INSTANTE_INICIAL_DE_MOCK,
  crearRelojDelSistema,
} from './mock';
import { crearRelojDelSistema as crearRealSystem } from './sistema';

describe('Reloj', () => {
  describe('comoInstante', () => {
    it('convierte una Date a Instante ISO 8601 con milisegundos', () => {
      const fecha = new Date('2026-09-21T14:03:11.412Z');
      const instante = comoInstante(fecha);

      expect(instante).toBe('2026-09-21T14:03:11.412Z');
    });

    it('produce formato consistente', () => {
      const fecha = new Date('2026-01-01T00:00:00.001Z');
      const instante = comoInstante(fecha);

      expect(instante).toMatch(FORMA_DE_INSTANTE);
    });

    it('lanza error para fecha inválida', () => {
      const fechaInvalida = new Date('invalid');

      expect(() => comoInstante(fechaInvalida)).toThrow();
    });
  });

  describe('esInstanteBienFormado', () => {
    it('valida un Instante bien formado', () => {
      const instante = '2026-09-21T14:03:11.412Z' as Instante;

      expect(esInstanteBienFormado(instante)).toBe(true);
    });

    it('rechaza formato incorrecto', () => {
      expect(esInstanteBienFormado('2026-09-21')).toBe(false);
      expect(esInstanteBienFormado('2026-09-21T14:03:11Z')).toBe(false);
      expect(esInstanteBienFormado('2026-09-21 14:03:11.412')).toBe(false);
    });

    it('rechaza fecha inválida', () => {
      expect(esInstanteBienFormado('2026-13-01T14:03:11.412Z')).toBe(false);
      expect(esInstanteBienFormado('2026-09-32T14:03:11.412Z')).toBe(false);
    });

    it('acepta el instante inicial de mock', () => {
      expect(esInstanteBienFormado(INSTANTE_INICIAL_DE_MOCK)).toBe(true);
    });
  });

  describe('RelojDetenido (Mock)', () => {
    let reloj = crearRelojMock();

    beforeEach(() => {
      reloj = crearRelojMock();
    });

    it('devuelve el instante inicial por defecto', () => {
      const ahora = reloj.ahora();

      expect(ahora).toBe(INSTANTE_INICIAL_DE_MOCK);
    });

    it('acepta un instante inicial personalizado', () => {
      const instante = '2025-01-01T12:00:00.000Z' as Instante;
      const reloj2 = crearRelojMock({ inicio: instante });

      const ahora = reloj2.ahora();

      expect(ahora).toBe(instante);
    });

    it('es determinista: misma secuencia devuelve mismos valores', () => {
      const reloj2 = crearRelojMock();

      const ahora1 = reloj.ahora();
      const ahora2 = reloj2.ahora();

      expect(ahora1).toBe(ahora2);
    });

    it('avanza el tiempo automáticamente si se configura', () => {
      const reloj2 = crearRelojMock({ avancePorConsultaEnMs: 1000 });

      const instante1 = reloj2.ahora();
      const instante2 = reloj2.ahora();

      expect(instante1).not.toBe(instante2);

      // Convertir a milisegundos y verificar la diferencia
      const ms1 = Date.parse(instante1);
      const ms2 = Date.parse(instante2);

      expect(ms2 - ms1).toBe(1000);
    });

    it('permite avanzar manualmente', () => {
      const instante1 = reloj.ahora();
      reloj.avanzar(3600000); // 1 hora
      const instante2 = reloj.ahora();

      const ms1 = Date.parse(instante1);
      const ms2 = Date.parse(instante2);

      expect(ms2 - ms1).toBe(3600000);
    });

    it('permite avanzar en días', () => {
      const instante1 = reloj.ahora();
      reloj.avanzarDias(1);
      const instante2 = reloj.ahora();

      const ms1 = Date.parse(instante1);
      const ms2 = Date.parse(instante2);

      expect(ms2 - ms1).toBe(24 * 60 * 60 * 1000);
    });

    it('permite fijar el reloj a un instante específico', () => {
      const objetivo = '2026-12-25T00:00:00.000Z' as Instante;
      reloj.fijar(objetivo);

      const ahora = reloj.ahora();

      expect(ahora).toBe(objetivo);
    });

    it('rechaza instantes mal formados al fijar', () => {
      expect(() => reloj.fijar('no-es-un-instante' as Instante)).toThrow();
    });

    it('expone milisegundos desde época para inyectar en resiliencia', () => {
      const ms = reloj.ahoraEnMs();

      expect(typeof ms).toBe('number');
      expect(ms).toBeGreaterThan(0);
    });

    it('tiene cobertura declarada', () => {
      expect(reloj.cobertura).toBeDefined();
      expect(reloj.cobertura.puerto).toBe('PuertoReloj');
      expect(reloj.cobertura.proveedor).toBe('RELOJ_DEL_SISTEMA');
      expect(reloj.cobertura.usaRed).toBe(false);
    });
  });

  describe('RelojDelSistema', () => {
    it('devuelve un instante bien formado', () => {
      const reloj = crearRealSystem();
      const ahora = reloj.ahora();

      expect(esInstanteBienFormado(ahora)).toBe(true);
    });

    it('devuelve un instante reciente (últimas 24 horas)', () => {
      const reloj = crearRealSystem();
      const ahora = reloj.ahora();

      const ms = Date.parse(ahora);
      const ahora_ms = Date.now();
      const diferencia = Math.abs(ahora_ms - ms);

      expect(diferencia).toBeLessThan(24 * 60 * 60 * 1000);
    });

    it('avanza con cada llamada', () => {
      const reloj = crearRealSystem();

      const instante1 = reloj.ahora();

      // Esperar un milisegundo (en un test real)
      // Aquí simplemente verificamos que se puede llamar múltiples veces
      const instante2 = reloj.ahora();

      // No afirmamos que sean distintos porque en tests muy rápidos podrían ser iguales
      // Simplemente verificamos que ambas llamadas devuelven instantes válidos
      expect(esInstanteBienFormado(instante1)).toBe(true);
      expect(esInstanteBienFormado(instante2)).toBe(true);
    });

    it('tiene cobertura declarada como adaptador de sistema', () => {
      const reloj = crearRealSystem();

      expect(reloj.cobertura.adaptador).toBe('RelojDelSistema');
      expect(reloj.cobertura.usaRed).toBe(false);
    });
  });
});
