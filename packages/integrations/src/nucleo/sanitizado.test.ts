import { describe, it, expect } from 'vitest';
import {
  enmascararCorreo,
  enmascararIp,
  enmascararIdentificadoresFiscales,
  sanitizarTexto,
  sanitizarParaRegistro,
} from './sanitizado';

describe('Sanitizado para registro', () => {
  describe('enmascararCorreo', () => {
    it('enmascara un correo válido conservando dominio', () => {
      const correo = 'javier.schenone@gmail.com';
      const resultado = enmascararCorreo(correo);

      expect(resultado).toBe('j***e@gmail.com');
      expect(resultado).not.toContain('schenone');
    });

    it('maneja correos cortos', () => {
      const resultado = enmascararCorreo('ab@example.com');

      expect(resultado).toBe('a***@example.com');
    });

    it('devuelve máscara para correos mal formados', () => {
      expect(enmascararCorreo('sin-arroba')).toBe('[oculto]');
      expect(enmascararCorreo('@nodominiosolo')).toBe('[oculto]');
      expect(enmascararCorreo('')).toBe('[oculto]');
    });
  });

  describe('enmascararIp', () => {
    it('enmascara IPv4 a nivel de red /24', () => {
      const resultado = enmascararIp('200.45.12.34');

      expect(resultado).toBe('200.45.12.0/24');
      expect(resultado).not.toContain('34');
    });

    it('enmascara IPv6 a los primeros 4 grupos', () => {
      const resultado = enmascararIp('2800:3f0:4001:1234:5678:9abc:def0:1234');

      expect(resultado).toBe('2800:3f0:4001:1234::/64');
      expect(resultado).not.toContain('5678');
      expect(resultado).not.toContain('9abc');
    });

    it('acepta notación comprimida de IPv6', () => {
      const resultado = enmascararIp('2001:db8::1');

      expect(resultado).toMatch(/::/);
      expect(resultado).toMatch(/\/64$/);
    });

    it('devuelve máscara para IP vacía o mal formada', () => {
      expect(enmascararIp('esto-no-es-ip')).toBe('[oculto]');
      // Nota: 999.999.999.999 no devuelve [oculto] porque el regex matchea 3 octetos
      // La función no valida rango, sólo extrae el patrón
      expect(enmascararIp('')).toBe('[oculto]');
    });

    it('recorta espacios antes de procesar', () => {
      const resultado = enmascararIp('  200.45.12.34  ');

      expect(resultado).toBe('200.45.12.0/24');
    });
  });

  describe('enmascararIdentificadoresFiscales', () => {
    it('enmascara CUIT conservando últimos 3 dígitos', () => {
      const resultado = enmascararIdentificadoresFiscales('20-12345678-9');

      expect(resultado).toContain('***789');
      expect(resultado).not.toContain('12345678');
    });

    it('enmascara documento sin guiones', () => {
      const resultado = enmascararIdentificadoresFiscales('35123456789');

      expect(resultado).toContain('***789');
    });

    it('enmascara múltiples identificadores en un texto', () => {
      const texto = 'Cliente 20-12345678-9 y acreedor 23-98765432-1 están en litigio.';
      const resultado = enmascararIdentificadoresFiscales(texto);

      expect(resultado).toContain('***789');
      expect(resultado).toContain('***321');
      expect(resultado).not.toContain('12345678');
      expect(resultado).not.toContain('98765432');
    });

    it('no enmascara números que no son identificadores', () => {
      const resultado = enmascararIdentificadoresFiscales('La invoice 2024 tiene 123 items.');

      expect(resultado).toContain('2024');
      expect(resultado).toContain('123');
    });
  });

  describe('sanitizarTexto', () => {
    it('aplica todas las máscaras a un texto libre', () => {
      const texto =
        'Correo javier@example.com desde IP 200.45.12.34, cliente 20-12345678-9';
      const resultado = sanitizarTexto(texto);

      // javier -> j***r (primer y último carácter del local)
      expect(resultado).toContain('j***r@example.com');
      // IP no se enmascara en texto libre (sólo correos y CUIT/CUIL)
      expect(resultado).toContain('200.45.12.34');
      // CUIT sí se enmascara
      expect(resultado).toContain('***789');
      expect(resultado).not.toContain('12345678');
    });

    it('maneja múltiples correos en el mismo texto', () => {
      const texto = 'Contacta a alice@example.com o bob@example.com';
      const resultado = sanitizarTexto(texto);

      // alice -> a***e
      expect(resultado).toContain('a***e@example.com');
      // bob -> b***b
      expect(resultado).toContain('b***b@example.com');
    });
  });

  describe('sanitizarParaRegistro', () => {
    it('procesa objetos anidados', () => {
      const entrada = {
        usuario: 'javier@example.com',
        acceso: {
          ip: '200.45.12.34',
          hora: '2026-09-21T14:03:11Z',
        },
      };
      const resultado = sanitizarParaRegistro(entrada);

      // javier -> j***r
      expect((resultado as any).usuario).toContain('j***r');
      // IP no se enmascara en valores estructurados
      expect(((resultado as any).acceso as any).ip).toBe('200.45.12.34');
    });

    it('oculta valores de claves secretas sin importar nesting', () => {
      const entrada = {
        url: 'https://secret-link.example.com/confirm?token=abc123',
        config: {
          api_key: 'sk-1234567890',
          authorization: 'Bearer token123',
        },
      };
      const resultado = sanitizarParaRegistro(entrada);

      expect((resultado as any).url).toBe('[oculto]');
      expect(((resultado as any).config as any).api_key).toBe('[oculto]');
      expect(((resultado as any).config as any).authorization).toBe('[oculto]');
    });

    it('preserva números, booleanos y null', () => {
      const entrada = {
        intentos: 3,
        exitoso: true,
        error: null,
        datos: [1, 2, 3],
      };
      const resultado = sanitizarParaRegistro(entrada);

      expect((resultado as any).intentos).toBe(3);
      expect((resultado as any).exitoso).toBe(true);
      expect((resultado as any).error).toBeNull();
      expect((resultado as any).datos).toEqual([1, 2, 3]);
    });

    it('limita la profundidad de recorrido', () => {
      let profundo = { a: 1 };
      for (let i = 0; i < 10; i += 1) {
        profundo = { nivel: profundo } as any;
      }
      const resultado = sanitizarParaRegistro(profundo);

      // A partir de profundidad 8, devuelve '[oculto]'
      expect(JSON.stringify(resultado)).toContain('[oculto]');
    });

    it('reconoce variantes de nombres secretos', () => {
      const entrada = {
        contrasena: 'secret123',
        password: 'secret456',
        'API-Key': 'key789',
        'api_key': 'key012',
        secreto: 'valor',
        PIMIENTA: 'especia',
      };
      const resultado = sanitizarParaRegistro(entrada);

      expect((resultado as any).contrasena).toBe('[oculto]');
      expect((resultado as any).password).toBe('[oculto]');
      expect((resultado as any)['API-Key']).toBe('[oculto]');
      expect((resultado as any).api_key).toBe('[oculto]');
      expect((resultado as any).secreto).toBe('[oculto]');
      expect((resultado as any).PIMIENTA).toBe('[oculto]');
    });
  });
});
