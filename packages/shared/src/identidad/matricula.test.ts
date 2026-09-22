/**
 * Estado de la matrícula profesional — ADR-026.
 *
 * CA-05, CA-29, CA-30, CA-31: derivación del estado a partir de hechos registrados.
 * Salvaguarda M-6: nunca se exhibe "verificado" sin la fecha.
 *
 * Las pruebas cubren los bordes de vigencia, la suspensión con efecto inmediato,
 * y que ninguna clave de exhibición afirma "verificado" sin fecha.
 */

import { describe, expect, it } from 'vitest';

import type { DecisionDeVerificacion, FechaCivil, HistoriaDeVerificacion, Instante, SuspensionDeMatricula } from './contrato/v1';
import { claveDeExhibicionDeMatricula, derivarEstadoMatricula, PLANTILLAS_QUE_AFIRMAN_VERIFICACION } from './matricula';
import { duracionLiteral, comoFechaCivil, comoInstante } from './tiempo';

function instante(texto: string): Instante {
  const resultado = comoInstante(texto);
  if (!resultado.ok) throw new Error(`instante de prueba inválido: ${texto}`);
  return resultado.valor;
}

function fecha(texto: string): FechaCivil {
  const resultado = comoFechaCivil(texto);
  if (!resultado.ok) throw new Error(`fecha de prueba inválida: ${texto}`);
  return resultado.valor;
}

describe('ADR-026 — estado de matrícula derivado (no almacenado)', () => {
  const instanteVerificacion = instante('2025-06-15T10:30:00.000Z');
  const vigenciaHasta = fecha('2026-06-14'); // Un año después, menos un día

  const evidencia = {
    colegio: 'Colegio de Abogados de CABA',
    jurisdiccion: 'CABA' as const,
    numeroDeMatricula: '12345',
    tomoYFolio: '145/2025',
    claseDeConstancia: 'CONSTANCIA_EMITIDA_POR_EL_COLEGIO' as const,
    fechaDeLaConstancia: fecha('2025-06-15'),
    referenciaDelDocumento: 'CAA-12345-2025',
    verificadaPor: 'user-123' as any,
  };

  const decision: DecisionDeVerificacion = {
    id: 'verif-001' as any,
    momento: instanteVerificacion,
    resultado: 'APROBADA',
    evidencia,
    vigenciaHasta,
  };

  const historia: HistoriaDeVerificacion = {
    solicitadaEn: instanteVerificacion,
    decisiones: [decision],
    suspensiones: [],
  };

  it('matrícula verificada y dentro de vigencia: VIGENTE', () => {
    const duracionMaxima = duracionLiteral(7 * 24 * 3600); // 7 días para revisión
    const ahora = instante('2026-05-01T00:00:00.000Z'); // Antes de vencer

    const estado = derivarEstadoMatricula(historia, ahora, duracionMaxima);

    expect(estado.estado).toBe('VIGENTE');
    if (estado.estado === 'VIGENTE') {
      expect(estado.vigenciaHasta).toBe(vigenciaHasta);
    }
  });

  it('borde: el último día de vigencia (2026-06-14) cuenta completo', () => {
    const duracionMaxima = duracionLiteral(7 * 24 * 3600);
    // A las 23:59:59 del último día
    const ultimoSegundoDelDia = instante('2026-06-14T23:59:59.999Z');

    const estado = derivarEstadoMatricula(historia, ultimoSegundoDelDia, duracionMaxima);

    expect(estado.estado).toBe('VIGENTE');
  });

  it('borde: después de que venza en hora argentina (2026-06-15T03:00:00.000Z): VENCIDA', () => {
    const duracionMaxima = duracionLiteral(7 * 24 * 3600);
    // El último segundo de 2026-06-14 en Argentina es 2026-06-15T02:59:59.999Z en UTC.
    // Así que 2026-06-15T03:00:00.000Z UTC ya está fuera de la vigencia.
    const primerSegundoFueraDeVigencia = instante('2026-06-15T03:00:00.000Z');

    const estado = derivarEstadoMatricula(historia, primerSegundoFueraDeVigencia, duracionMaxima);

    expect(estado.estado).toBe('VENCIDA');
    if (estado.estado === 'VENCIDA') {
      expect(estado.vigenciaHasta).toBe(vigenciaHasta);
    }
  });

  it('un día después del vencimiento: VENCIDA', () => {
    const duracionMaxima = duracionLiteral(7 * 24 * 3600);
    const alDiaSiguiente = instante('2026-06-16T10:30:00.000Z');

    const estado = derivarEstadoMatricula(historia, alDiaSiguiente, duracionMaxima);

    expect(estado.estado).toBe('VENCIDA');
  });
});

describe('CA-29 — vigencia de matrícula y permiso de recibir asignaciones', () => {
  const verificadaEl = instante('2025-01-01T00:00:00.000Z');

  const ahora = instante('2025-12-31T10:00:00.000Z');

  const vigenciaDeUnAno = fecha('2025-12-31');
  const veceDeUnAno = fecha('2026-01-01');

  it('matrícula vencida: se retira caso.recibirAsignacion pero quedan los otros permisos', () => {
    // La prueba verifica el comportamiento descrito en CA-29 al derivar
    // permisos, no acá. Esta prueba verifica que `derivarEstadoMatricula`
    // devuelve correctamente VENCIDA.

    const evidencia = {
      colegio: 'Colegio de Abogados',
      jurisdiccion: 'CABA' as const,
      numeroDeMatricula: '99999',
      tomoYFolio: null,
      claseDeConstancia: 'CONSULTA_AL_PADRON_PUBLICO' as const,
      fechaDeLaConstancia: fecha('2025-01-01'),
      referenciaDelDocumento: 'ref-001',
      verificadaPor: 'admin-1' as any,
    };

    const historia: HistoriaDeVerificacion = {
      solicitadaEn: verificadaEl,
      decisiones: [
        {
          id: 'verif-001' as any,
          momento: verificadaEl,
          resultado: 'APROBADA',
          evidencia,
          vigenciaHasta: vigenciaDeUnAno,
        },
      ],
      suspensiones: [],
    };

    const duracionMaxima = duracionLiteral(7 * 24 * 3600);
    const estado = derivarEstadoMatricula(historia, ahora, duracionMaxima);

    expect(estado.estado).toBe('VIGENTE');

    // Cuando pase al día siguiente, vencerá:
    const mananaAlMediadia = instante('2026-01-01T12:00:00.000Z');
    const estadoVencida = derivarEstadoMatricula(historia, mananaAlMediadia, duracionMaxima);
    expect(estadoVencida.estado).toBe('VENCIDA');
  });
});

describe('CA-30 — suspensión de matrícula: efecto inmediato', () => {
  const verificadaEl = instante('2025-06-15T10:30:00.000Z');
  const vigenciaHasta = fecha('2026-06-14');

  const evidencia = {
    colegio: 'Colegio de Abogados de CABA',
    jurisdiccion: 'CABA' as const,
    numeroDeMatricula: '12345',
    tomoYFolio: '145/2025',
    claseDeConstancia: 'CONSTANCIA_EMITIDA_POR_EL_COLEGIO' as const,
    fechaDeLaConstancia: fecha('2025-06-15'),
    referenciaDelDocumento: 'CAA-12345-2025',
    verificadaPor: 'user-123' as any,
  };

  it('suspensión vigente: SUSPENDIDA (sin esperar vencimiento)', () => {
    const ahora = instante('2026-03-01T10:00:00.000Z');
    const suspendidaHace2Meses = instante('2025-12-01T09:00:00.000Z');

    const historia: HistoriaDeVerificacion = {
      solicitadaEn: verificadaEl,
      decisiones: [
        {
          id: 'verif-001' as any,
          momento: verificadaEl,
          resultado: 'APROBADA',
          evidencia,
          vigenciaHasta,
        },
      ],
      suspensiones: [
        {
          desde: suspendidaHace2Meses,
          hasta: null, // indefinida
          dispuestaPor: 'admin-1' as any,
          motivo: 'NOTIFICACION_DEL_COLEGIO',
        },
      ],
    };

    const duracionMaxima = duracionLiteral(7 * 24 * 3600);
    const estado = derivarEstadoMatricula(historia, ahora, duracionMaxima);

    expect(estado.estado).toBe('SUSPENDIDA');
    if (estado.estado === 'SUSPENDIDA') {
      expect(estado.motivo).toBe('NOTIFICACION_DEL_COLEGIO');
    }
  });

  it('suspensión que ya finalizó: vuelve al estado anterior (VIGENTE o VENCIDA)', () => {
    const ahora = instante('2026-03-01T10:00:00.000Z');
    const suspendidaDe_a = {
      desde: instante('2025-12-01T09:00:00.000Z'),
      hasta: instante('2026-01-01T18:00:00.000Z'), // ya finalizó
      dispuestaPor: 'admin-1' as any,
      motivo: 'PEDIDO_DEL_PROFESIONAL' as const,
    };

    const historia: HistoriaDeVerificacion = {
      solicitadaEn: verificadaEl,
      decisiones: [
        {
          id: 'verif-001' as any,
          momento: verificadaEl,
          resultado: 'APROBADA',
          evidencia,
          vigenciaHasta,
        },
      ],
      suspensiones: [suspendidaDe_a],
    };

    const duracionMaxima = duracionLiteral(7 * 24 * 3600);
    const estado = derivarEstadoMatricula(historia, ahora, duracionMaxima);

    // La suspensión terminó, volvemos al estado de la verificación.
    expect(estado.estado).toBe('VIGENTE');
  });

  it('múltiples suspensiones: la última vigente prevalece', () => {
    const ahora = instante('2026-03-01T10:00:00.000Z');

    const historia: HistoriaDeVerificacion = {
      solicitadaEn: verificadaEl,
      decisiones: [
        {
          id: 'verif-001' as any,
          momento: verificadaEl,
          resultado: 'APROBADA',
          evidencia,
          vigenciaHasta,
        },
      ],
      suspensiones: [
        {
          desde: instante('2025-08-01T00:00:00.000Z'),
          hasta: instante('2025-09-01T00:00:00.000Z'), // ya finalizó
          dispuestaPor: 'admin-1' as any,
          motivo: 'DENUNCIA_RECIBIDA',
        },
        {
          desde: instante('2026-02-01T00:00:00.000Z'),
          hasta: null, // vigente
          dispuestaPor: 'admin-2' as any,
          motivo: 'NOTIFICACION_DEL_COLEGIO',
        },
      ],
    };

    const duracionMaxima = duracionLiteral(7 * 24 * 3600);
    const estado = derivarEstadoMatricula(historia, ahora, duracionMaxima);

    expect(estado.estado).toBe('SUSPENDIDA');
    if (estado.estado === 'SUSPENDIDA') {
      expect(estado.motivo).toBe('NOTIFICACION_DEL_COLEGIO'); // la más reciente vigente
    }
  });
});

describe('CA-31 — plazo de revisión y escalamiento', () => {
  const verificadaEl = instante('2026-01-01T10:00:00.000Z');

  it('pendiente dentro del plazo: plazoVencido = false', () => {
    const ahora = instante('2026-01-03T10:00:00.000Z'); // 2 días después
    const plazoMaximo = duracionLiteral(7 * 24 * 3600); // 7 días

    const historia: HistoriaDeVerificacion = {
      solicitadaEn: verificadaEl,
      decisiones: [],
      suspensiones: [],
    };

    const estado = derivarEstadoMatricula(historia, ahora, plazoMaximo);

    expect(estado.estado).toBe('PENDIENTE');
    if (estado.estado === 'PENDIENTE') {
      expect(estado.plazoVencido).toBe(false);
    }
  });

  it('pendiente: después del vencimiento del plazo = plazoVencido = true', () => {
    const ahora = instante('2026-01-09T10:00:00.000Z'); // más de 7 días después (1 día + 10 horas)
    const plazoMaximo = duracionLiteral(7 * 24 * 3600); // 7 días = 604800 segundos

    const historia: HistoriaDeVerificacion = {
      solicitadaEn: verificadaEl,
      decisiones: [],
      suspensiones: [],
    };

    const estado = derivarEstadoMatricula(historia, ahora, plazoMaximo);

    expect(estado.estado).toBe('PENDIENTE');
    if (estado.estado === 'PENDIENTE') {
      expect(estado.plazoVencido).toBe(true);
    }
  });

  it('pendiente después del vencimiento del plazo: plazoVencido = true', () => {
    const ahora = instante('2026-01-10T10:00:00.000Z'); // 9 días después
    const plazoMaximo = duracionLiteral(7 * 24 * 3600);

    const historia: HistoriaDeVerificacion = {
      solicitadaEn: verificadaEl,
      decisiones: [],
      suspensiones: [],
    };

    const estado = derivarEstadoMatricula(historia, ahora, plazoMaximo);

    expect(estado.estado).toBe('PENDIENTE');
    if (estado.estado === 'PENDIENTE') {
      expect(estado.plazoVencido).toBe(true);
    }
  });
});

describe('Salvaguarda M-6 — exhibición nunca afirma "verificado" sin fecha', () => {
  it('las claves que afirman verificación requieren la variable fechaDeVerificacion', () => {
    // Verificamos que cada plantilla que afirma verificación incluye
    // la variable de fecha.

    for (const plantilla of PLANTILLAS_QUE_AFIRMAN_VERIFICACION) {
      // Ninguna clave debe ser exactamente 'verificado' o terminar con 'verificado'
      expect(plantilla).not.toBe('matricula.verificado');
      expect(!plantilla.endsWith('verificado')).toBe(true);

      // Deben incluir la palabra 'verificada-el' (el guión marca que va fecha)
      expect(plantilla.includes('verificada-el')).toBe(true);
    }
  });

  it('estado VIGENTE: retorna claveDeExhibicion con fecha', () => {
    const verificadaEl = instante('2025-06-15T10:30:00.000Z');
    const vigenciaHasta = fecha('2026-06-14');

    const estado = {
      estado: 'VIGENTE' as const,
      verificadaEn: verificadaEl,
      vigenciaHasta,
      evidencia: {
        colegio: 'Colegio',
        jurisdiccion: 'CABA' as const,
        numeroDeMatricula: '12345',
        tomoYFolio: null,
        claseDeConstancia: 'CONSTANCIA_EMITIDA_POR_EL_COLEGIO' as const,
        fechaDeLaConstancia: fecha('2025-06-15'),
        referenciaDelDocumento: 'ref',
        verificadaPor: 'user-1' as any,
      },
    };

    const exhibicion = claveDeExhibicionDeMatricula(estado);

    expect(exhibicion.plantilla).toBe('matricula.verificada-el');
    // Debe incluir fechaDeVerificacion
    const tieneFecha = exhibicion.variables.some((v) => v.clave === 'fechaDeVerificacion');
    expect(tieneFecha).toBe(true);
  });

  it('estado VENCIDA: retorna claveDeExhibicion con fecha', () => {
    const verificadaEl = instante('2025-06-15T10:30:00.000Z');
    const vigenciaHasta = fecha('2025-12-31');

    const estado = {
      estado: 'VENCIDA' as const,
      verificadaEn: verificadaEl,
      vigenciaHasta,
      evidencia: {
        colegio: 'Colegio',
        jurisdiccion: 'CABA' as const,
        numeroDeMatricula: '12345',
        tomoYFolio: null,
        claseDeConstancia: 'CONSTANCIA_EMITIDA_POR_EL_COLEGIO' as const,
        fechaDeLaConstancia: fecha('2025-06-15'),
        referenciaDelDocumento: 'ref',
        verificadaPor: 'user-1' as any,
      },
    };

    const exhibicion = claveDeExhibicionDeMatricula(estado);

    expect(exhibicion.plantilla).toBe('matricula.verificada-el.vigencia-vencida');
    // Debe incluir fechaDeVerificacion
    const tieneFecha = exhibicion.variables.some((v) => v.clave === 'fechaDeVerificacion');
    expect(tieneFecha).toBe(true);
  });

  it('estado PENDIENTE: NO afirma verificación', () => {
    const solicitadaEl = instante('2026-01-01T10:00:00.000Z');

    const estado = {
      estado: 'PENDIENTE' as const,
      desde: solicitadaEl,
      plazoVencido: false,
    };

    const exhibicion = claveDeExhibicionDeMatricula(estado);

    expect(exhibicion.plantilla).not.toBe('matricula.verificado');
    expect(exhibicion.plantilla).not.toContain('verificada');
  });

  it('estado RECHAZADA: NO afirma verificación', () => {
    const rechazadaEl = instante('2026-01-02T15:30:00.000Z');

    const estado = {
      estado: 'RECHAZADA' as const,
      momento: rechazadaEl,
    };

    const exhibicion = claveDeExhibicionDeMatricula(estado);

    expect(exhibicion.plantilla).not.toContain('verificada');
    expect(exhibicion.plantilla).toBe('matricula.rechazada');
  });

  it('estado SUSPENDIDA: NO afirma verificación', () => {
    const suspendidaEl = instante('2026-02-01T00:00:00.000Z');

    const estado = {
      estado: 'SUSPENDIDA' as const,
      desde: suspendidaEl,
      dispuestaPor: 'admin-1' as any,
      motivo: 'NOTIFICACION_DEL_COLEGIO' as const,
    };

    const exhibicion = claveDeExhibicionDeMatricula(estado);

    expect(exhibicion.plantilla).toBe('matricula.en-revision');
    expect(exhibicion.plantilla).not.toContain('verificado');
  });
});
