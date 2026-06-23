import { Module } from '@nestjs/common';
import { GamificationController } from './gamification.controller';
import { CourseService } from './services/course.service';
import { ProgressService } from './services/progress.service';

/**
 * Módulo raíz del microservicio de gamificación.
 * Registra el controller y los servicios de cursos y progreso.
 *
 * En producción se agregaría:
 *   - TypeOrmModule.forRoot() para PostgreSQL
 *   - ClientsModule.register() para RabbitMQ (emitir course.completed)
 */
@Module({
  imports: [
    // TypeOrmModule.forRoot({
    //   type: 'postgres',
    //   url: process.env.DATABASE_URL,
    //   entities: [Course, UserProgress, UserProfile, Achievement],
    //   synchronize: true,
    // }),
  ],
  controllers: [GamificationController],
  providers: [CourseService, ProgressService],
})
export class AppModule {}
