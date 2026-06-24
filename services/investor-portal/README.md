# 📊 investor-portal

**Responsable:** Christian Coronel  
**Puerto:** 3006  
**Stack:** Node.js + NestJS · TypeScript · PostgreSQL (read model) · RabbitMQ

## Descripción

Portal de inversionistas en tiempo real que expone métricas de la cartera de créditos (inciso VI del kata). Los ~50 fondos institucionales pueden monitorear en tiempo real:

- **TIR** (Tasa Interna de Retorno) anualizada
- **Morosidad por segmento** (micro, pequeño, mediano, grande)
- **Flujo de caja proyectado** a 30, 60 y 90 días
- **Exposición al riesgo** (monto total en créditos de alto riesgo)
- **Distribución de créditos** por estado (activo, pagado, en mora, reestructurado)
- **Métricas históricas** de los últimos 12 meses

## Arquitectura

El servicio opera como **read model** (patrón CQRS). Consume eventos del Event Bus (RabbitMQ) con los routing keys:
- `credit.approved` → Nuevo crédito en el portafolio
- `disbursement.completed` → Desembolso realizado
- `payment.received` → Pago recibido del deudor
- `payment.overdue` → Mora detectada

Implementa **idempotencia** por `eventId` y **trazabilidad** con `correlationId` según el contrato de `shared/events/events.md`.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/investor/health` | Health check del servicio |
| `GET` | `/api/v1/investor/funds` | Lista de fondos inversionistas |
| `GET` | `/api/v1/investor/dashboard/:fundId` | Dashboard completo (todas las métricas) |
| `GET` | `/api/v1/investor/portfolio/:fundId` | Resumen del portafolio (TIR, riesgo) |
| `GET` | `/api/v1/investor/delinquency/:fundId` | Morosidad por segmento |
| `GET` | `/api/v1/investor/cashflow/:fundId` | Proyecciones de flujo de caja |
| `GET` | `/api/v1/investor/history` | Métricas históricas (12 meses) |
| `GET` | `/api/v1/investor/distribution/:fundId` | Distribución de créditos por estado |
| `POST` | `/api/v1/investor/events` | Webhook para recibir eventos del bus |
| `GET` | `/api/v1/investor/events/stats` | Estadísticas de eventos procesados |

## Ejemplo de respuesta — Dashboard

```json
{
  "success": true,
  "data": {
    "portfolio": {
      "fundId": "fund-latam-growth-001",
      "fundName": "LatAm Growth Capital Fund",
      "tir": 16.7534,
      "totalCredits": 472,
      "totalDisbursed": 2312450.50,
      "totalCollected": 1896210.40,
      "delinquencyRate": 5.82,
      "projectedCashFlow30d": 277494.06,
      "projectedCashFlow90d": 809357.68,
      "riskExposure": 231245.05,
      "riskRatio": 10.00
    },
    "delinquencyBySegment": [...],
    "cashFlowProjections": [...],
    "historicalMetrics": [...],
    "creditDistribution": [...]
  }
}
```

## Cómo correr

```bash
npm install && npm run start:dev
```

## Estructura del código

```
src/
├── main.ts                          # Bootstrap del microservicio
├── app.module.ts                    # Módulo raíz NestJS
├── investor.controller.ts           # Controller REST (10 endpoints)
├── dto/
│   ├── dashboard-response.dto.ts    # DTOs de respuesta
│   └── event-envelope.dto.ts        # Contrato de eventos del bus
├── entities/
│   ├── portfolio-snapshot.entity.ts # Snapshot del portafolio (TypeORM)
│   ├── credit-event.entity.ts       # Eventos de crédito recibidos
│   └── delinquency-by-segment.entity.ts
├── services/
│   ├── portfolio.service.ts         # Lógica de cálculo de métricas
│   └── event-consumer.service.ts    # Consumer del Event Bus
└── mocks/
    └── portfolio-mock.data.ts       # Datos mock (5 fondos, 4 tipos de evento)
```
