import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Curso de educación financiera.
 * El módulo gamificado ofrece cursos que al completarse mejoran el score crediticio
 * del usuario y otorgan bonificaciones en tasas de interés (inciso VIII).
 */
@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Título del curso */
  @Column()
  title: string;

  /** Descripción del curso */
  @Column({ type: 'text' })
  description: string;

  /** Categoría: 'ahorro', 'credito', 'inversion', 'presupuesto', 'deuda' */
  @Column()
  category: string;

  /** Nivel de dificultad: 'basico', 'intermedio', 'avanzado' */
  @Column({ default: 'basico' })
  difficulty: string;

  /** Puntos de score que otorga al completarse */
  @Column({ name: 'score_bonus', default: 10 })
  scoreBonus: number;

  /** Bonificación en tasa de interés (puntos porcentuales de descuento) */
  @Column({ name: 'interest_rate_bonus', type: 'decimal', precision: 4, scale: 2, default: 0 })
  interestRateBonus: number;

  /** Número de lecciones del curso */
  @Column({ name: 'total_lessons', default: 5 })
  totalLessons: number;

  /** Duración estimada en minutos */
  @Column({ name: 'duration_minutes', default: 30 })
  durationMinutes: number;

  /** URL del ícono del curso */
  @Column({ name: 'icon_url', nullable: true })
  iconUrl: string;

  /** Si el curso está activo */
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** Orden de visualización */
  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
