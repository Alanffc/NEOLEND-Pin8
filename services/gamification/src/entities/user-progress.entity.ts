import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Progreso de un usuario en un curso específico.
 * Rastrea lecciones completadas, quizzes aprobados y estado general.
 */
@Entity('user_progress')
@Index(['userId', 'courseId'], { unique: true })
export class UserProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** ID del usuario/solicitante */
  @Column({ name: 'user_id' })
  userId: string;

  /** ID del curso */
  @Column({ name: 'course_id' })
  courseId: string;

  /** Número de lecciones completadas */
  @Column({ name: 'lessons_completed', default: 0 })
  lessonsCompleted: number;

  /** Total de lecciones del curso (desnormalizado para consultas rápidas) */
  @Column({ name: 'total_lessons', default: 5 })
  totalLessons: number;

  /** Porcentaje de progreso (0-100) */
  @Column({ name: 'progress_percentage', type: 'decimal', precision: 5, scale: 2, default: 0 })
  progressPercentage: number;

  /** Puntaje obtenido en quizzes (0-100) */
  @Column({ name: 'quiz_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  quizScore: number;

  /** Estado: 'no_iniciado', 'en_progreso', 'completado' */
  @Column({ default: 'no_iniciado' })
  status: string;

  /** Fecha en que completó el curso (null si no ha completado) */
  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  /** Si ya se otorgó la bonificación de score */
  @Column({ name: 'bonus_awarded', default: false })
  bonusAwarded: boolean;

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;
}
