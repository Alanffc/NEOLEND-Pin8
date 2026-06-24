# NeoLend Financial Corp. — Plataforma FinTech de Crédito Digital

Hackatón Final — Arquitectura de Software (16/06/2026)

Plataforma de crédito digital que evalúa el riesgo crediticio mediante fuentes de
datos alternativas (comportamiento de pago de servicios públicos, actividad en
e-commerce, recargas móviles, billeteras digitales), otorga créditos en minutos
y gestiona la cartera de préstamos en tiempo real.

## Arquitectura

Sistema basado en microservicios; cada servicio gestiona su propia base de datos.
La comunicación se realiza a través de un API Gateway (entrada única) y un Event
Bus (RabbitMQ) para los eventos de dominio. El servicio de créditos implementa
CQRS + Event Sourcing y el motor de scoring soporta despliegue blue/green del
modelo de Machine Learning.

```
                          +------------------+
   App movil / Portal --->|   API GATEWAY     |  (routing, correlation-id)
                          +--------+----------+
        +----------+----------+----+-----+-----------+----------+
        v          v          v          v           v          v
   loan-app    scoring    credit-ledger  disburse  collections  fraud
   (Node)      (Python)   (Node,CQRS+ES) (Node)    (Node)       (Python)
                  |
            bureau-adapter (Node)  -- Circuit Breaker + cache --> Buro SOAP legacy

   investor-portal (Node)   gamification (Node)   audit-trail (Node, ES + firma digital)
                              |
                       Event Bus (RabbitMQ) -- conecta todos los servicios
```

## Equipo y responsabilidades

| Persona | Microservicios | MVP | Documentación |
|---|---|---|---|
| Juan José Cordeiro (líder / arquitecto) | api-gateway, credit-ledger (CQRS+ES), audit-trail (firma digital) | MVP 4 (100%) + integración | Esquema de Event Sourcing |
| Alan Flores | scoring-engine (ML + SHAP, blue/green) | MVP 1 | Flujo del pipeline de scoring |
| Marvin Mollo | loan-application, bureau-adapter (circuit breaker) | MVP 1 | Estrategia de Circuit Breaker |
| Leonardo Delgado | disbursement, collections | MVP 2 (70%) | — |
| Christian Coronel | investor-portal, gamification | MVP 3 (80%) | — |
| Sergio Arias | fraud-detection | MVP 3 (80%) | C4, despliegue activo-activo, ADRs, carátula |

## Cómo levantar el sistema

Requisitos: Docker Desktop en ejecución.

```bash
cd infra/docker
docker compose up --build
```

El API Gateway queda expuesto en `http://localhost:8080`. Cada servicio documenta
sus endpoints en su propio `README.md`.

## Microservicios

| Servicio | Puerto | Stack | Base de datos | Responsable |
|---|---|---|---|---|
| api-gateway | 8080 | Node / Express | — | Juan José |
| loan-application | 3001 | Node / NestJS | PostgreSQL | Marvin |
| scoring-engine | 8001 | Python / FastAPI | PostgreSQL + model store | Alan |
| bureau-adapter | 3002 | Node / NestJS | Redis (caché) | Marvin |
| credit-ledger | 3003 | Node / NestJS | PostgreSQL (Event Store) | Juan José |
| disbursement | 3004 | Node / Express | PostgreSQL | Leonardo |
| collections | 3005 | Node / Express | PostgreSQL | Leonardo |
| investor-portal | 3006 | Node / NestJS | PostgreSQL (read model) | Christian |
| gamification | 3007 | Node / NestJS | PostgreSQL | Christian |
| fraud-detection | 8002 | Python / FastAPI | PostgreSQL (on-prem, data residency) | Sergio |
| audit-trail | 3008 | Node / NestJS | PostgreSQL (Event Store, append-only) | Juan José |

## MVPs

| N° | Alcance | Ponderación |
|---|---|---|
| 1 | Solicitud de crédito, motor de scoring con fuentes alternativas y aprobación automática | 60% |
| 2 | Desembolso multicanal e integración con billeteras/corresponsales, y módulo de cobranza | 70% |
| 3 | Portal de inversionistas en tiempo real, detección de fraude y módulo gamificado | 80% |
| 4 | Trazabilidad auditada de decisiones de scoring con firma digital para la Superintendencia | 100% |

## Requisitos transversales

- Microservicios con base de datos propia.
- CQRS + Event Sourcing en `credit-ledger` y `audit-trail`.
- Despliegue blue/green del modelo de ML en `scoring-engine`.
- Circuit Breaker + caché en `bureau-adapter` para el buró de crédito SOAP legacy.
- Scoring explicable con SHAP y auditoría de sesgo demográfico.
- Cifrado AES-256, logs inmutables auditables por 10 años y firma digital de decisiones.
- Operación activo-activo en dos regiones geográficas (ver `docs/deployment`).

## Documentación

La carpeta `docs/` contiene los diagramas C4, los ADRs, el esquema de Event
Sourcing, el diagrama de despliegue activo-activo, la estrategia de Circuit
Breaker y las evidencias de los MVPs.
