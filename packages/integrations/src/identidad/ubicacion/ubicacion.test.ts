import { describe, it, expect, beforeEach } from 'vitest';
import { analizarIp, ubicacion } from './puerto';
import { crearUbicacionPorIpMock } from './mock';

describe('Ubicación por IP', () => {
  describe('analizarIp', () => {
    it('analiza una IPv4 válida', () => {
      const analizada = analizarIp('200.45.12.34');

      expect(analizada).not.toBeNull();
      if (analizada) {
        expect(analizada.familia).toBe('IPV4');
        expect(analizada.esReservada).toBe(false);
      }
    });

    it('rechaza IPv4 con octetos fuera de rango', () => {
      expect(analizarIp('256.1.1.1')).toBeNull();
      expect(analizarIp('1.1.1.-1')).toBeNull();
    });

    it('rechaza IPv4 con formato incorrecto', () => {
      expect(analizarIp('1.1.1')).toBeNull();
      expect(analizarIp('1.1.1.1.1')).toBeNull();
    });

    it('analiza una IPv6 válida', () => {
      const analizada = analizarIp('2001:db8::1');

      expect(analizada).not.toBeNull();
      if (analizada) {
        expect(analizada.familia).toBe('IPV6');
      }
    });

    it('analiza IPv6 completa', () => {
      const analizada = analizarIp('2800:3f0:4001:1234:5678:9abc:def0:1234');

      expect(analizada).not.toBeNull();
      if (analizada) {
        expect(analizada.familia).toBe('IPV6');
      }
    });

    it('maneja IPv4 mapeada a IPv6', () => {
      const analizada = analizarIp('::ffff:192.0.2.1');

      expect(analizada).not.toBeNull();
      if (analizada) {
        expect(analizada.familia).toBe('IPV4');
      }
    });

    it('marca rangos reservados como tales', () => {
      const privada = analizarIp('10.0.0.1'); // Privada
      const bucleLocal = analizarIp('127.0.0.1');
      const ipv6Privada = analizarIp('::1'); // Bucle local IPv6

      expect(privada?.esReservada).toBe(true);
      expect(bucleLocal?.esReservada).toBe(true);
      expect(ipv6Privada?.esReservada).toBe(true);
    });

    it('no marca direcciones públicas como reservadas', () => {
      const publica = analizarIp('200.45.12.34');

      expect(publica?.esReservada).toBe(false);
    });

    it('rechaza IPv4 vacía', () => {
      expect(analizarIp('')).toBeNull();
    });

    it('recorta espacios antes de procesar', () => {
      const analizada = analizarIp('  200.45.12.34  ');

      expect(analizada).not.toBeNull();
      expect(analizada?.familia).toBe('IPV4');
    });

    it('trata IPv6 entre corchetes', () => {
      const analizada = analizarIp('[2001:db8::1]');

      expect(analizada).not.toBeNull();
      expect(analizada?.familia).toBe('IPV6');
    });
  });

  describe('ubicacion', () => {
    it('construye una ubicación válida', () => {
      const ub = ubicacion('AR', 'Buenos Aires');

      expect(ub.pais).toBe('AR');
      expect(ub.provincia).toBe('Buenos Aires');
      expect(ub.fuente).toBe('BASE_LOCAL');
    });

    it('permite provincia null', () => {
      const ub = ubicacion('AR', null);

      expect(ub.pais).toBe('AR');
      expect(ub.provincia).toBeNull();
      expect(ub.fuente).toBe('BASE_LOCAL');
    });
  });

  describe('UbicacionPorIpMock', () => {
    let adaptador: ReturnType<typeof crearUbicacionPorIpMock>;

    beforeEach(() => {
      adaptador = crearUbicacionPorIpMock();
    });

    it('resuelve una IPv4 conocida de la tabla de demostración', async () => {
      const resultado = await adaptador.resolver('192.0.2.50');

      expect(resultado).not.toBeNull();
      if (resultado) {
        expect(resultado.pais).toBe('AR');
        expect(resultado.fuente).toBe('BASE_LOCAL');
      }
    });

    it('devuelve null para una IPv4 desconocida', async () => {
      const resultado = await adaptador.resolver('172.16.0.1');

      expect(resultado).toBeNull();
    });

    it('devuelve null para rangos reservados', async () => {
      const resultado = await adaptador.resolver('10.0.0.1');

      expect(resultado).toBeNull();
    });

    it('resuelve una IPv6 conocida', async () => {
      const resultado = await adaptador.resolver('2001:db8::1');

      expect(resultado).not.toBeNull();
      if (resultado) {
        expect(resultado.pais).toBe('AR');
      }
    });

    it('registra consultas', async () => {
      expect(adaptador.cantidadDeConsultas).toBe(0);

      await adaptador.resolver('192.0.2.50');
      expect(adaptador.cantidadDeConsultas).toBe(1);

      await adaptador.resolver('200.45.12.50');
      expect(adaptador.cantidadDeConsultas).toBe(2);
    });

    it('permite reiniciar el contador de consultas', async () => {
      await adaptador.resolver('192.0.2.50');
      expect(adaptador.cantidadDeConsultas).toBe(1);

      adaptador.reiniciar();

      expect(adaptador.cantidadDeConsultas).toBe(0);
    });

    it('expone la versión de la base', () => {
      expect(adaptador.versionDeLaBase).toBeTruthy();
      expect(adaptador.versionDeLaBase).toContain('mock');
    });
  });
});
