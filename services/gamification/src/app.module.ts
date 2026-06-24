import { Module } from '@nestjs/common';
import { GamificationController } from './gamification.controller';
import { CourseService } from './services/course.service';
import { ProgressService } from './services/progress.service';
import { EventPublisherService } from './services/event-publisher.service';
import { PaymentEventConsumer } from './services/payment-event-consumer.service';

/**
 * Módulo raíz del microservicio de gamificación.
 * Registra el controller y todos los servicios:
 *   - CourseService: gestión del catálogo de cursos
 *   - ProgressService: XP, niveles, logros, bonificaciones
 *   - EventPublisherService: emite course.completed al Event Bus
 *   - PaymentEventConsumer: consume payment.received para otorgar XP
 *
 * En producción se agregaría:
 *   - TypeOrmModule.forRoot() para PostgreSQL
 *   - ClientsModule.register() para RabbitMQ
 */
@Module({
  imports: [],
  controllers: [GamificationController],
  providers: [
    CourseService,
    ProgressService,
    EventPublisherService,
    PaymentEventConsumer,
  ],
})
export class AppModule {}
