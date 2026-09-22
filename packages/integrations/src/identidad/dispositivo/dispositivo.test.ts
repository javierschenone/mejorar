import { describe, it, expect, beforeEach } from 'vitest';
import {
  crearAnalizadorDeDispositivoMock,
  AGENTES_DE_EJEMPLO,
} from './mock';
import { crearAnalizadorLocalDeDispositivo, DESCONOCIDO } from './local';

describe('Descripción de dispositivo', () => {
  describe('AnalizadorLocalDeAgenteDeUsuario', () => {
    let analizador = crearAnalizadorLocalDeDispositivo();

    beforeEach(() => {
      analizador = crearAnalizadorLocalDeDispositivo();
    });

    it('detecta un navegador de escritorio Chrome en Windows', () => {
      const ua = AGENTES_DE_EJEMPLO.WINDOWS_CHROME;
      const resultado = analizador.describir(ua);

      expect(resultado.clase).toBe('ESCRITORIO');
      expect(resultado.sistema).toBe('Windows');
      expect(resultado.navegador).toBe('Chrome');
    });

    it('detecta un iPhone con Safari', () => {
      const ua = AGENTES_DE_EJEMPLO.IPHONE_SAFARI;
      const resultado = analizador.describir(ua);

      expect(resultado.clase).toBe('TELEFONO');
      expect(resultado.sistema).toBe('iOS');
      expect(resultado.navegador).toBe('Safari');
    });

    it('detecta un Android con Chrome', () => {
      const ua = AGENTES_DE_EJEMPLO.ANDROID_CHROME;
      const resultado = analizador.describir(ua);

      expect(resultado.clase).toBe('TELEFONO');
      expect(resultado.sistema).toBe('Android');
      expect(resultado.navegador).toBe('Chrome');
    });

    it('detecta una tableta iPad', () => {
      const ua = AGENTES_DE_EJEMPLO.IPAD_SAFARI;
      const resultado = analizador.describir(ua);

      expect(resultado.clase).toBe('TABLETA');
      expect(resultado.sistema).toBe('iPadOS');
      expect(resultado.navegador).toBe('Safari');
    });

    it('detecta una aplicación móvil nativa iOS', () => {
      const ua = AGENTES_DE_EJEMPLO.APLICACION_PROPIA_IOS;
      const resultado = analizador.describir(ua);

      expect(resultado.clase).toBe('APLICACION_MOVIL');
      expect(resultado.sistema).toBe('iOS');
      expect(resultado.navegador).toBeNull();
    });

    it('detecta una aplicación móvil nativa Android', () => {
      const ua = AGENTES_DE_EJEMPLO.APLICACION_PROPIA_ANDROID;
      const resultado = analizador.describir(ua);

      expect(resultado.clase).toBe('APLICACION_MOVIL');
      expect(resultado.sistema).toBe('Android');
      expect(resultado.navegador).toBeNull();
    });

    it('detecta Firefox en Linux', () => {
      const ua = AGENTES_DE_EJEMPLO.LINUX_FIREFOX;
      const resultado = analizador.describir(ua);

      expect(resultado.clase).toBe('ESCRITORIO');
      expect(resultado.sistema).toBe('Linux');
      expect(resultado.navegador).toBe('Firefox');
    });

    it('detecta Safari en macOS', () => {
      const ua = AGENTES_DE_EJEMPLO.MAC_SAFARI;
      const resultado = analizador.describir(ua);

      expect(resultado.clase).toBe('ESCRITORIO');
      expect(resultado.sistema).toBe('macOS');
      expect(resultado.navegador).toBe('Safari');
    });

    it('detecta Edge en Windows', () => {
      const ua = AGENTES_DE_EJEMPLO.WINDOWS_EDGE;
      const resultado = analizador.describir(ua);

      expect(resultado.clase).toBe('ESCRITORIO');
      expect(resultado.navegador).toBe('Edge');
    });

    it('detecta Samsung Internet en Android', () => {
      const ua = AGENTES_DE_EJEMPLO.ANDROID_SAMSUNG;
      const resultado = analizador.describir(ua);

      expect(resultado.navegador).toBe('Samsung Internet');
    });

    it('detecta una tableta Android', () => {
      const ua = AGENTES_DE_EJEMPLO.ANDROID_TABLETA;
      const resultado = analizador.describir(ua);

      expect(resultado.clase).toBe('TABLETA');
      expect(resultado.sistema).toBe('Android');
    });

    it('devuelve DESCONOCIDO para un agente de usuario vacío', () => {
      const resultado = analizador.describir('');

      expect(resultado.clase).toBe('DESCONOCIDO');
      expect(resultado.sistema).toBeNull();
      expect(resultado.navegador).toBeNull();
    });

    it('devuelve DESCONOCIDO para un agente de usuario inválido', () => {
      const resultado = analizador.describir('esto-no-es-un-agente-de-usuario');

      expect(resultado.clase).toBe('DESCONOCIDO');
      expect(resultado.sistema).toBeNull();
      expect(resultado.navegador).toBeNull();
    });

    it('maneja agentes de usuario muy largos sin procesar más allá del límite', () => {
      const uaMuyLargo = 'a'.repeat(1000);
      const resultado = analizador.describir(uaMuyLargo);

      // No debería fallar, simplemente devuelve DESCONOCIDO
      expect(resultado.clase).toBe('DESCONOCIDO');
      expect(resultado.sistema).toBeNull();
      expect(resultado.navegador).toBeNull();
    });

    it('no incluye números de versión en el resultado', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.127 Safari/537.36';
      const resultado = analizador.describir(ua);

      // No debe contener "126" ni "537"
      expect(resultado.sistema).not.toContain('10.0');
      expect(resultado.navegador).not.toContain('126');
    });

    it('no devuelve la cadena de agente de usuario en ningún campo', () => {
      const ua = AGENTES_DE_EJEMPLO.WINDOWS_CHROME;
      const resultado = analizador.describir(ua);

      const json = JSON.stringify(resultado);
      expect(json).not.toContain(ua);
      expect(json).not.toContain('Mozilla');
      expect(json).not.toContain('AppleWebKit');
    });
  });

  describe('AnalizadorDeDispositivoMock', () => {
    let mock = crearAnalizadorDeDispositivoMock();

    beforeEach(() => {
      mock = crearAnalizadorDeDispositivoMock();
    });

    it('delega en el analizador real y devuelve el mismo resultado', () => {
      const real = crearAnalizadorLocalDeDispositivo();
      const ua = AGENTES_DE_EJEMPLO.WINDOWS_CHROME;

      const resultadoReal = real.describir(ua);
      const resultadoMock = mock.describir(ua);

      expect(resultadoMock).toEqual(resultadoReal);
    });

    it('registra la cantidad de invocaciones', () => {
      expect(mock.cantidadDeInvocaciones).toBe(0);

      mock.describir(AGENTES_DE_EJEMPLO.IPHONE_SAFARI);
      expect(mock.cantidadDeInvocaciones).toBe(1);

      mock.describir(AGENTES_DE_EJEMPLO.WINDOWS_CHROME);
      expect(mock.cantidadDeInvocaciones).toBe(2);
    });

    it('permite reiniciar el contador de invocaciones', () => {
      mock.describir(AGENTES_DE_EJEMPLO.IPHONE_SAFARI);
      mock.describir(AGENTES_DE_EJEMPLO.ANDROID_CHROME);

      expect(mock.cantidadDeInvocaciones).toBe(2);

      mock.reiniciar();

      expect(mock.cantidadDeInvocaciones).toBe(0);
    });

    it('expone la batería de agentes de ejemplo', () => {
      expect(AGENTES_DE_EJEMPLO.WINDOWS_CHROME).toBeTruthy();
      expect(AGENTES_DE_EJEMPLO.IPHONE_SAFARI).toBeTruthy();
      expect(AGENTES_DE_EJEMPLO.ANDROID_CHROME).toBeTruthy();
      expect(AGENTES_DE_EJEMPLO.MAC_SAFARI).toBeTruthy();
      expect(AGENTES_DE_EJEMPLO.LINUX_FIREFOX).toBeTruthy();
    });

    it('tiene cobertura declarada', () => {
      expect(mock.cobertura).toBeDefined();
      expect(mock.cobertura.puerto).toBe('PuertoDescripcionDeDispositivo');
      expect(mock.cobertura.proveedor).toBe('ANALIZADOR_LOCAL_DE_DISPOSITIVO');
      expect(mock.cobertura.usaRed).toBe(false);
    });
  });
});
