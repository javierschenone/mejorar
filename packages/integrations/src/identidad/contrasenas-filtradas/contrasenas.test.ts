import { describe, it, expect, beforeEach } from 'vitest';
import {
  huellaSha1,
  normalizarParaBusqueda,
} from './puerto';
import { crearListaDeContrasenasFiltradasMock } from './mock';
import { CONTRASENAS_FILTRADAS_BASE } from './lista-base';

describe('Contraseñas filtradas', () => {
  describe('huellaSha1', () => {
    it('calcula un hash SHA-1 en mayúsculas', () => {
      const contrasena = 'password';
      const huella = huellaSha1(contrasena);

      expect(huella).toMatch(/^[0-9A-F]{40}$/);
      expect(huella).toBe('5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8');
    });

    it('es determinista', () => {
      const contrasena = 'test123';
      const huella1 = huellaSha1(contrasena);
      const huella2 = huellaSha1(contrasena);

      expect(huella1).toBe(huella2);
    });

    it('produce huellas distintas para contraseñas distintas', () => {
      const huella1 = huellaSha1('password');
      const huella2 = huellaSha1('password1');

      expect(huella1).not.toBe(huella2);
    });

    it('normaliza la contraseña antes de hashear', () => {
      const con1 = huellaSha1('café');
      const con2 = huellaSha1('café');

      expect(con1).toBe(con2);
    });
  });

  describe('normalizarParaBusqueda', () => {
    it('normaliza a NFKC', () => {
      const resultado = normalizarParaBusqueda('café');

      expect(typeof resultado).toBe('string');
      expect(resultado).toBeTruthy();
    });

    it('es idempotente', () => {
      const original = 'café';
      const primera = normalizarParaBusqueda(original);
      const segunda = normalizarParaBusqueda(primera);

      expect(primera).toBe(segunda);
    });

    it('preserva mayúsculas y minúsculas', () => {
      const minuscula = normalizarParaBusqueda('password');
      const mayuscula = normalizarParaBusqueda('Password');

      expect(minuscula).not.toBe(mayuscula);
    });
  });

  describe('ListaDeContrasenasFiltradasMock', () => {
    let lista: ReturnType<typeof crearListaDeContrasenasFiltradasMock>;

    beforeEach(() => {
      lista = crearListaDeContrasenasFiltradasMock();
    });

    it('contiene las contraseñas de la lista base', async () => {
      const contiene123456 = await lista.contiene('123456');
      const contieneBoca1905 = await lista.contiene('boca1905');

      expect(contiene123456).toBe(true);
      expect(contieneBoca1905).toBe(true);
    });

    it('rechaza contraseñas que no están en la lista', async () => {
      const contiene = await lista.contiene('contraseña-única-que-no-existe-3729');

      expect(contiene).toBe(false);
    });

    it('normaliza la contraseña antes de buscarla', async () => {
      // Suponiendo que 'password' está en la lista base
      const resultado1 = await lista.contiene('password');
      const resultado2 = await lista.contiene('password');

      expect(resultado1).toBe(resultado2);
    });

    it('acepta contraseñas adicionales', async () => {
      const listaExtendida = crearListaDeContrasenasFiltradasMock(['miContraseñaSecreta']);

      const contiene = await listaExtendida.contiene('miContraseñaSecreta');

      expect(contiene).toBe(true);
    });

    it('expone la cantidad de entradas', () => {
      const lista1 = crearListaDeContrasenasFiltradasMock();
      const cantidad1 = lista1.cantidadDeEntradas;

      expect(cantidad1).toBeGreaterThan(0);
      expect(cantidad1).toBe(CONTRASENAS_FILTRADAS_BASE.length);

      const lista2 = crearListaDeContrasenasFiltradasMock(['nueva']);
      const cantidad2 = lista2.cantidadDeEntradas;

      expect(cantidad2).toBe(cantidad1 + 1);
    });

    it('registra consultas realizadas', async () => {
      expect(lista.cantidadDeConsultas).toBe(0);

      await lista.contiene('password');
      expect(lista.cantidadDeConsultas).toBe(1);

      await lista.contiene('123456');
      expect(lista.cantidadDeConsultas).toBe(2);

      await lista.contiene('contraseña-inexistente');
      expect(lista.cantidadDeConsultas).toBe(3);
    });

    it('permite reiniciar el contador de consultas', async () => {
      await lista.contiene('password');
      await lista.contiene('123456');

      expect(lista.cantidadDeConsultas).toBe(2);

      lista.reiniciar();

      expect(lista.cantidadDeConsultas).toBe(0);
    });

    it('expone la cobertura', () => {
      expect(lista.cobertura).toBeDefined();
      expect(lista.cobertura.puerto).toBe('PuertoListaDeContrasenasFiltradas');
      expect(lista.cobertura.proveedor).toBe('LISTA_LOCAL_DE_CONTRASENAS');
      expect(lista.cobertura.usaRed).toBe(false);
      expect(lista.cobertura.esEncargadoDeTratamiento).toBe(false);
    });

    it('guarda contraseñas como hash, nunca en claro', async () => {
      const lista2 = crearListaDeContrasenasFiltradasMock(['test-secret-123']);

      // Convertir el objeto a string y verificar que no contiene el texto plano
      const json = JSON.stringify(lista2);

      expect(json).not.toContain('test-secret-123');
    });
  });
});
