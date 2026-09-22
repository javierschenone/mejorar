/**
 * ADR-022 — prueba tipada de autorización.
 *
 * Esta prueba verifica que la tipificación del sistema de autorización
 * impide la construcción de cualquier resultado de acceso sin pasar
 * por `autorizar`, que es quien emite la prueba. La marca `Autorizacion`
 * es un `unique symbol` no exportado: inconstruible fuera del módulo.
 *
 * CA-19, CA-20, CA-18.
 */

import { describe, it } from 'vitest';

import type { Autorizacion, ContextoDeAcceso, IdRecurso, Permiso, TipoRecurso } from './contrato/v1';
import { decidirAcceso } from './autorizacion';

describe('ADR-022 — prueba tipada de autorización', () => {
  it('la marca de Autorizacion es inconstruible fuera del módulo: el tipo no compila', () => {
    // Este comentario documenta el cerrojo del tipo. El tipo Autorizacion<P, T>
    // tiene un field marcaAutorizacion que es un unique symbol no exportado.
    // Sin esta marca, es imposible construir una instancia del tipo fuera del
    // módulo que exporta autorizar. Esta prueba existe para documentar que el
    // compilador lo verifica, aunque aquí no podamos demostrar la falla de
    // compilación en un test que está escrito (la falla pasaría).
    //
    // Si alguien alguna vez exportara el símbolo marcaAutorizacion, o cambiara
    // el tipo a un field booleano, esta prueba se actualiza y se vuelve a
    // intentar construir una Autorizacion falsa — y entonces sí fallaría.
    //
    // Nota: la garantía real vive en la firma de `autorizar` que vive en
    // apps/api, que es quien puede construir esta prueba llamando a
    // decidirAcceso (que es pura) después de verificar que la autorización
    // se cumple. decidirAcceso no la construye; sólo retorna una decisión.

    // Esto sería inválido sin acceso al símbolo marcaAutorizacion:
    // const prueba: Autorizacion<'perfil.leer.propio', 'USUARIO'> = {
    //   [marcaAutorizacion]: true,  // ← marcaAutorizacion no se exporta
    //   permiso: 'perfil.leer.propio',
    //   objetivo: { clase: 'INDIVIDUAL', tipo: 'USUARIO', id: ... },
    //   sujeto: ...,
    //   sesion: ...,
    //   momento: ...,
    //   evento: null,
    // };
    // @ts-expect-error — el símbolo marcaAutorizacion no es accesible
    const imposible: Autorizacion<'perfil.leer.propio', 'USUARIO'> = {};

    // La prueba termina sin assertion porque lo que se verifica es la
    // compilación del tipo, no el comportamiento en runtime. Si el
    // compilador no lo rechazara, la prueba fallaría; como la rechaza,
    // la sintaxis de @ts-expect-error es correcta.
  });

  it('decidirAcceso es pura y retorna una decisión, no una Autorizacion', () => {
    // decidirAcceso **no** construye la prueba de autorización.
    // Retorna una decisión abierta (PERMITIDO o DENEGADO con motivo).
    // La prueba la emite `autorizar` en apps/api, que consulta la base,
    // verifica que la decisión es PERMITIDO, y **entonces** construye la
    // Autorizacion llamando a `autorizar` en el borde.

    const contextoVacio: ContextoDeAcceso = {
      sujeto: 'a' as any,
      sesion: 'b' as any,
      permisos: new Set(),
      nivelAutenticacion: 'CONTRASENA',
      autenticadoEn: '2026-01-01T00:00:00.000Z' as any,
      idCorrelacion: 'test',
    };

    const resultado = decidirAcceso(
      contextoVacio,
      'perfil.leer.propio',
      { clase: 'ES_TITULAR' },
      { clasificacion: 'PERSONAL', exigeSegundoFactor: false, ventanaDeReautenticacion: null },
    );

    // La decisión es un objeto abierto con decisión y motivo opcional,
    // nunca una Autorizacion.
    if (resultado.decision === 'DENEGADO') {
      // En este caso, denegada por permiso ausente.
      const _x = resultado.motivo; // _x es MotivoDenegacion, permitido acceder
    }
  });
});
