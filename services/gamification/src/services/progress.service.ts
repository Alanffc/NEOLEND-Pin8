import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  MOCK_COURSES,
  MOCK_ACHIEVEMENTS,
  LEVEL_TABLE,
  generateMockProgress,
  generateMockUserProfiles,
} from '../mocks/gamification-mock.data';
import {
  ProgressUpdateResponseDto,
  AchievementDto,
  UserProfileResponseDto,
  LeaderboardEntryDto,
  CourseProgressDto,
} from '../dto/gamification.dto';

/**
 * Servicio principal de gamificación — lógica de progreso, XP, niveles y logros.
 *
 * Funcionalidades:
 *   - Inscripción a cursos
 *   - Registro de lecciones completadas
 *   - Cálculo de XP y subida de nivel
 *   - Detección de logros desbloqueados
 *   - Emisión de evento course.completed al Event Bus
 *   - Otorgamiento de bonus de score e interés
 *   - Leaderboard (tabla de clasificación)
 *
 * Al completar un curso, emite el evento `course.completed` con el
 * scoreBonus según el contrato de events.md para que scoring-engine
 * actualice el puntaje del usuario.
 */
@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  /** Estado en memoria (mock — en producción sería PostgreSQL) */
  private userProfiles = new Map<string, any>();
  private userProgress = new Map<string, any[]>(); // userId -> progress[]

  constructor() {
    // Inicializar con datos mock
    this.initializeMockData();
  }

  private initializeMockData() {
    const profiles = generateMockUserProfiles(10);
    for (const profile of profiles) {
      this.userProfiles.set(profile.userId, profile);
      this.userProgress.set(profile.userId, generateMockProgress(profile.userId));
    }
    this.logger.log(`✅ Datos mock inicializados: ${profiles.length} perfiles, ${MOCK_COURSES.length} cursos`);
  }

  /** Obtener perfil de gamificación de un usuario */
  getUserProfile(userId: string): UserProfileResponseDto {
    this.logger.log(`Consultando perfil de gamificación: ${userId}`);

    let profile = this.userProfiles.get(userId);

    // Si no existe, crear perfil nuevo
    if (!profile) {
      profile = {
        userId,
        displayName: `Usuario ${userId}`,
        level: 1,
        totalXp: 0,
        xpToNextLevel: 100,
        totalScoreBonus: 0,
        totalInterestBonus: 0,
        coursesCompleted: 0,
        streak: 0,
        achievements: [],
        lastActivityAt: new Date(),
      };
      this.userProfiles.set(userId, profile);
      this.userProgress.set(userId, []);
    }

    const levelInfo = LEVEL_TABLE.find((l) => l.level === profile.level) || LEVEL_TABLE[0];
    const nextLevel = LEVEL_TABLE.find((l) => l.level === profile.level + 1);
    const xpProgress = nextLevel
      ? ((profile.totalXp - levelInfo.xpRequired) / (nextLevel.xpRequired - levelInfo.xpRequired)) * 100
      : 100;

    // Mapear logros
    const achievements = MOCK_ACHIEVEMENTS.map((ach) => ({
      code: ach.code,
      name: ach.name,
      description: ach.description,
      iconUrl: ach.iconUrl,
      category: ach.category,
      xpReward: ach.xpReward,
      unlocked: profile.achievements.includes(ach.code),
    }));

    return {
      userId: profile.userId,
      displayName: profile.displayName,
      level: profile.level,
      levelTitle: levelInfo.title,
      totalXp: profile.totalXp,
      xpToNextLevel: nextLevel ? nextLevel.xpRequired - profile.totalXp : 0,
      xpProgress: parseFloat(Math.min(100, xpProgress).toFixed(1)),
      totalScoreBonus: profile.totalScoreBonus,
      totalInterestBonus: profile.totalInterestBonus,
      coursesCompleted: profile.coursesCompleted,
      totalCourses: MOCK_COURSES.length,
      streak: profile.streak,
      achievements,
    };
  }

  /** Inscribir un usuario a un curso */
  enrollInCourse(userId: string, courseId: string): CourseProgressDto {
    this.logger.log(`Inscribiendo usuario ${userId} al curso ${courseId}`);

    const course = MOCK_COURSES.find((c) => c.id === courseId);
    if (!course) {
      throw new NotFoundException(`Curso ${courseId} no encontrado`);
    }

    let progress = this.userProgress.get(userId) || [];
    const existing = progress.find((p: any) => p.courseId === courseId);

    if (existing) {
      this.logger.log(`Usuario ${userId} ya está inscrito en curso ${courseId}`);
      return this.toProgressDto(existing);
    }

    const newProgress = {
      id: `progress-${userId}-${courseId}`,
      userId,
      courseId,
      lessonsCompleted: 0,
      totalLessons: course.totalLessons,
      progressPercentage: 0,
      quizScore: 0,
      status: 'en_progreso',
      completedAt: null,
      bonusAwarded: false,
    };

    progress.push(newProgress);
    this.userProgress.set(userId, progress);

    return this.toProgressDto(newProgress);
  }

  /** Completar una lección de un curso */
  completeLesson(userId: string, courseId: string, lessonNumber: number): ProgressUpdateResponseDto {
    this.logger.log(`Usuario ${userId} completó lección ${lessonNumber} del curso ${courseId}`);

    const course = MOCK_COURSES.find((c) => c.id === courseId);
    if (!course) {
      throw new NotFoundException(`Curso ${courseId} no encontrado`);
    }

    const progress = this.getUserProgress(userId, courseId);

    if (lessonNumber > course.totalLessons) {
      throw new BadRequestException(`El curso solo tiene ${course.totalLessons} lecciones`);
    }

    if (progress.status === 'completado') {
      throw new BadRequestException('El curso ya fue completado');
    }

    // Actualizar progreso
    progress.lessonsCompleted = Math.max(progress.lessonsCompleted, lessonNumber);
    progress.progressPercentage = parseFloat(
      ((progress.lessonsCompleted / course.totalLessons) * 100).toFixed(2),
    );

    // XP por lección completada
    const xpPerLesson = 20;
    let xpEarned = xpPerLesson;
    const achievementsUnlocked: AchievementDto[] = [];
    let courseCompleted = false;
    let scoreBonusAwarded: number | undefined;
    let interestBonusAwarded: number | undefined;
    let eventEmitted: any;

    // ¿Se completó el curso?
    if (progress.lessonsCompleted >= course.totalLessons) {
      progress.status = 'completado';
      progress.completedAt = new Date();
      courseCompleted = true;

      // Bonus por completar curso
      xpEarned += course.scoreBonus * 5; // XP extra

      // Otorgar bonificaciones
      if (!progress.bonusAwarded) {
        progress.bonusAwarded = true;
        scoreBonusAwarded = course.scoreBonus;
        interestBonusAwarded = course.interestRateBonus;

        const profile = this.userProfiles.get(userId);
        if (profile) {
          profile.totalScoreBonus += course.scoreBonus;
          profile.totalInterestBonus = parseFloat(
            (profile.totalInterestBonus + course.interestRateBonus).toFixed(2),
          );
          profile.coursesCompleted += 1;
        }

        // Emitir evento course.completed según contrato events.md
        eventEmitted = {
          eventType: 'course.completed',
          userId,
          scoreBonus: course.scoreBonus,
        };
        this.logger.log(`📡 Evento emitido: course.completed | userId: ${userId} | scoreBonus: +${course.scoreBonus}`);
      }
    }

    // Actualizar XP y nivel
    const profile = this.userProfiles.get(userId)!;
    profile.totalXp += xpEarned;
    profile.lastActivityAt = new Date();

    // Verificar subida de nivel
    const { levelUp, newLevel, newLevelTitle } = this.checkLevelUp(profile);
    if (levelUp) {
      this.logger.log(`🎉 ¡Subida de nivel! ${userId}: ${newLevel} (${newLevelTitle})`);
    }

    // Verificar logros desbloqueados
    const newAchievements = this.checkAchievements(profile, progress);
    achievementsUnlocked.push(...newAchievements);
    for (const ach of newAchievements) {
      profile.totalXp += ach.xpReward;
      this.logger.log(`🏆 Logro desbloqueado: ${ach.name} (+${ach.xpReward} XP)`);
    }

    return {
      success: true,
      message: courseCompleted
        ? `¡Curso "${course.title}" completado! Bonus: +${course.scoreBonus} score, -${course.interestRateBonus}% tasa`
        : `Lección ${lessonNumber} completada. Progreso: ${progress.progressPercentage}%`,
      xpEarned,
      newTotalXp: profile.totalXp,
      levelUp,
      newLevel: levelUp ? newLevel : undefined,
      newLevelTitle: levelUp ? newLevelTitle : undefined,
      achievementsUnlocked,
      courseCompleted,
      scoreBonusAwarded,
      interestBonusAwarded,
      eventEmitted,
    };
  }

  /** Obtener progreso de un usuario en todos sus cursos */
  getAllProgress(userId: string): CourseProgressDto[] {
    const progress = this.userProgress.get(userId) || [];
    return progress.map((p: any) => this.toProgressDto(p));
  }

  /** Obtener leaderboard (tabla de clasificación) */
  getLeaderboard(limit: number = 10): LeaderboardEntryDto[] {
    this.logger.log(`Generando leaderboard (top ${limit})`);

    const profiles = Array.from(this.userProfiles.values());
    return profiles
      .sort((a, b) => b.totalXp - a.totalXp)
      .slice(0, limit)
      .map((profile, idx) => {
        const levelInfo = LEVEL_TABLE.find((l) => l.level === profile.level) || LEVEL_TABLE[0];
        return {
          rank: idx + 1,
          userId: profile.userId,
          displayName: profile.displayName,
          level: profile.level,
          levelTitle: levelInfo.title,
          totalXp: profile.totalXp,
          coursesCompleted: profile.coursesCompleted,
          streak: profile.streak,
        };
      });
  }

  // ─── Helpers privados ─────────────────────────────────────

  private getUserProgress(userId: string, courseId: string): any {
    const progress = this.userProgress.get(userId) || [];
    let courseProgress = progress.find((p: any) => p.courseId === courseId);

    if (!courseProgress) {
      // Auto-inscribir
      const course = MOCK_COURSES.find((c) => c.id === courseId);
      courseProgress = {
        userId,
        courseId,
        lessonsCompleted: 0,
        totalLessons: course?.totalLessons || 5,
        progressPercentage: 0,
        quizScore: 0,
        status: 'en_progreso',
        completedAt: null,
        bonusAwarded: false,
      };
      progress.push(courseProgress);
      this.userProgress.set(userId, progress);
    }

    return courseProgress;
  }

  private checkLevelUp(profile: any): { levelUp: boolean; newLevel?: number; newLevelTitle?: string } {
    const nextLevel = LEVEL_TABLE.find((l) => l.level === profile.level + 1);
    if (nextLevel && profile.totalXp >= nextLevel.xpRequired) {
      profile.level = nextLevel.level;
      profile.xpToNextLevel = LEVEL_TABLE.find((l) => l.level === nextLevel.level + 1)?.xpRequired || 99999;
      return { levelUp: true, newLevel: nextLevel.level, newLevelTitle: nextLevel.title };
    }
    return { levelUp: false };
  }

  private checkAchievements(profile: any, progress: any): AchievementDto[] {
    const unlocked: AchievementDto[] = [];

    for (const ach of MOCK_ACHIEVEMENTS) {
      if (profile.achievements.includes(ach.code)) continue;

      let shouldUnlock = false;
      const cond = ach.condition;

      if (cond.lessonsCompleted && progress.lessonsCompleted >= cond.lessonsCompleted) shouldUnlock = true;
      if (cond.coursesCompleted && profile.coursesCompleted >= cond.coursesCompleted) shouldUnlock = true;
      if (cond.streak && profile.streak >= cond.streak) shouldUnlock = true;
      if (cond.quizScore && progress.quizScore >= cond.quizScore) shouldUnlock = true;
      if (cond.level && profile.level >= cond.level) shouldUnlock = true;

      if (shouldUnlock) {
        profile.achievements.push(ach.code);
        unlocked.push({
          code: ach.code,
          name: ach.name,
          description: ach.description,
          iconUrl: ach.iconUrl,
          category: ach.category,
          xpReward: ach.xpReward,
          unlocked: true,
          unlockedAt: new Date(),
        });
      }
    }

    return unlocked;
  }

  private toProgressDto(progress: any): CourseProgressDto {
    return {
      lessonsCompleted: progress.lessonsCompleted,
      totalLessons: progress.totalLessons,
      progressPercentage: progress.progressPercentage,
      quizScore: progress.quizScore,
      status: progress.status,
      completedAt: progress.completedAt,
      bonusAwarded: progress.bonusAwarded,
    };
  }
}
