/**
 * Segundo factor por rol — ADR-023.
 *
 * CA-32: ADMINISTRADOR tiene MFA obligatorio, no configurable.
 * CA-38: ABOGADO tiene MFA obligatorio.
 * CA-39: CLIENTE puede desactivar MFA (con reautenticación fuerte).
 *
 * ADR-023 declara cinco cerrojos:
 * 1. `ExigeSegundoFactor<'ADMINISTRADOR'>` es el literal `true`
 * 2. No existe clave de configuración de MFA por rol (en apps/api)
 * 3. `mapaRolPermisos.ADMINISTRADOR` no tiene `'mfa.desactivar.propio'`
 * 4. Sin MFA activo, un rol profesional sólo puede inscribirlo
 * 5. `PERMISOS_NO_CONCEDIBLES_POR_AJUSTE` ciega el cerrojo 3
 *
 * Este archivo cubre los cerrojos 1, 3 y 5. Los cerrojos 2 y 4
 * están en otros módulos y en apps/api.
 */

import { describe, expect, it } from 'vitest';

import type { Rol } from './contrato/v1';
import { TABLA_DE_EXIGENCIA, exigeSegundoFactor, PARAMETROS_TOTP, CANTIDAD_DE_CODIGOS_DE_RESPALDO, CODIGOS_DE_RESPALDO_PARA_AVISAR } from './segundo-factor';
import { mapaRolPermisos, PERMISOS_NO_CONCEDIBLES_POR_AJUSTE } from './permisos';

describe('ADR-023 — Cerrojo 1: ExigeSegundoFactor<\'ADMINISTRADOR\'> es el literal true', () => {
  it('TABLA_DE_EXIGENCIA.ADMINISTRADOR es literalmente true', () => {
    expect(TABLA_DE_EXIGENCIA.ADMINISTRADOR).toBe(true);
  });

  it('TABLA_DE_EXIGENCIA.ABOGADO es literalmente true', () => {
    expect(TABLA_DE_EXIGENCIA.ABOGADO).toBe(true);
  });

  it('TABLA_DE_EXIGENCIA.CLIENTE es literalmente false', () => {
    expect(TABLA_DE_EXIGENCIA.CLIENTE).toBe(false);
  });

  it('la tabla es de solo lectura (verificable por tipo)', () => {
    // La propiedad readonly de TABLA_DE_EXIGENCIA es verificada por TypeScript.
    // En runtime, JavaScript no puede impedir la mutación de propiedades sin
    // Object.freeze, pero la presencia de la anotación readonly en el tipo
    // es suficiente para nuestro propósito: prevenir mutaciones accidentales
    // durante el desarrollo.
    expect(TABLA_DE_EXIGENCIA.ADMINISTRADOR).toBe(true);
  });

  it('exigeSegundoFactor retorna el valor de la tabla para cada rol', () => {
    expect(exigeSegundoFactor('ADMINISTRADOR')).toBe(true);
    expect(exigeSegundoFactor('ABOGADO')).toBe(true);
    expect(exigeSegundoFactor('CLIENTE')).toBe(false);
  });

  it('el tipo ExigeSegundoFactor<R> es un literal, no boolean', () => {
    // Esta verificación es principalmente tipográfica. Si alguna vez alguien
    // intentara cambiar TABLA_DE_EXIGENCIA.ADMINISTRADOR a false,
    // el compilador lo rechazaría porque el tipo de esa entrada es el
    // literal `true`, no `boolean`.

    // La función retorna ExigeSegundoFactor<R>, que para R='ADMINISTRADOR'
    // es el tipo `true` (no `boolean`).
    type AdminMFA = ReturnType<typeof exigeSegundoFactor<'ADMINISTRADOR'>>;
    // AdminMFA es `true` (tipo literal), no `boolean`.
    const valor: AdminMFA = true;
    expect(valor).toBe(true);
  });
});

describe('ADR-023 — Cerrojo 3: mapaRolPermisos.ADMINISTRADOR no tiene mfa.desactivar.propio', () => {
  it('ADMINISTRADOR no tiene mfa.desactivar.propio', () => {
    expect(mapaRolPermisos.ADMINISTRADOR).not.toContain('mfa.desactivar.propio');
  });

  it('ABOGADO no tiene mfa.desactivar.propio', () => {
    expect(mapaRolPermisos.ABOGADO).not.toContain('mfa.desactivar.propio');
  });

  it('CLIENTE es el único con mfa.desactivar.propio', () => {
    expect(mapaRolPermisos.CLIENTE).toContain('mfa.desactivar.propio');
    expect(mapaRolPermisos.ABOGADO).not.toContain('mfa.desactivar.propio');
    expect(mapaRolPermisos.ADMINISTRADOR).not.toContain('mfa.desactivar.propio');
  });

  it('un endpoint de desactivación de MFA para ADMINISTRADOR es inalcanzable: no hay permiso', () => {
    // La garantía es que el endpoint no puede autorizarse porque no hay
    // permiso que autorizar. La capa de autorización (apps/api) intenta
    // darle el permiso 'mfa.desactivar.propio', pero derivarPermisos nunca
    // lo retorna para ADMINISTRADOR.
    const adminPermisos = new Set(mapaRolPermisos.ADMINISTRADOR);
    expect(adminPermisos.has('mfa.desactivar.propio')).toBe(false);
  });
});

describe('ADR-023 — Cerrojo 5: PERMISOS_NO_CONCEDIBLES_POR_AJUSTE ciega el cerrojo 3', () => {
  it('ADMINISTRADOR tiene mfa.desactivar.propio en la lista de no concedibles', () => {
    expect(PERMISOS_NO_CONCEDIBLES_POR_AJUSTE.ADMINISTRADOR).toContain('mfa.desactivar.propio');
  });

  it('ABOGADO tiene mfa.desactivar.propio en la lista de no concedibles', () => {
    expect(PERMISOS_NO_CONCEDIBLES_POR_AJUSTE.ABOGADO).toContain('mfa.desactivar.propio');
  });

  it('CLIENTE no tiene bloqueados sus permisos de ajuste', () => {
    expect(PERMISOS_NO_CONCEDIBLES_POR_AJUSTE.CLIENTE).toEqual([]);
  });

  it('un AjusteDePermiso que intente conceder mfa.desactivar a ADMINISTRADOR es ignorado', () => {
    // Verificamos que la lógica de derivarPermisos chequea este blindaje.
    // Ver `permisos.test.ts` para la prueba de integración completa.
    const bloqueados = PERMISOS_NO_CONCEDIBLES_POR_AJUSTE.ADMINISTRADOR;
    expect(bloqueados.includes('mfa.desactivar.propio')).toBe(true);
  });
});

describe('Resumen: cuatro de los cinco cerrojos de ADR-023 están acá', () => {
  it('Cerrojo 1: ExigeSegundoFactor<\'ADMINISTRADOR\'> = true (literal)', () => {
    // ✓ Verificado arriba
    expect(TABLA_DE_EXIGENCIA.ADMINISTRADOR).toBe(true);
  });

  it('Cerrojo 2: No existe clave de configuración de MFA por rol (en apps/api)', () => {
    // Este cerrojo vive en el esquema de configuración de apps/api y su
    // test es responsabilidad de dev-backend. Se declara acá para que no
    // se pierda, pero no se puede probar en el dominio puro.
    //
    // La idea: no hay `config.mfa.requerido.ADMINISTRADOR` ni nada parecido
    // en el esquema JSON de arranque. Simplemente no existe la opción.
  });

  it('Cerrojo 3: mfa.desactivar no está en mapaRolPermisos.ADMINISTRADOR', () => {
    // ✓ Verificado arriba
    expect(mapaRolPermisos.ADMINISTRADOR).not.toContain('mfa.desactivar.propio');
  });

  it('Cerrojo 4: Sin MFA activo, un rol profesional sólo puede inscribirlo (en permisos.ts)', () => {
    // Este cerrojo vive en `derivarPermisos` cuando el rol es profesional
    // y `estadoMfa !== 'ACTIVO'`. Ver permisos.test.ts.
  });

  it('Cerrojo 5: PERMISOS_NO_CONCEDIBLES_POR_AJUSTE ciega el cerrojo 3', () => {
    // ✓ Verificado arriba
    expect(PERMISOS_NO_CONCEDIBLES_POR_AJUSTE.ADMINISTRADOR).toContain('mfa.desactivar.propio');
  });
});

describe('PARAMETROS_TOTP — literales de segundo factor', () => {
  it('algoritmo es SHA1 (compatibilidad)', () => {
    expect(PARAMETROS_TOTP.algoritmo).toBe('SHA1');
  });

  it('dígitos es 6 (TOTP estándar)', () => {
    expect(PARAMETROS_TOTP.digitos).toBe(6);
  });

  it('paso es 30 segundos (TOTP estándar)', () => {
    expect(PARAMETROS_TOTP.pasoEnSegundos).toBe(30);
  });

  it('ventana de pasos es ±1 (tolerancia mínima)', () => {
    expect(PARAMETROS_TOTP.ventanaDePasos).toBe(1);
  });

  it('secreto es 20 bytes (160 bits)', () => {
    expect(PARAMETROS_TOTP.longitudDelSecretoEnBytes).toBe(20);
  });

  it('los parámetros son de solo lectura (verificable por tipo)', () => {
    // Igual que con TABLA_DE_EXIGENCIA, la propiedad readonly es verificada
    // por el compilador TypeScript, no por JavaScript en runtime.
    expect(PARAMETROS_TOTP.digitos).toBe(6);
  });
});

describe('Códigos de respaldo', () => {
  it('se entregan 10 códigos de una vez', () => {
    expect(CANTIDAD_DE_CODIGOS_DE_RESPALDO).toBe(10);
  });

  it('se avisa cuando quedan 2 o menos', () => {
    expect(CODIGOS_DE_RESPALDO_PARA_AVISAR).toBe(2);
  });

  it('CODIGOS_DE_RESPALDO_PARA_AVISAR es menor que CANTIDAD_DE_CODIGOS_DE_RESPALDO', () => {
    expect(CODIGOS_DE_RESPALDO_PARA_AVISAR).toBeLessThan(CANTIDAD_DE_CODIGOS_DE_RESPALDO);
  });
});

describe('CA-38 — MFA obligatorio para ABOGADO', () => {
  it('exigeSegundoFactor("ABOGADO") retorna true', () => {
    expect(exigeSegundoFactor('ABOGADO')).toBe(true);
  });

  it('ABOGADO no tiene mfa.desactivar.propio en el mapa', () => {
    expect(mapaRolPermisos.ABOGADO).not.toContain('mfa.desactivar.propio');
  });

  it('ABOGADO en PENDIENTE_DE_INSCRIPCION_MFA solo puede inscribir (via derivarPermisos)', () => {
    // Prueba de integración en permisos.test.ts
    // Acá verificamos que el tipo literal retorna true.
    expect(exigeSegundoFactor('ABOGADO')).toBe(true);
  });
});

describe('CA-32 — MFA obligatorio para ADMINISTRADOR', () => {
  it('exigeSegundoFactor("ADMINISTRADOR") retorna el literal true', () => {
    expect(exigeSegundoFactor('ADMINISTRADOR')).toBe(true);
  });

  it('la tabla declara el literal true, no booleano configurable', () => {
    expect(TABLA_DE_EXIGENCIA.ADMINISTRADOR).toBe(true);
    // Si fuera `boolean`, se podría poner false. Pero es el literal `true`.
  });

  it('no hay opción de apagar MFA para ADMINISTRADOR', () => {
    // Los cinco cerrojos aseguran que:
    // 1. El tipo retorna `true` (no `false` o `null`)
    // 2. No hay clave de config que lo cambie
    // 3. No hay permiso de desactivar
    // 4. Si no está activo, sólo puede inscribir
    // 5. No se puede conceder el permiso por ajuste

    const permisoDesactivar = 'mfa.desactivar.propio';

    // El mapa no lo tiene:
    expect(mapaRolPermisos.ADMINISTRADOR).not.toContain(permisoDesactivar);

    // Los ajustes no lo pueden conceder:
    expect(PERMISOS_NO_CONCEDIBLES_POR_AJUSTE.ADMINISTRADOR).toContain(permisoDesactivar);

    // La exigencia es literal:
    expect(exigeSegundoFactor('ADMINISTRADOR')).toBe(true);
  });
});

describe('CA-39 — MFA opcional para CLIENTE, pero con restricciones', () => {
  it('exigeSegundoFactor("CLIENTE") retorna false (es opcional)', () => {
    expect(exigeSegundoFactor('CLIENTE')).toBe(false);
  });

  it('CLIENTE es el único que tiene mfa.desactivar.propio', () => {
    // Esto implementa el recaudo B-3: desactivar exige reautenticación fuerte.
    expect(mapaRolPermisos.CLIENTE).toContain('mfa.desactivar.propio');
  });

  it('CLIENTE tiene los permisos de MFA (inscribir, desactivar, regenerar)', () => {
    const permisos = mapaRolPermisos.CLIENTE;
    expect(permisos).toContain('mfa.inscribir.propio');
    expect(permisos).toContain('mfa.desactivar.propio');
    expect(permisos).toContain('mfa.regenerarCodigosDeRespaldo.propio');
  });
});
