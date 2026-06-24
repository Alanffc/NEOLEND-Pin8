/**
 * DTOs del módulo de gamificación.
 * Contratos de entrada y salida de la API REST.
 */

// ─── Request DTOs ──────────────────────────────────────────

/** Inscribir un usuario a un curso */
export class EnrollCourseDto {
  userId: string;
  courseId: string;
}

/** Completar una lección */
export class CompleteLessonDto {
  userId: string;
  courseId: string;
  lessonNumber: number;
}

/** Enviar respuestas de un quiz */
export class SubmitQuizDto {
  userId: string;
  courseId: string;
  answers: { questionId: string; answer: string }[];
  score: number;
}

// ─── Response DTOs ──────────────────────────────────────────

/** Respuesta del perfil de gamificación */
export class UserProfileResponseDto {
  userId: string;
  displayName: string;
  level: number;
  levelTitle: string;
  totalXp: number;
  xpToNextLevel: number;
  xpProgress: number; // porcentaje 0-100
  totalScoreBonus: number;
  totalInterestBonus: number;
  coursesCompleted: number;
  totalCourses: number;
  streak: number;
  achievements: AchievementDto[];
}

/** Respuesta de un logro */
export class AchievementDto {
  code: string;
  name: string;
  description: string;
  iconUrl: string;
  category: string;
  xpReward: number;
  unlocked: boolean;
  unlockedAt?: Date;
}

/** Respuesta del catálogo de cursos */
export class CourseResponseDto {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  scoreBonus: number;
  interestRateBonus: number;
  totalLessons: number;
  durationMinutes: number;
  iconUrl: string;
  /** Progreso del usuario actual (si se consulta con userId) */
  userProgress?: CourseProgressDto;
}

/** Progreso en un curso */
export class CourseProgressDto {
  lessonsCompleted: number;
  totalLessons: number;
  progressPercentage: number;
  quizScore: number;
  status: string;
  completedAt?: Date;
  bonusAwarded: boolean;
}

/** Respuesta al completar lección/curso */
export class ProgressUpdateResponseDto {
  success: boolean;
  message: string;
  xpEarned: number;
  newTotalXp: number;
  levelUp: boolean;
  newLevel?: number;
  newLevelTitle?: string;
  achievementsUnlocked: AchievementDto[];
  courseCompleted: boolean;
  scoreBonusAwarded?: number;
  interestBonusAwarded?: number;
  /** Evento emitido al Event Bus (course.completed) */
  eventEmitted?: {
    eventType: string;
    userId: string;
    scoreBonus: number;
  };
}

/** Tabla de clasificación (leaderboard) */
export class LeaderboardEntryDto {
  rank: number;
  userId: string;
  displayName: string;
  level: number;
  levelTitle: string;
  totalXp: number;
  coursesCompleted: number;
  streak: number;
}
