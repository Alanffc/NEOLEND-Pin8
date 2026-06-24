import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MOCK_COURSES } from '../mocks/gamification-mock.data';
import { CourseResponseDto } from '../dto/gamification.dto';

/**
 * Servicio para gestión del catálogo de cursos de educación financiera.
 * Administra la consulta y filtrado de cursos disponibles.
 *
 * Cursos cubren: ahorro, crédito, presupuesto, deuda, inversión.
 * Cada curso otorga bonus de score y reducción de tasa de interés.
 */
@Injectable()
export class CourseService {
  private readonly logger = new Logger(CourseService.name);

  /** Obtener todos los cursos activos */
  getAllCourses(): CourseResponseDto[] {
    this.logger.log('Consultando catálogo completo de cursos');
    return MOCK_COURSES
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => this.toCourseResponse(c));
  }

  /** Obtener un curso por ID */
  getCourseById(courseId: string): CourseResponseDto {
    this.logger.log(`Buscando curso: ${courseId}`);
    const course = MOCK_COURSES.find((c) => c.id === courseId);
    if (!course) {
      throw new NotFoundException(`Curso ${courseId} no encontrado`);
    }
    return this.toCourseResponse(course);
  }

  /** Filtrar cursos por categoría */
  getCoursesByCategory(category: string): CourseResponseDto[] {
    this.logger.log(`Filtrando cursos por categoría: ${category}`);
    return MOCK_COURSES
      .filter((c) => c.isActive && c.category === category)
      .map((c) => this.toCourseResponse(c));
  }

  /** Filtrar cursos por dificultad */
  getCoursesByDifficulty(difficulty: string): CourseResponseDto[] {
    this.logger.log(`Filtrando cursos por dificultad: ${difficulty}`);
    return MOCK_COURSES
      .filter((c) => c.isActive && c.difficulty === difficulty)
      .map((c) => this.toCourseResponse(c));
  }

  /** Obtener resumen de bonificaciones totales posibles */
  getTotalBonusesSummary() {
    const activeCourses = MOCK_COURSES.filter((c) => c.isActive);
    return {
      totalCourses: activeCourses.length,
      maxScoreBonus: activeCourses.reduce((sum, c) => sum + c.scoreBonus, 0),
      maxInterestRateBonus: parseFloat(
        activeCourses.reduce((sum, c) => sum + c.interestRateBonus, 0).toFixed(2),
      ),
      totalLessons: activeCourses.reduce((sum, c) => sum + c.totalLessons, 0),
      totalDurationMinutes: activeCourses.reduce((sum, c) => sum + c.durationMinutes, 0),
      categories: [...new Set(activeCourses.map((c) => c.category))],
    };
  }

  private toCourseResponse(course: any): CourseResponseDto {
    return {
      id: course.id,
      title: course.title,
      description: course.description,
      category: course.category,
      difficulty: course.difficulty,
      scoreBonus: course.scoreBonus,
      interestRateBonus: course.interestRateBonus,
      totalLessons: course.totalLessons,
      durationMinutes: course.durationMinutes,
      iconUrl: course.iconUrl,
    };
  }
}
