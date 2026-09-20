# 04 — Integraciones

Todas las integraciones siguen el patrón **puerto / adaptador**:

```
packages/integrations/src/<dominio>/
  ├── puerto.ts     interfaz + tipos de dominio del servicio
  ├── mock.ts       implementación determinista (desarrollo, demos, tests)
  └── http.ts       implementación real contra el proveedor
```

La fábrica `crearIntegraciones(config)` (`src/index.ts`) devuelve el conjunto
completo según `INTEGRACIONES_MODO`:

| Modo | Comportamiento |
| --- | --- |
| `mock` | Todo en memoria, datos verosímiles y deterministas. No sale a la red. **Default.** |
| `sandbox` | Adaptadores HTTP apuntando a los entornos de homologación de cada proveedor. |
| `produccion` | Adaptadores HTTP reales. Falla el arranque si falta una credencial. |

Reglas comunes a todos los adaptadores HTTP (`src/core/`):

- Timeout, reintentos con backoff exponencial y jitter, y *circuit breaker*.
- `claveIdempotencia` obligatoria en toda operación que produce efectos externos.
- Normalización de errores a `ErrorIntegracion` con `codigo`, `reintentable` y
  `proveedor`.
- Toda llamada se registra como `TramiteIntegracion` en la base, con request y
  response sanitizados (sin datos sensibles en claro).

---

## 1. BCRA — Central de Deudores y Cheques Rechazados

**Para qué:** es la fuente primaria y gratuita del diagnóstico. Con el CUIL del
cliente se obtienen las entidades que lo informan, el monto informado y la
*situación* (1 a 6), además del histórico de los últimos períodos y los cheques
rechazados.

- Puerto: `BcraPort` → `consultarDeudas`, `consultarHistorico`, `consultarChequesRechazados`.
- El BCRA publica una API REST abierta (`api.bcra.gob.ar`), por lo que el adaptador
  HTTP no requiere credenciales, sólo respetar límites de uso.
- La escala de situación se interpreta en `shared/src/bcra/situacion.ts`, que mapea
  cada nivel a su descripción normativa, al rango de días de atraso y al impacto
  esperado en la negociación.

**Uso en el producto:** al alta del cliente se dispara la consulta, se crean las
deudas detectadas y se genera el primer informe. Se reconsulta mensualmente para
seguir la evolución de la situación y detectar información que debería haber
caducado.

## 2. AFIP / ARCA

**Para qué:** validación de identidad del cliente y del abogado (padrón,
constancia de inscripción), y facturación electrónica de suscripciones y
comisiones.

- Puerto: `AfipPort` → `consultarPadron`, `emitirComprobante`, `consultarComprobante`.
- Requiere certificado X.509 y clave privada, autenticación WSAA (ticket de acceso
  con vencimiento, cacheado por el adaptador) y luego WSFEv1 para comprobantes.
- El adaptador maneja la renovación del ticket y el número de comprobante por punto
  de venta.

## 3. Bureaus de deuda / calificadoras privadas

**Para qué:** completar el diagnóstico con lo que informan los privados (que suele
incluir deuda no bancaria: servicios, telcos, cooperativas) y seguir la evolución
del score.

- Puerto: `BureauPort` → `consultarInforme`, `consultarScore`, `solicitarRectificacion`.
- Proveedores contemplados: Veraz/Equifax, Nosis y genéricos vía configuración.
- **Control duro:** el adaptador exige un `ConsentimientoVigente` para la finalidad
  `CONSULTA_INFORME_CREDITICIO`. Sin él, arroja `ErrorConsentimiento` antes de
  cualquier salida a la red (Ley 25.326, art. 5).
- Cada consulta genera un `ReporteCrediticio` con snapshot completo, lo que permite
  demostrar qué se informaba en cada fecha — prueba clave en un habeas data.

## 4. Carta Documento digital (Correo Argentino y operadores privados)

**Para qué:** es la herramienta de mayor impacto inmediato. Se usa para intimar al
acreedor a informar la composición de la deuda, para oponer la prescripción, para
exigir el cese de conductas contrarias al art. 8 bis de la Ley 24.240 y para
reclamar la supresión de datos vencidos.

- Puerto: `CartaDocumentoPort` → `cotizar`, `emitir`, `consultarEstado`, `descargarAcuse`.
- El flujo: la plataforma arma el texto desde una plantilla parametrizada, el
  abogado (o el cliente, según el tipo) lo revisa y firma, se emite, y la
  plataforma sigue el tracking hasta el acuse de recibo, que queda adjunto al
  expediente como prueba.
- Idempotencia obligatoria: una carta documento duplicada es un costo y un
  problema procesal.

## 5. Defensa del Consumidor — Ventanilla Única Federal / COPREC

**Para qué:** iniciar y seguir denuncias administrativas contra acreedores y
estudios de cobranza por trato indigno, información engañosa o cláusulas abusivas.
La denuncia administrativa es, en la práctica, el mayor incentivo a que el acreedor
se siente a negociar.

- Puerto: `DefensaConsumidorPort` → `presentarDenuncia`, `consultarEstado`,
  `adjuntarPrueba`, `listarAudiencias`.
- El sistema arma el relato de los hechos a partir de la línea de tiempo del caso
  (llamados registrados, mensajes, cartas recibidas) y adjunta la evidencia que el
  cliente cargó desde la app.
- Las audiencias se sincronizan con la agenda del abogado y disparan
  notificaciones.

## 6. Poder Judicial — causas y embargos

**Para qué:** detectar que el cliente tiene un juicio antes de que se entere por un
embargo, y seguir el expediente.

- Puerto: `JudicialPort` → `buscarCausasPorParte`, `consultarCausa`,
  `listarMovimientos`, `consultarEmbargos`.
- Contempla consulta por CUIL en los sistemas de consulta pública de causas.
  Cobertura desigual por fuero y jurisdicción: el adaptador declara qué
  jurisdicciones soporta y el resto queda como carga manual del abogado.
- Los embargos detectados se cruzan con `legal/embargos.ts` para verificar que no
  superen los topes del Decreto 484/87.

## 7. Pagos y suscripciones

**Para qué:** cobrar la suscripción mensual y las cuotas de la comisión de éxito.

- Puerto: `PagosPort` → `crearSuscripcion`, `pausarSuscripcion`,
  `cancelarSuscripcion`, `cobrarUnaVez`, `procesarWebhook`.
- Implementación de referencia: Mercado Pago (preapproval para débito recurrente
  con tarjeta y con CBU).
- La baja se ejecuta en el acto desde la app, sin retención (Res. SCI 424/2020).
- El webhook es idempotente por `id` del evento y firma verificada.

## 8. Firma electrónica

**Para qué:** poder de representación para gestión extrajudicial, convenio de
honorarios, acuerdos con acreedores.

- Puerto: `FirmaPort` → `crearSolicitud`, `consultarEstado`, `descargarFirmado`.
- Ley 25.506: la firma electrónica es válida entre partes; para actos que exigen
  firma ológrafa o certificada (por ejemplo, ciertos poderes judiciales) el flujo
  deriva al circuito notarial y lo registra como tal.

## 9. Mensajería

- Puerto: `MensajeriaPort` → `enviarWhatsapp`, `enviarEmail`, `enviarPush`.
- Preferencias por canal y horario. No se contacta fuera de la franja configurada:
  sería incoherente denunciar a un estudio de cobranza por llamar a las 22 h y
  hacer lo mismo.
- Registro de envíos para acreditar cumplimiento del deber de información.

---

## Matriz de integraciones

| Integración | Criticidad | Credenciales | Estado del adaptador HTTP |
| --- | --- | --- | --- |
| BCRA | Alta | No requiere | Implementado contra API pública |
| AFIP/ARCA | Alta | Certificado + clave | Esqueleto WSAA/WSFE, requiere certificados |
| Bureaus | Media | Contrato comercial | Esqueleto genérico configurable |
| Carta Documento | Alta | Contrato con operador | Esqueleto REST |
| Defensa del Consumidor | Alta | Usuario del organismo | Esqueleto REST |
| Judicial | Media | Variable por jurisdicción | Esqueleto REST |
| Pagos | Alta | Access token | Implementado (Mercado Pago) |
| Firma | Media | API key | Esqueleto REST |
| Mensajería | Alta | Token / SMTP | Esqueleto REST |

Los "esqueletos" implementan el contrato completo, el manejo de errores, la
idempotencia y el mapeo de datos; lo que falta es el detalle de endpoints y
payloads de cada proveedor, que se cierra al firmar el contrato comercial. Hasta
entonces el modo `mock` mantiene el producto funcionando de punta a punta.
