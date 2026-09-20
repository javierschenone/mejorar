# 07 — Roadmap

## Fase 0 — Base (este repositorio)

- [x] Monorepo, dominio compartido y motor de reglas legales con tests.
- [x] Modelo de datos completo (Prisma) de las tres audiencias.
- [x] API REST con autenticación, RBAC, casos, negociaciones, colectivos, pagos,
      documentos, educación y auditoría.
- [x] Portales web de cliente, abogado y administración.
- [x] App móvil del deudor (Expo).
- [x] Puertos de integración con adaptadores mock funcionales.

## Fase 1 — Piloto cerrado (mes 1-3)

- [ ] Ratificación del catálogo normativo por el estudio jurídico.
- [ ] Textos legales definitivos y circuito de consentimiento auditado.
- [ ] Integración real con BCRA y con un bureau.
- [ ] Facturación electrónica AFIP en homologación y luego producción.
- [ ] Mercado Pago en producción con suscripciones reales.
- [ ] 50 clientes piloto, 3 acreedores, 5 abogados.
- [ ] Panel de métricas del negocio y alertas operativas.

## Fase 2 — Negociación colectiva (mes 4-6)

- [ ] Motor de armado automático de colectivos por acreedor/producto/antigüedad.
- [ ] Generación de la propuesta de cartera y del *data room* para el acreedor.
- [ ] Portal del acreedor (cuarto perfil) para recibir y contraofertar carteras.
- [ ] Carta documento y Defensa del Consumidor en producción.
- [ ] Firma electrónica de convenios de punta a punta.

## Fase 3 — Escala (mes 7-12)

- [ ] Consulta judicial multi-jurisdicción y alertas de embargo.
- [ ] Scoring propio de probabilidad de acuerdo y de quita esperada por acreedor.
- [ ] Automatización de la cobranza de la comisión atada al cumplimiento.
- [ ] Programa de educación financiera con certificación y beneficios.
- [ ] Apertura a provincias con sus organismos de defensa del consumidor.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Los acreedores se niegan a negociar con un intermediario. | La carta documento y la denuncia administrativa dan piso de negociación; el colectivo da volumen. |
| Encuadre regulatorio del cobro de comisión sobre quitas. | No custodiar fondos, comisión atada a resultado verificado, topes duros, validación legal previa. |
| Dependencia de un bureau que corta el servicio. | Puertos intercambiables y BCRA como fuente primaria gratuita. |
| Reclamo de clientes por expectativas no cumplidas. | Prohibición de promesas de resultado en el copy, estimaciones rotuladas, baja inmediata. |
| Fuga de datos personales sensibles. | Cifrado en reposo, RBAC por permiso, auditoría inmutable, minimización de datos. |
