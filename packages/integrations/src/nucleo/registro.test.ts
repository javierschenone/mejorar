import { describe, it, expect } from 'vitest';
import { RegistroDeLlamadasEnMemoria } from './registro';

describe('Registro de llamadas en memoria', () => {
  it('almacena entradas de registro sin límite de tamaño en tests', () => {
    const registro = new RegistroDeLlamadasEnMemoria();

    for (let i = 0; i < 100; i += 1) {
      registro.registrar({
        proveedor: 'SENDGRID',
        operacion: `envio-${i}`,
        momento: new Date().toISOString(),
        duracionEnMs: 100,
        resultado: 'EXITO',
        intento: 1,
        peticionSanitizada: { id: i },
        respuestaSanitizada: { status: 'ok' },
        codigoDeError: null,
        referencia: `ref-${i}`,
      });
    }

    expect(registro.listar()).toHaveLength(100);
  });

  it('sanitiza datos sensibles al registrar', () => {
    const registro = new RegistroDeLlamadasEnMemoria();

    registro.registrar({
      proveedor: 'SENDGRID',
      operacion: 'envio',
      momento: '2026-09-21T14:00:00.000Z',
      duracionEnMs: 200,
      resultado: 'EXITO',
      intento: 1,
      peticionSanitizada: {
        destinatario: 'javier.schenone@gmail.com',
        cliente: '20-12345678-9',
      },
      respuestaSanitizada: { id: 'msg-abc123' },
      codigoDeError: null,
      referencia: 'ref-001',
    });

    const entradas = registro.listar();
    expect(entradas).toHaveLength(1);
    const entrada = entradas[0]!;

    // Verifica que los campos sensibles fueron enmascarados
    expect(JSON.stringify(entrada.peticionSanitizada)).not.toContain('schenone');
    expect(JSON.stringify(entrada.peticionSanitizada)).toContain('j***e');
    // El CUIT se enmascara
    expect(JSON.stringify(entrada.peticionSanitizada)).toContain('***789');
    expect(JSON.stringify(entrada.peticionSanitizada)).not.toContain('12345678');
  });

  it('permite limpiar el historial', () => {
    const registro = new RegistroDeLlamadasEnMemoria();

    registro.registrar({
      proveedor: 'SENDGRID',
      operacion: 'test',
      momento: '2026-09-21T14:00:00.000Z',
      duracionEnMs: 50,
      resultado: 'EXITO',
      intento: 1,
      peticionSanitizada: {},
      respuestaSanitizada: {},
      codigoDeError: null,
      referencia: 'ref-1',
    });

    expect(registro.listar()).toHaveLength(1);

    registro.limpiar();

    expect(registro.listar()).toHaveLength(0);
  });

  it('conserva todos los campos de la entrada', () => {
    const registro = new RegistroDeLlamadasEnMemoria();

    const entrada = {
      proveedor: 'BASE_LOCAL_DE_UBICACION' as const,
      operacion: 'resolver-ip',
      momento: '2026-09-21T14:00:00.000Z',
      duracionEnMs: 1,
      resultado: 'EXITO' as const,
      intento: 2,
      peticionSanitizada: { ip: '203.0.113.10' },
      respuestaSanitizada: { pais: 'UY' },
      codigoDeError: null,
      referencia: 'ref-ip-001',
    };

    registro.registrar(entrada);

    const recuperada = registro.listar()[0]!;
    expect(recuperada.proveedor).toBe('BASE_LOCAL_DE_UBICACION');
    expect(recuperada.operacion).toBe('resolver-ip');
    expect(recuperada.intento).toBe(2);
    expect(recuperada.resultado).toBe('EXITO');
    expect(recuperada.duracionEnMs).toBe(1);
  });
});
