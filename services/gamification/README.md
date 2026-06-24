# 🎮 gamification

**Responsable:** Christian Coronel  
**Puerto:** 3007  
**Stack:** Node.js + NestJS · TypeScript · PostgreSQL · RabbitMQ

## Descripción

Módulo de educación financiera gamificado (inciso VIII del kata). Ofrece cursos que al completarse **mejoran el score crediticio** del usuario y otorgan **bonificaciones en tasas de interés**.

### Características principales

- 📚 **8 cursos** de educación financiera (ahorro, crédito, presupuesto, deuda, inversión)
- ⭐ **Sistema de XP y 10 niveles** (Novato → Gurú Financiero)
- 🏆 **10 logros/badges** desbloqueables
- 🔥 **Racha de días consecutivos** (streak)
- 📊 **Leaderboard** (tabla de clasificación)
- 💰 **Bonus de score crediticio** al completar cursos (+15 a +40 puntos)
- 📉 **Reducción de tasa de interés** (-0.25% a -1.00% por curso)
- 📡 **Emisión de evento `course.completed`** al Event Bus para que `scoring-engine` actualice el puntaje

## Flujo de gamificación

```
Usuario se inscribe → Completa lecciones → Gana XP → Sube de nivel
                                              ↓
                                     Desbloquea logros
                                              ↓
                                  Completa curso completo
                                              ↓
                                +Score bonus + Descuento tasa
                                              ↓
                              Evento course.completed → scoring-engine
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/gamification/health` | Health check |
| `GET` | `/api/v1/gamification/courses` | Catálogo de cursos |
| `GET` | `/api/v1/gamification/courses/:id` | Detalle de un curso |
| `GET` | `/api/v1/gamification/courses/category/:cat` | Filtrar por categoría |
| `GET` | `/api/v1/gamification/courses/difficulty/:dif` | Filtrar por dificultad |
| `GET` | `/api/v1/gamification/bonuses` | Resumen de bonificaciones posibles |
| `GET` | `/api/v1/gamification/profile/:userId` | Perfil gamificado del usuario |
| `POST` | `/api/v1/gamification/enroll` | Inscribir usuario a curso |
| `POST` | `/api/v1/gamification/complete-lesson` | Completar lección (core) |
| `GET` | `/api/v1/gamification/progress/:userId` | Progreso en todos los cursos |
| `GET` | `/api/v1/gamification/leaderboard` | Tabla de clasificación |

## Ejemplo — Completar lección

**Request:**
```json
POST /api/v1/gamification/complete-lesson
{
  "userId": "user-001",
  "courseId": "course-002",
  "lessonNumber": 6
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "¡Curso \"¿Qué es el Crédito?\" completado! Bonus: +20 score, -0.5% tasa",
    "xpEarned": 120,
    "newTotalXp": 470,
    "levelUp": true,
    "newLevel": 3,
    "newLevelTitle": "Estudiante",
    "achievementsUnlocked": [
      { "code": "FIRST_COURSE", "name": "Estudiante Dedicado", "xpReward": 100 }
    ],
    "courseCompleted": true,
    "scoreBonusAwarded": 20,
    "interestBonusAwarded": 0.5,
    "eventEmitted": {
      "eventType": "course.completed",
      "userId": "user-001",
      "scoreBonus": 20
    }
  }
}
```

## Tabla de niveles

| Nivel | XP Requerido | Título |
|-------|-------------|--------|
| 1 | 0 | Novato Financiero |
| 2 | 100 | Aprendiz |
| 3 | 300 | Estudiante |
| 4 | 600 | Conocedor |
| 5 | 1,000 | Intermedio |
| 6 | 1,500 | Avanzado |
| 7 | 2,200 | Especialista |
| 8 | 3,000 | Experto |
| 9 | 4,000 | Maestro |
| 10 | 5,500 | Gurú Financiero |

## Cómo correr

```bash
npm install && npm run start:dev
```

## Estructura del código

```
src/
├── main.ts                          # Bootstrap del microservicio
├── app.module.ts                    # Módulo raíz NestJS
├── gamification.controller.ts       # Controller REST (11 endpoints)
├── dto/
│   └── gamification.dto.ts          # DTOs de request/response
├── entities/
│   ├── course.entity.ts             # Entidad de curso (TypeORM)
│   ├── user-progress.entity.ts      # Progreso por curso
│   ├── user-profile.entity.ts       # Perfil gamificado (XP, nivel)
│   └── achievement.entity.ts        # Logros/badges
├── services/
│   ├── course.service.ts            # Gestión del catálogo de cursos
│   └── progress.service.ts          # XP, niveles, logros, bonus
└── mocks/
    └── gamification-mock.data.ts    # 8 cursos, 10 logros, 10 perfiles
```
