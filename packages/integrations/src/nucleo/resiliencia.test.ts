import { describe, it, expect, beforeEach } from 'vitest';
import {
  esperaDelIntento,
  Cortacircuitos,
  POLITICA_POR_DEFECTO,
  CORTACIRCUITOS_POR_DEFECTO,
  ejecutarConResiliencia,
  conTiempoLimite,
  claseSegunCodigoHttp,
  type ResultadoDeIntento,
  type OpcionesDeEjecucion,
} from './resiliencia';
import { crearErrorIntegracion } from './errores';

describe('Resiliencia', () => {
  describe('esperaDelIntento', () => {
    it('devuelve 0 para el primer intento sin azar', () => {
      const espera = esperaDelIntento(1, POLITICA_POR_DEFECTO, 0);
      expect(espera).toBe(0);
    });

    it('crece exponencialmente con el número de intento', () => {
      const politica = POLITICA_POR_DEFECTO;
      const azar = 0.5;

      const intento1 = esperaDelIntento(1, politica, azar);
      const intento2 = esperaDelIntento(2, politica, azar);
      const intento3 = esperaDelIntento(3, politica, azar);

      // Intento 1: 250 * 2^(1-1) = 250 * 2^0 = 250, con azar 0.5
      expect(intento1).toBe(Math.floor(250 * azar));
      // Intento 2: 250 * 2^(2-1) = 500, con azar 0.5
      expect(intento2).toBe(Math.floor(500 * azar));
      // Intento 3: 250 * 2^(3-1) = 1000, con azar 0.5
      expect(intento3).toBe(Math.floor(1000 * azar));

      // Verificar que crece
      expect(intento3).toBeGreaterThan(intento2);
      expect(intento2).toBeGreaterThan(intento1);
    });

    it('respeta el tope máximo de espera', () => {
      const politica = {
        intentos: 10,
        esperaBaseEnMs: 250,
        esperaMaximaEnMs: 1000,
        tiempoLimiteEnMs: 5000,
      };

      const intento10 = esperaDelIntento(10, politica, 1);
      expect(intento10).toBeLessThanOrEqual(politica.esperaMaximaEnMs);
    });

    it('aplica azar uniforme entre 0 y el tope', () => {
      const politica = POLITICA_POR_DEFECTO;
      const tope = politica.esperaBaseEnMs;

      for (const azar of [0, 0.25, 0.5, 0.75, 0.99]) {
        const espera = esperaDelIntento(1, politica, azar);
        expect(espera).toBe(Math.floor(tope * azar));
      }
    });
  });

  describe('Cortacircuitos', () => {
    let cortacircuitos: Cortacircuitos;

    beforeEach(() => {
      cortacircuitos = new Cortacircuitos(CORTACIRCUITOS_POR_DEFECTO, () => 0);
    });

    it('empieza cerrado', () => {
      expect(cortacircuitos.estado()).toBe('CERRADO');
      expect(cortacircuitos.permitePasar()).toBe(true);
    });

    it('abre después de N fallos consecutivos', () => {
      for (let i = 0; i < 5; i += 1) {
        cortacircuitos.registrarFallo();
      }

      expect(cortacircuitos.estado()).toBe('ABIERTO');
      expect(cortacircuitos.permitePasar()).toBe(false);
    });

    it('cierra después de un éxito', () => {
      cortacircuitos.registrarFallo();
      cortacircuitos.registrarFallo();
      cortacircuitos.registrarExito();

      expect(cortacircuitos.fallosConsecutivos ?? 0).not.toBeGreaterThan(CORTACIRCUITOS_POR_DEFECTO.fallosParaAbrir);
      expect(cortacircuitos.permitePasar()).toBe(true);
    });

    it('transita a MEDIO_ABIERTO después del período de reposo', () => {
      let ahora = 1000;
      const getAhora = () => ahora;
      const cortacircuitos2 = new Cortacircuitos(CORTACIRCUITOS_POR_DEFECTO, getAhora);

      for (let i = 0; i < 5; i += 1) {
        cortacircuitos2.registrarFallo();
      }

      expect(cortacircuitos2.estado()).toBe('ABIERTO');
      expect(cortacircuitos2.permitePasar()).toBe(false);

      // Avanzar el reloj más allá del período de reposo
      ahora += CORTACIRCUITOS_POR_DEFECTO.reposoEnMs + 1;

      // Ahora debería estar en MEDIO_ABIERTO y permitir pasar
      expect(cortacircuitos2.estado()).toBe('MEDIO_ABIERTO');
      expect(cortacircuitos2.permitePasar()).toBe(true);
    });
  });

  describe('ejecutarConResiliencia', () => {
    it('devuelve éxito en el primer intento si la operación tiene éxito', async () => {
      const opciones: OpcionesDeEjecucion<string> = {
        proveedor: 'SENDGRID',
        operacion: 'envio',
        intentar: async () => ({
          ok: true,
          valor: 'id-123',
        }),
      };

      const resultado = await ejecutarConResiliencia(opciones);

      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.valor).toBe('id-123');
      }
    });

    it('reintenta un error reintentable', async () => {
      let intentos = 0;
      const opciones: OpcionesDeEjecucion<string> = {
        proveedor: 'SENDGRID',
        operacion: 'test',
        dependencias: {
          dormir: async () => {
            /* no espera en tests */
          },
        },
        intentar: async () => {
          intentos += 1;
          if (intentos < 3) {
            return {
              ok: false,
              error: crearErrorIntegracion({
                proveedor: 'SENDGRID',
                clase: 'TIEMPO_AGOTADO',
              }),
            };
          }
          return { ok: true, valor: 'éxito-en-3' };
        },
      };

      const resultado = await ejecutarConResiliencia(opciones);

      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.valor).toBe('éxito-en-3');
      }
      expect(intentos).toBe(3);
    });

    it('no reintenta un error no reintentable', async () => {
      let intentos = 0;
      const opciones: OpcionesDeEjecucion<string> = {
        proveedor: 'SENDGRID',
        operacion: 'test',
        intentar: async () => {
          intentos += 1;
          return {
            ok: false,
            error: crearErrorIntegracion({
              proveedor: 'SENDGRID',
              clase: 'PETICION_INVALIDA',
            }),
          };
        },
      };

      const resultado = await ejecutarConResiliencia(opciones);

      expect(resultado.ok).toBe(false);
      expect(intentos).toBe(1);
    });

    it('respeta el cortacircuitos abierto', async () => {
      const cortacircuitos = new Cortacircuitos(CORTACIRCUITOS_POR_DEFECTO);
      for (let i = 0; i < 5; i += 1) {
        cortacircuitos.registrarFallo();
      }

      const opciones: OpcionesDeEjecucion<string> = {
        proveedor: 'SENDGRID',
        operacion: 'test',
        cortacircuitos,
        intentar: async () => ({
          ok: true,
          valor: 'no debería llegar',
        }),
      };

      const resultado = await ejecutarConResiliencia(opciones);

      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.error.clase).toBe('CIRCUITO_ABIERTO');
      }
    });
  });

  describe('conTiempoLimite', () => {
    it('devuelve el valor si la promesa se resuelve antes del límite', async () => {
      const promesa = Promise.resolve('éxito');
      const resultado = await conTiempoLimite(promesa, 1000, 'SENDGRID', 'test');

      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.valor).toBe('éxito');
      }
    });

    it('devuelve error de vencimiento si la promesa tarda más', async () => {
      const promesa = new Promise<string>((resolver) => {
        setTimeout(() => resolver('tarde'), 2000);
      });
      const resultado = await conTiempoLimite(promesa, 100, 'SENDGRID', 'test');

      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.error.clase).toBe('TIEMPO_AGOTADO');
      }
    });
  });

  describe('claseSegunCodigoHttp', () => {
    it('clasifica 401/403 como credencial rechazada', () => {
      expect(claseSegunCodigoHttp(401)).toBe('CREDENCIAL_RECHAZADA');
      expect(claseSegunCodigoHttp(403)).toBe('CREDENCIAL_RECHAZADA');
    });

    it('clasifica 408/504 como tiempo agotado', () => {
      expect(claseSegunCodigoHttp(408)).toBe('TIEMPO_AGOTADO');
      expect(claseSegunCodigoHttp(504)).toBe('TIEMPO_AGOTADO');
    });

    it('clasifica 429 como límite de uso', () => {
      expect(claseSegunCodigoHttp(429)).toBe('LIMITE_DE_USO');
    });

    it('clasifica 5xx como fallo del proveedor', () => {
      expect(claseSegunCodigoHttp(500)).toBe('FALLO_DEL_PROVEEDOR');
      expect(claseSegunCodigoHttp(502)).toBe('FALLO_DEL_PROVEEDOR');
      expect(claseSegunCodigoHttp(503)).toBe('FALLO_DEL_PROVEEDOR');
    });

    it('clasifica 4xx como petición inválida', () => {
      expect(claseSegunCodigoHttp(400)).toBe('PETICION_INVALIDA');
      expect(claseSegunCodigoHttp(404)).toBe('PETICION_INVALIDA');
      expect(claseSegunCodigoHttp(409)).toBe('PETICION_INVALIDA');
    });

    it('clasifica 2xx/3xx como respuesta inesperada', () => {
      expect(claseSegunCodigoHttp(200)).toBe('RESPUESTA_INESPERADA');
      expect(claseSegunCodigoHttp(302)).toBe('RESPUESTA_INESPERADA');
    });
  });
});
