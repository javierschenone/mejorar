/**
 * Sanitizado para el registro de llamadas — regla 7 del mandato.
 *
 * "Un CUIL completo no va a un log." Tampoco una dirección de correo entera,
 * ni una IP entera, ni una clave de API, ni un enlace de un solo uso: el
 * enlace de recuperación que aparece en un log **es** la credencial.
 *
 * Todo lo de acá es puro y determinista: mismo texto, misma máscara. No se usa
 * para decidir nada, sólo para poder mirar un registro sin exponer a nadie.
 */

/** Claves cuyo valor nunca se registra, se llamen como se llamen adentro. */
const CLAVES_SECRETAS = [
  'authorization',
  'apikey',
  'api_key',
  'clavedeapi',
  'token',
  'contrasena',
  'password',
  'secret',
  'secreto',
  'pimienta',
  'cookie',
  'setcookie',
  'url',
  'enlace',
];

const MASCARA = '[oculto]';

function esClaveSecreta(clave: string): boolean {
  const normalizada = clave.toLowerCase().replace(/[-_\s]/g, '');
  return CLAVES_SECRETAS.some((secreta) => normalizada.includes(secreta.replace(/_/g, '')));
}

/**
 * `javier.schenone@gmail.com` → `j***e@gmail.com`. Queda suficiente para
 * reconocer de qué cuenta se habla al depurar y no alcanza para identificar a
 * nadie que no lo supiera de antes.
 */
export function enmascararCorreo(correo: string): string {
  const arroba = correo.lastIndexOf('@');
  if (arroba <= 0) return MASCARA;
  const local = correo.slice(0, arroba);
  const dominio = correo.slice(arroba + 1);
  if (local.length <= 2) return `${local.slice(0, 1)}***@${dominio}`;
  return `${local.slice(0, 1)}***${local.slice(-1)}@${dominio}`;
}

/**
 * IPv4: se conserva la red y se borra el último octeto (`200.45.12.0/24`).
 * IPv6: se conservan los primeros cuatro grupos (`2800:3f0:4001::/64`).
 * Alcanza para mirar un patrón de abuso y no para seguir a una persona.
 */
export function enmascararIp(ip: string): string {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(ip.trim());
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  if (ip.includes(':')) {
    const grupos = ip.trim().toLowerCase().split(':').filter(Boolean).slice(0, 4);
    if (grupos.length === 0) return MASCARA;
    return `${grupos.join(':')}::/64`;
  }
  return MASCARA;
}

/** Cualquier corrida de 8 a 11 dígitos se trata como documento o CUIT/CUIL. */
export function enmascararIdentificadoresFiscales(texto: string): string {
  return texto.replace(/\b(\d{2}-?)?\d{7,8}(-?\d)?\b/g, (coincidencia) => {
    const soloDigitos = coincidencia.replace(/\D/g, '');
    if (soloDigitos.length < 7 || soloDigitos.length > 11) return coincidencia;
    return `***${soloDigitos.slice(-3)}`;
  });
}

/** Aplica todas las máscaras de texto libre, en orden. */
export function sanitizarTexto(texto: string): string {
  const sinCorreos = texto.replace(/[^\s<>()"']+@[^\s<>()"']+\.[A-Za-z]{2,}/g, (correo) =>
    enmascararCorreo(correo),
  );
  return enmascararIdentificadoresFiscales(sinCorreos);
}

export type ValorRegistrable =
  | string
  | number
  | boolean
  | null
  | readonly ValorRegistrable[]
  | { readonly [clave: string]: ValorRegistrable };

/**
 * Sanitiza una estructura completa antes de registrarla. Recorre claves y
 * valores: las claves secretas se reemplazan enteras, el resto pasa por las
 * máscaras de texto.
 */
export function sanitizarParaRegistro(valor: ValorRegistrable, profundidad = 0): ValorRegistrable {
  if (profundidad > 8) return MASCARA;
  if (valor === null || typeof valor === 'number' || typeof valor === 'boolean') return valor;
  if (typeof valor === 'string') return sanitizarTexto(valor);
  if (Array.isArray(valor)) {
    return valor.map((elemento) => sanitizarParaRegistro(elemento, profundidad + 1));
  }
  const entrada = valor as { readonly [clave: string]: ValorRegistrable };
  const salida: { [clave: string]: ValorRegistrable } = {};
  for (const clave of Object.keys(entrada)) {
    const contenido = entrada[clave];
    salida[clave] = esClaveSecreta(clave)
      ? MASCARA
      : sanitizarParaRegistro(contenido as ValorRegistrable, profundidad + 1);
  }
  return salida;
}
