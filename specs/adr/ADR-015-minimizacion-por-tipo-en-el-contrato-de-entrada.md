# ADR-015 — Minimización por tipo en el contrato de entrada del motor

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 004 |
| Spec de origen | `specs/004-motor-reglas-legales/spec.md` v3 (CA-60, R-14) |
| Origen | Condición **C-10** del dictamen (§2.2), a verificar en G2 |
| Contrato | `specs/contratos/motor-reglas-legales.ts` §1 y §4 |

## Contexto

El dictamen es categórico (§2.2): *"Ninguno de los cinco análisis necesita el
nombre, el DNI, el CUIL ni el domicilio del deudor para producir su resultado."*
Y el corolario: si el contrato los admite, la minimización del art. 4 de la Ley
25.326 se debilita **sin ninguna contrapartida funcional**.

La minimización se suele escribir como una política y se incumple sola: alguien
pasa el objeto completo del cliente porque estaba a mano, y seis meses después
el CUIL está en un log, en una traza de error y en el volcado de una excepción.
El hallazgo del análisis D contiene la remuneración de la persona; unirlo a un
nombre lo convierte en otra cosa.

La condición C-10 dice que se verifica "en G2 + test de tipo". Este ADR define
qué significa eso concretamente.

## Decisión

La minimización se implementa como **restricción de compilación, más una guarda
equivalente en el borde donde los tipos ya no existen**.

### 1. Identificadores opacos con marca nominal

`IdOpaco<TEntidad>` es `string` con marca de fase de tipos, parametrizado por
entidad: `IdDeuda`, `IdPersona`, `IdCuenta`, `IdAcreedor`, etc. No se pueden
intercambiar entre sí y no se pueden construir con una asignación: se construyen
con `crearIdOpaco`, que además **valida en ejecución que el valor no tenga forma
de dato identificatorio** —7 u 8 dígitos (DNI), 11 dígitos (CUIT/CUIL), algo con
arroba, algo con espacios—.

El identificador no deriva de ningún dato de la persona: es UUIDv4 o ULID. La
correspondencia identificador ↔ persona vive fuera del motor, en el sistema que
llama, con su propia bitácora de accesos (constitución #5).

### 2. Lista cerrada de claves prohibidas y chequeo recursivo en el tipo

`ClaveProhibidaPorMinimizacion` enumera ~40 nombres de campo:
`nombre`, `dni`, `cuit`, `cuil`, `domicilio`, `email`, `telefono`,
`fechaNacimiento`, `cbu`, `numeroTarjeta`, `legajo`, `empleador`, `firma`...

`ContieneClaveProhibida<T>` recorre objetos y arreglos **en cualquier nivel de
anidamiento** y `Minimizada<T>` devuelve `never` si encuentra alguna.

La firma del punto de entrada es:

```
evaluar<E extends EntradaEvaluacion>(entrada: E & Minimizada<E>, contexto)
```

La forma genérica no es adorno: el chequeo de propiedades en exceso de
TypeScript sólo actúa sobre literales de objeto, así que un objeto pasado por
variable se colaría. Con `E & Minimizada<E>`, si `E` contiene una clave
prohibida a cualquier profundidad, el tipo del parámetro es `never` y **el
programa no compila**, venga de donde venga el objeto.

### 3. Guarda equivalente en ejecución para el borde HTTP

`verificarMinimizacion(entrada: unknown)` hace el mismo recorrido sobre el valor
real. La invoca `dev-backend` **antes** de llamar al motor, sobre el cuerpo ya
deserializado (obligación de frontera F-08 del plan). Devuelve `ErrorMotor` de
clase `MINIMIZACION_VULNERADA`.

Los tipos no sobreviven a un `JSON.parse`. Sin esta guarda, la garantía se
termina exactamente en el punto donde entra el dato de un tercero.

### 4. Lista negra y no lista blanca, con una razón

Una lista blanca —"sólo estos campos están permitidos"— sería más fuerte en
teoría. En la práctica `EntradaEvaluacion` **ya es** la lista blanca: es un tipo
cerrado con campos enumerados. La lista negra cumple otro papel: proteger el
tipo **de sus futuras modificaciones**. Si dentro de un año alguien agrega
`empleador: string` a `DatosIngreso` porque "sirve para el análisis D", el
chequeo lo rechaza en el momento de escribirlo, no en una auditoría.

Corolario operativo: **la lista es parte del contrato y sólo crece**. Sacar una
clave de la lista exige pasar por G2 y justificar la necesidad funcional.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| Política escrita en el plan y revisión en el PR | Cero código | Depende de que el revisor se acuerde. La condición C-10 exige "test de tipo" | Es lo que se hace en todos lados y es lo que falla en todos lados |
| Sólo validación en ejecución (Zod con `strict`) | Simple, mensajes claros | Falla tarde, ya con el dato adentro del proceso y probablemente ya logueado; no impide que un desarrollador escriba el campo | Necesaria pero insuficiente: va **además**, en el borde HTTP |
| Sólo `EntradaEvaluacion` como tipo cerrado, sin `Minimizada<E>` | Mucho más simple de leer | Protege el hoy y no el mañana: el tipo se puede modificar y nada avisa | El riesgo real es la evolución del tipo, no el estado inicial |
| Cifrar los identificadores en vez de usar opacos | El dato viaja "protegido" | Un identificador cifrado sigue siendo un dato personal y se puede descifrar; agrega gestión de claves al dominio puro | Un identificador sin significado es estructuralmente más simple y más seguro |
| Identificador derivado (hash del CUIL) | No hay tabla de correspondencia que mantener | Un hash de un CUIL es reversible por fuerza bruta en segundos: el espacio de CUILs es chico. Sigue siendo dato personal | Error clásico. UUID aleatorio, sin excepción |
| Pasar el objeto de dominio completo y que el motor ignore lo que no usa | Menos plomería para el llamador | El dato entra al proceso, aparece en trazas y volcados de error, y la minimización se vuelve una intención | Es exactamente el escenario del riesgo RL-16 |

## Consecuencias

**Positivas**

- C-10 se verifica en G2 leyendo el contrato, y en G5 con un test de tipo que
  falla a propósito (se compila un caso con `dni` y se espera error).
- El motor es auditable sin datos personales: un abogado puede leer una entrada
  completa sin acceder a información identificable.
- Si el motor alguna vez se ejecutara fuera del entorno de la API (en el
  teléfono, en un cuaderno de análisis), no arrastra datos identificatorios.

**Negativas**

- `ContieneClaveProhibida<T>` es un tipo recursivo y **encarece la compilación**.
  Se acota porque `EntradaEvaluacion` es un árbol de profundidad conocida y
  chica. Si el tiempo de compilación de `packages/shared` superara el
  presupuesto de §6 del plan, se revisa.
- Los mensajes de error del compilador ante una violación son oscuros
  (`Type 'X' is not assignable to type 'never'`). Se mitiga con un comentario en
  el contrato y con un caso de ejemplo en el test.
- La correspondencia identificador ↔ persona hay que mantenerla en otro lado y
  auditarla. Es trabajo real que se le pide al `database-engineer` y a la spec
  007 (obligación de frontera F-09).
- Depurar un caso real se vuelve incómodo: hay que resolver los identificadores
  a mano. Es el comportamiento buscado y coincide con la regla operativa de
  `CLAUDE.md` §6 sobre no pegar datos reales en una sesión de desarrollo.

**Qué cierra**

- Pasar el agregado de cliente o de expediente al motor.
- Cualquier campo identificatorio en el contrato de entrada, ahora y después.

## Cómo se revierte

- **Sacar una clave de la lista prohibida** porque un análisis nuevo la
  necesita: barato de escribir, exige G2 y probablemente dictamen de
  `compliance-legal`. El costo está puesto donde tiene que estar: en la
  justificación, no en el código.
- **Eliminar `Minimizada<E>` y quedarse con la validación en ejecución**: media
  hora de trabajo. Se haría sólo si el costo de compilación resultara
  intolerable, y dejando la guarda de ejecución obligatoria en todos los
  llamadores, no sólo en el borde HTTP.
