# 🏦 NeoLend Financial Corp. — Plataforma FinTech de Crédito Digital

Hackatón Final — Arquitectura de Software (16/06/2026)

Plataforma de crédito digital que evalúa riesgo crediticio con **fuentes de datos
alternativas** (servicios públicos, e-commerce, recargas móviles, billeteras),
otorga créditos en minutos y gestiona la cartera en tiempo real.

## 🏗️ Arquitectura

Microservicios (cada uno con su **propia base de datos**), comunicados por un
**API Gateway** y un **Event Bus** (RabbitMQ). El servicio de créditos usa
**CQRS + Event Sourcing**. El motor de scoring soporta **blue/green del modelo ML**.

```
                          ┌──────────────────┐
   App móvil / Portal ───▶│   API GATEWAY     │  (auth, routing, rate-limit)
                          └────────┬──────────┘
        ┌──────────┬──────────┬────┴─────┬───────────┬──────────┐
        ▼          ▼          ▼          ▼           ▼          ▼
   loan-app    scoring    credit-ledger  disburse  collections  fraud
   (Node)      (Python)   (Node,CQRS+ES) (Node)    (Node)       (Python)
                  │
            bureau-adapter (Node)  ── Circuit Breaker + caché ──▶ Buró SOAP legacy

   investor-portal (Node)   gamification (Node)   audit-trail (Node, ES + firma digital)
                              │
                       Event Bus (RabbitMQ) ── conecta todos los servicios
```

## 👥 Equipo y responsabilidades

| Persona | Microservicios | MVP | Docs |
|---|---|---|---|
| **Juan José Cordeiro** (líder/arquitecto) | `api-gateway`, `credit-ledger` (CQRS+ES), `audit-trail` (firma digital) | **MVP 4 (100%)** + integración | Esquema Event Sourcing |
| **Alan Flores** | `scoring-engine` (ML+SHAP, blue/green) | MVP 1 | Flujo pipeline scoring |
| **Marvin Mollo** | `loan-application`, `bureau-adapter` (circuit breaker) | MVP 1 | Estrategia Circuit Breaker |
| **Leonardo Delgado** | `disbursement`, `collections` | MVP 2 (70%) | — |
| **Christian Coronel** | `investor-portal`, `gamification` | MVP 3 (80%) | — |
| **Sergio Arias** | `fraud-detection` | MVP 3 (80%) | C4, despliegue activo-activo, ADRs, carátula |

## 🚀 Cómo levantar todo

```bash
cd infra/docker
docker compose up --build
```

Gateway expuesto en `http://localhost:8080`. Cada servicio documenta sus endpoints
en su propio `README.md`.

## 📦 Microservicios

| Servicio | Puerto | Stack | BD | Responsable |
|---|---|---|---|---|
| api-gateway | 8080 | Node/NestJS | — | Juan José |
| loan-application | 3001 | Node/NestJS | PostgreSQL | Marvin |
| scoring-engine | 8001 | Python/FastAPI | PostgreSQL + model store | Alan |
| bureau-adapter | 3002 | Node/NestJS | Redis (caché) | Marvin |
| credit-ledger | 3003 | Node/NestJS | PostgreSQL (Event Store) | Juan José |
| disbursement | 3004 | Node/NestJS | PostgreSQL | Leonardo |
| collections | 3005 | Node/NestJS | PostgreSQL | Leonardo |
| investor-portal | 3006 | Node/NestJS | PostgreSQL (read model) | Christian |
| gamification | 3007 | Node/NestJS | PostgreSQL | Christian |
| fraud-detection | 8002 | Python/FastAPI | PostgreSQL (on-prem, data residency) | Sergio |
| audit-trail | 3008 | Node/NestJS | PostgreSQL (Event Store, append-only) | Juan José |

## 📐 Requisitos transversales

- **Microservicios** con BD propia ✔
- **CQRS + Event Sourcing** en `credit-ledger` y `audit-trail` ✔
- **Blue/green del modelo ML** en `scoring-engine` ✔
- **Circuit Breaker + caché** en `bureau-adapter` ✔
- **SHAP** explicable + auditoría de sesgo ✔
- **AES-256**, logs inmutables 10 años, firma digital ✔
- **Activo-activo** 2 regiones (ver `docs/deployment`) ✔

Ver `docs/` para C4, ADRs, esquema de Event Sourcing y diagrama de despliegue.
