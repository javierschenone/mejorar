-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 0023 — catalogos_de_acceso
-- Feature 002, tarea T-03. Fila `0023` de modelo-datos.md §6.2.
--
-- **Datos, no esquema.** Las reglas de retención de §5.1 con sus marcas de
-- validación, los parámetros de H.3, y la versión de desarrollo de los
-- documentos de B.1 y del texto del art. 6 de B.2/B.3.
--
-- Qué NO está acá, y por qué:
--
--   - **Las cuentas de demostración** (§6.5) van en `prisma/seed.ts`, no en una
--     migración. Una migración se aplica en TODOS los entornos, incluido
--     producción; el seed se corre a mano donde uno quiere. Cuentas de
--     demostración con contraseña conocida creadas por una migración son una
--     puerta abierta esperando el despliegue distraído. Es una divergencia
--     consciente con la fila `0023` de §6.2 y está anotada en el documento.
--   - **Los buzones de rol de D.8** (`CorreoDeRolProhibido`). Su clave primaria
--     es un HMAC-SHA-256 con `k_indice`, que por diseño VIVE FUERA DE LA BASE
--     (§4.3: "fuera de la base no es negociable"). Una migración no la tiene y
--     no debe tenerla. Los siembra `prisma/seed.ts`, que sí puede leerla del
--     entorno. La tabla queda vacía y el mecanismo R-002-04 inerte hasta
--     entonces: está declarado en el test, no escondido.
--
-- Reversión: reversion.sql de este mismo directorio.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. H.1 — reglas de retención (§5.1)
--
-- **Todas las filas con fundamento normativo salen con
-- `requiereValidacionProfesional = true` y con `validadoPor` VACÍA.** Ninguna
-- purga con plazo `A_DETERMINAR` puede ejecutarse: R-002-15 lo impide
-- materialmente, no por convención.
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO "acceso"."ReglaDeRetencion"
  ("clave", "plazoSegundos", "accion", "fundamento", "requiereValidacionProfesional")
VALUES
  ('cuentaNoVerificada', 2592000, 'PURGA_FISICA',
   'CA-28 y condicion C-002-03. Art. 4 inc. 7 de la Ley 25.326: los datos deben destruirse cuando dejan de ser necesarios. Es el caso mas claro del dictamen §2.3: datos de alguien que nunca fue usuario y que pudo no haber tecleado el formulario. 30 dias desde creadoEn sin confirmar. Valor [I] del revisor: requiere firma.',
   true),

  ('enlaceConfirmacion', 604800, 'PURGA_FISICA',
   'Producto. El enlace vive 24 h (parametro enlace.confirmacionVidaSegundos); la fila se conserva 7 dias para poder responder "se le mando". Sin objecion legal a otros valores.',
   false),

  ('enlaceRecuperacion', 604800, 'PURGA_FISICA',
   'Producto. El enlace vive 1 h (parametro enlace.recuperacionVidaSegundos); la fila se conserva 7 dias. Sin objecion legal a otros valores.',
   false),

  ('desafioDeIngreso', 86400, 'PURGA_FISICA',
   'Art. 9 de la Ley 25.326 (seguridad). El desafio vive 15 min; el registro, 24 h.',
   false),

  ('tokenRefrescoUsado', 2592000, 'PURGA_FISICA',
   'Art. 9. Se cuenta desde venceEn: vida del refresco mas 30 dias de margen. El margen es lo que permite detectar la reutilizacion de CA-11; sin margen, un token robado y usado tarde pasaria por nuevo.',
   false),

  ('intentosFallidos', 604800, 'PURGA_FISICA',
   'Art. 9. La ventana del parametro es de 15 min; el resto es margen para ver patrones. Dictamen §5.B: "no indefinido".',
   false),

  ('sesionCerrada', 7776000, 'PURGA_FISICA',
   'Art. 4 inc. 7 y art. 9. 90 dias desde cerradaEn. Es el dato mas identificatorio que la feature genera de forma continua (dictamen §5.B). Valor [I] del revisor: requiere firma.',
   true),

  ('envioTransaccional', 15552000, 'PURGA_FISICA',
   'Producto mas prueba de haber avisado (CA-02, CA-09, CA-16). 180 dias. No guarda direcciones de destino.',
   false),

  ('aceptacion', NULL, 'A_DETERMINAR',
   'Vida de la cuenta mas el plazo de prescripcion de la accion del consumidor. Dictamen §2.1 lo deja en [D]. ESCALAMIENTO E-002-3, BLOQUEANTE. Provisorio: conservacion indefinida, sin purga automatica.',
   true),

  ('verificacionProfesional', NULL, 'A_DETERMINAR',
   'Plazo de prescripcion de la responsabilidad profesional [D]. ES EL MISMO ESCALAMIENTO E-2 QUE LA FEATURE 004 DEJO ABIERTO: se resuelven juntos o no se resuelve ninguno. Provisorio: sin purga.',
   true),

  ('bitacoraAuditoria', NULL, 'A_DETERMINAR',
   'Constitucion #5 y art. 9. Tension real: es prueba en un habeas data y a la vez contiene datos personales. La 004 fijo 5 anios para BitacoraAcceso; aca NO se da por resuelto porque el dictamen de la 002 lo deja en [D]. Valor de trabajo: 5 anios. ESCALAMIENTO E-002-3, BLOQUEANTE.',
   true),

  ('documentacionRestitucionMfa', NULL, 'A_DETERMINAR',
   'No se recolecta: E.4 no existe. ESCALAMIENTO E-002-2. Mientras no haya base legal escrita para pedir la imagen de un documento de identidad, no hay plazo que fijar porque no hay dato que conservar.',
   true),

  ('cuentaDadaDeBaja', NULL, 'A_DETERMINAR',
   'Art. 4 inc. 7 y art. 16 frente a las obligaciones probatorias y contables [D]. BLOQUEA EL DISENIO DE LA FEATURE 003, no el G2 de la 002 (dictamen §2.3). El mecanismo esta construido (lapida de §5.4); falta el corte entre que se suprime y que se conserva como nucleo probatorio.',
   true);

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. H.3 — parámetros de acceso
--
-- Constitución #11: ninguno es una constante en el código.
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO "acceso"."ParametroDeAcceso"
  ("clave", "valor", "unidad", "esNormativo", "requiereValidacionProfesional", "notaDeAlcance")
VALUES
  ('ingreso.intentosMaximos', '5', 'intentos', false, false,
   'CA-09 y CA-37. Cinco intentos fallidos dentro de la ventana disparan el bloqueo.'),
  ('ingreso.ventanaDeConteoSegundos', '900', 'segundos', false, false,
   'CA-09. Ventana deslizante de 15 minutos sobre acceso.IntentoDeAutenticacion, por claveDeTrafico.'),
  ('ingreso.duracionDelBloqueoSegundos', '900', 'segundos', false, false,
   'CA-09 y CA-37. 15 minutos. CA-36: el bloqueo NUNCA inhabilita la recuperacion de contrasena; eso es la ausencia de una consulta y se verifica con test, no con este parametro.'),
  ('token.accesoVidaSegundos', '900', 'segundos', false, false,
   'CA-14. El token de acceso no lleva permisos (contrato §7): el efecto inmediato de CA-30 no depende de esta vida, depende de que no haya cache.'),
  ('token.refrescoVidaSegundos', '2592000', 'segundos', false, false,
   'CA-10, CA-11. 30 dias. Rotacion por familia con deteccion de reutilizacion sin ventana de gracia.'),
  ('desafio.vidaSegundos', '900', 'segundos', false, false,
   'CA-08. El desafio se emite SIEMPRE, exista o no la cuenta.'),
  ('enlace.confirmacionVidaSegundos', '86400', 'segundos', false, false,
   'CA-01, CA-06. 24 horas.'),
  ('enlace.recuperacionVidaSegundos', '3600', 'segundos', false, false,
   'CA-15, CA-16, CA-17. 1 hora.'),
  ('matricula.vigenciaVerificacionMeses', '12', 'meses', false, true,
   'CA-05, CA-29, salvaguarda M-6. Cuanto dura una verificacion de matricula antes de vencer. Marcado requiereValidacionProfesional porque si el estudio dictamina sobre el plazo, esta fila pasa a validada sin cambiar de tabla (modelo-datos H.3).'),
  ('matricula.plazoMaximoRevisionDiasCorridos', '7', 'dias corridos', false, false,
   'CA-31 EN LA VERSION 4 DE LA SPEC: "transcurren 7 dias corridos desde el alta (parametro de producto, no normativo, ajustable sin volver a esta compuerta)". DIVERGENCIA DECLARADA con modelo-datos.md H.3 y C.4, que fueron escritos contra la spec v3 y dicen "5 dias habiles" con dependencia de motor.DiaNoHabil. Se sigue la spec, que tiene precedencia sobre el material del agente (CLAUDE.md §6). La columna acceso.EscalamientoDeVerificacion.diasHabilesTranscurridos y el GRANT condicional sobre motor.DiaNoHabil quedan como estaban: cambiarlos es una decision de compuerta, no de esta migracion. Reportado al orquestador.'),
  ('mfa.ventanaReautenticacionFuerteSegundos', '300', 'segundos', false, false,
   'Recaudo B-3. Ventana desde Sesion.autenticadaEn dentro de la cual se admite desactivar el segundo factor. Aplica SOLO al rol CLIENTE: para ADMINISTRADOR y ABOGADO la desactivacion no es representable en la base (R-002-02).'),
  ('mfa.restitucionEsperaObligatoriaSegundos', '172800', 'segundos', false, false,
   'CA-35. 48 horas de demora obligatoria: le da al titular legitimo tiempo de reaccionar si la restitucion la pidio un atacante.'),
  ('mfa.codigosDeRespaldoPorLote', '10', 'codigos', false, false,
   'CA-08, CA-35. Cuantos codigos trae cada lote. Regenerar crea un lote nuevo e invalida el anterior.'),
  ('purga.cuentaNoVerificadaDiasDeGracia', '30', 'dias corridos', false, true,
   'CA-28. Espeja el plazo de la regla de retencion cuentaNoVerificada para que el proceso diario lo lea de un solo lugar. Si el estudio cambia el plazo, cambian las dos filas.');

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. B.2 y B.3 — el texto del art. 6, versión de desarrollo
--
-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  ESTA VERSIÓN NO ES APTA PARA UNA PERSONA REAL Y LO DICE EN LOS DATOS.    ║
-- ║                                                                           ║
-- ║  El art. 6 inc. b) exige la identidad y el domicilio del responsable de   ║
-- ║  la base. Hoy no están determinados: `ux.md` los deja como {RAZÓN         ║
-- ║  SOCIAL} y {DOMICILIO}, y la inscripción de la base ante la AAIP con      ║
-- ║  designación de responsable es la condición C-002-11, todavía abierta     ║
-- ║  (riesgo de cronograma 2 de CLAUDE.md §7).                                ║
-- ║                                                                           ║
-- ║  Inventar una razón social sería peor que dejar el hueco visible: el      ║
-- ║  texto del art. 6 es prueba de haber informado, y una prueba con un dato  ║
-- ║  inventado adentro es peor que ninguna. La fila se siembra para que el    ║
-- ║  sistema corra en desarrollo, con la marca dentro del propio dato para    ║
-- ║  que el test la pueda ver y para que nadie la confunda con la definitiva. ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- El contenido de los cinco incisos es el de `ux.md` §AL-2, que los reparte en
-- tres capas: nota de campo (incisos a, c, d), bloque "Qué hacemos con estos
-- datos" (incisos b, a, e, d) y política completa. B.3 es la capa 1.
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO "acceso"."VersionInformacionArt6"
  ("version", "hashDelTexto", "responsableRazonSocial", "responsableDomicilio",
   "destinatarios", "canalDeEjercicioDeDerechos", "vigenteDesde")
VALUES (
  '0-desarrollo',
  encode(digest(
    'Los guarda {RAZON SOCIAL}, con domicilio en {DOMICILIO}. Los usamos para tu cuenta y para el servicio, nada mas: no los vendemos ni los cedemos a nadie. '
    'Para mandarte los correos usamos a {PROVEEDOR DE CORREO}, que los envia por nosotros y no puede usarlos para otra cosa. '
    'Cada vez que entras guardamos la fecha, el dispositivo y una ubicacion aproximada, para que puedas ver desde donde entraron a tu cuenta y cerrar lo que no reconozcas. '
    'Los tres datos de arriba son obligatorios: sin ellos no podemos abrir la cuenta. No te pedimos ningun otro dato. '
    'Podes pedir ver, corregir o borrar tus datos cuando quieras, desde tu perfil o escribiendo a {CANAL DE CONTACTO}.',
    'sha256'), 'hex'),
  'SIN DETERMINAR — BORRADOR DE DESARROLLO, no apto para una persona real (condicion C-002-11: inscripcion ante la AAIP y designacion de responsable, pendiente)',
  'SIN DETERMINAR — BORRADOR DE DESARROLLO',
  ARRAY[
    'Proveedor de correo transaccional (encargado de tratamiento, art. 25 Ley 25.326) — SIN IDENTIFICAR: condicion C-002-10, entrada 052 del registro de compuertas',
    'Ningun otro. No se ceden datos a terceros ni se consulta informe crediticio con esta aceptacion (R-002-07)'
  ],
  'Desde tu perfil, o escribiendo a {CANAL DE CONTACTO} — SIN DETERMINAR',
  '2026-01-01T00:00:00Z'
);

-- Art. 6 inc. c) — el que más se olvida. Sin estas cinco filas, el disparador
-- diferido `tg_art6_exige_campos` no deja que la versión de arriba quede
-- vigente, y la transacción de esta migración no cierra. `CUIT_CUIL` NO está y
-- no debe estar: la tabla A.2 no existe (escalamiento E-002-1).
INSERT INTO "acceso"."CampoDeclaradoEnElAlta"
  ("version", "campo", "caracter", "claveDeFinalidad", "consecuenciaDeNoDarlo")
VALUES
  ('0-desarrollo', 'CORREO', 'OBLIGATORIO', 'identificacion.cuenta',
   'Con esto identificamos tu cuenta, te confirmamos el alta y te avisamos si alguien intenta entrar. Si lo escribis mal no vas a poder confirmar la cuenta ni recuperarla.'),
  ('0-desarrollo', 'CONTRASENA', 'OBLIGATORIO', 'autenticacion.credencial',
   'Sin contrasena no podemos abrir la cuenta. Se guarda cifrada con argon2id y nadie de la plataforma puede leerla.'),
  ('0-desarrollo', 'NOMBRE_PARA_MOSTRAR', 'OBLIGATORIO', 'trato.personalizado',
   'Lo usamos para saludarte en la app y en los correos. Puede ser solo tu nombre de pila. Sin el no podemos abrir la cuenta.'),
  ('0-desarrollo', 'MATRICULA', 'OBLIGATORIO', 'verificacion.habilitacion_profesional',
   'Solo para el alta de abogado. La usamos para verificar que podes ejercer y para mostrarle al cliente quien lleva su caso. Es visible para el cliente que tenga un caso asignado con vos. Sin ella no podemos verificarte ni asignarte casos.'),
  ('0-desarrollo', 'JURISDICCION', 'OBLIGATORIO', 'verificacion.alcance_territorial',
   'Solo para el alta de abogado. Determina en que casos podemos asignarte. Sin ella no podemos asignarte ninguno.');

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. B.1 — términos y política, versión de desarrollo
--
-- Misma advertencia que arriba: los textos definitivos los escribe `ux-expert`
-- y los ratifica `compliance-legal` (condición C-002-01). Lo que sí es
-- definitivo y no se negocia es `incluyeFinalidadesDeLa003 = false`: el `CHECK`
-- `ck_documento_sin_finalidades_003` hace que ninguna versión, ni esta ni la
-- futura, pueda arrastrar consulta a bureaus, cesión a terceros o
-- comunicaciones comerciales (R-002-07, art. 37 de la Ley 24.240).
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO "acceso"."VersionDocumentoAceptable"
  ("clase", "version", "hashDelTexto", "referenciaDelTexto", "vigenteDesde", "incluyeFinalidadesDeLa003")
VALUES
  ('TERMINOS_Y_CONDICIONES', '0-desarrollo',
   encode(digest('BORRADOR DE DESARROLLO — terminos y condiciones sin redactar. Los redacta ux-expert y los ratifica compliance-legal (condicion C-002-01). No apto para una persona real.', 'sha256'), 'hex'),
   'specs/002-identidad-y-acceso/ux.md §AL-2 — TEXTO NO REDACTADO',
   '2026-01-01T00:00:00Z', false),
  ('POLITICA_DE_PRIVACIDAD', '0-desarrollo',
   encode(digest('BORRADOR DE DESARROLLO — politica de privacidad sin redactar. La redacta ux-expert y la ratifica compliance-legal (condicion C-002-01). No apta para una persona real.', 'sha256'), 'hex'),
   'specs/002-identidad-y-acceso/ux.md §AL-2 — TEXTO NO REDACTADO',
   '2026-01-01T00:00:00Z', false);
