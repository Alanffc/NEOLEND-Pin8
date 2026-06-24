import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Perfil de gamificación del usuario.
 * Almacena nivel, XP, logros y bonificaciones acumuladas.
 * Se actualiza conforme el usuario completa cursos y lecciones.
 */
@Entity('user_profiles')
@Index(['userId'], { unique: true })
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** ID del usuario/solicitante (referencia a loan-application) */
  @Column({ name: 'user_id', unique: true })
  userId: string;

  /** Nombre del usuario */
  @Column({ name: 'display_name' })
  displayName: string;

  /** Nivel del usuario: 1 (Novato) → 10 (Experto Financiero) */
  @Column({ default: 1 })
  level: number;

  /** Puntos de experiencia totales */
  @Column({ name: 'total_xp', default: 0 })
  totalXp: number;

  /** XP necesarios para subir al siguiente nivel */
  @Column({ name: 'xp_to_next_level', default: 100 })
  xpToNextLevel: number;

  /** Bonus total acumulado al score crediticio */
  @Column({ name: 'total_score_bonus', default: 0 })
  totalScoreBonus: number;

  /** Bonus total acumulado en tasa de interés (puntos porcentuales) */
  @Column({ name: 'total_interest_bonus', type: 'decimal', precision: 5, scale: 2, default: 0 })
  totalInterestBonus: number;

  /** Total de cursos completados */
  @Column({ name: 'courses_completed', default: 0 })
  coursesCompleted: number;

  /** Racha de días consecutivos (streak) */
  @Column({ default: 0 })
  streak: number;

  /** IDs de logros/badges desbloqueados (JSON array) */
  @Column({ type: 'jsonb', default: '[]' })
  achievements: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'last_activity_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastActivityAt: Date;
}
