import {
  Controller, Get, Post, Body, Param, Query, HttpCode, Logger,
} from '@nestjs/common';
import { CourseService } from '../services/course.service';
import { ProgressService } from '../services/progress.service';
import { EnrollCourseDto, CompleteLessonDto } from '../dto/gamification.dto';

/**
 * Controller REST del módulo de educación financiera gamificado (inciso VIII).
 *
 * Endpoints principales:
 *   GET  /gamification/health              → Health check
 *   GET  /gamification/courses             → Catálogo de cursos
 *   GET  /gamification/courses/:id         → Detalle de un curso
 *   GET  /gamification/courses/category/:c → Cursos por categoría
 *   GET  /gamification/bonuses             → Resumen de bonificaciones
 *   GET  /gamification/profile/:userId     → Perfil de gamificación
 *   POST /gamification/enroll              → Inscribir usuario a curso
 *   POST /gamification/complete-lesson     → Completar lección
 *   GET  /gamification/progress/:userId    → Progreso del usuario
 *   GET  /gamification/leaderboard         → Tabla de clasificación
 */
@Controller('gamification')
export class GamificationController {
  private readonly logger = new Logger(GamificationController.name);

  constructor(
    private readonly courseService: CourseService,
    private readonly progressService: ProgressService,
  ) {}

  /** Health check del microservicio */
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'gamification',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  // ─── CURSOS ──────────────────────────────────────────────

  /** Obtener catálogo completo de cursos */
  @Get('courses')
  getAllCourses() {
    this.logger.log('GET /gamification/courses');
    return {
      success: true,
      data: this.courseService.getAllCourses(),
      total: this.courseService.getAllCourses().length,
    };
  }

  /** Obtener detalle de un curso */
  @Get('courses/:courseId')
  getCourseById(@Param('courseId') courseId: string) {
    this.logger.log(`GET /gamification/courses/${courseId}`);
    return {
      success: true,
      data: this.courseService.getCourseById(courseId),
    };
  }

  /** Filtrar cursos por categoría */
  @Get('courses/category/:category')
  getCoursesByCategory(@Param('category') category: string) {
    this.logger.log(`GET /gamification/courses/category/${category}`);
    return {
      success: true,
      data: this.courseService.getCoursesByCategory(category),
    };
  }

  /** Filtrar cursos por dificultad */
  @Get('courses/difficulty/:difficulty')
  getCoursesByDifficulty(@Param('difficulty') difficulty: string) {
    this.logger.log(`GET /gamification/courses/difficulty/${difficulty}`);
    return {
      success: true,
      data: this.courseService.getCoursesByDifficulty(difficulty),
    };
  }

  /** Resumen de bonificaciones totales disponibles */
  @Get('bonuses')
  getBonusesSummary() {
    this.logger.log('GET /gamification/bonuses');
    return {
      success: true,
      data: this.courseService.getTotalBonusesSummary(),
    };
  }

  // ─── PERFIL Y PROGRESO ─────────────────────────────────

  /** Obtener perfil de gamificación de un usuario */
  @Get('profile/:userId')
  getUserProfile(@Param('userId') userId: string) {
    this.logger.log(`GET /gamification/profile/${userId}`);
    return {
      success: true,
      data: this.progressService.getUserProfile(userId),
    };
  }

  /** Inscribir usuario a un curso */
  @Post('enroll')
  @HttpCode(200)
  enrollInCourse(@Body() dto: EnrollCourseDto) {
    this.logger.log(`POST /gamification/enroll — usuario: ${dto.userId}, curso: ${dto.courseId}`);
    return {
      success: true,
      message: 'Inscripción exitosa',
      data: this.progressService.enrollInCourse(dto.userId, dto.courseId),
    };
  }

  /**
   * Completar una lección — endpoint clave de la gamificación.
   * Otorga XP, puede subir de nivel, desbloquear logros y
   * si es la última lección, otorga bonus de score + tasa
   * y emite evento course.completed al Event Bus.
   */
  @Post('complete-lesson')
  @HttpCode(200)
  completeLesson(@Body() dto: CompleteLessonDto) {
    this.logger.log(`POST /gamification/complete-lesson — usuario: ${dto.userId}, curso: ${dto.courseId}, lección: ${dto.lessonNumber}`);
    return {
      success: true,
      data: this.progressService.completeLesson(dto.userId, dto.courseId, dto.lessonNumber),
    };
  }

  /** Obtener progreso de un usuario en todos sus cursos */
  @Get('progress/:userId')
  getUserProgress(@Param('userId') userId: string) {
    this.logger.log(`GET /gamification/progress/${userId}`);
    return {
      success: true,
      data: this.progressService.getAllProgress(userId),
    };
  }

  /** Tabla de clasificación (leaderboard) */
  @Get('leaderboard')
  getLeaderboard(@Query('limit') limit?: string) {
    const top = limit ? parseInt(limit, 10) : 10;
    this.logger.log(`GET /gamification/leaderboard (top ${top})`);
    return {
      success: true,
      data: this.progressService.getLeaderboard(top),
    };
  }
}
