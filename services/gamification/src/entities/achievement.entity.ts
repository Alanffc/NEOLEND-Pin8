import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Definición de logros/badges del sistema de gamificación.
 * Los logros se desbloquean al cumplir condiciones específicas.
 */
@Entity('achievements')
export class Achievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Código único del logro */
  @Column({ unique: true })
  code: string;

  /** Nombre del logro */
  @Column()
  name: string;

  /** Descripción del logro */
  @Column({ type: 'text' })
  description: string;

  /** URL del ícono/badge */
  @Column({ name: 'icon_url', nullable: true })
  iconUrl: string;

  /** Categoría: 'aprendizaje', 'racha', 'pago', 'social' */
  @Column()
  category: string;

  /** XP que otorga al desbloquearse */
  @Column({ name: 'xp_reward', default: 50 })
  xpReward: number;

  /** Condición para desbloquear (JSON con reglas) */
  @Column({ type: 'jsonb', default: '{}' })
  condition: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
