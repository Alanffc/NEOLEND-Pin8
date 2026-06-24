import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

/**
 * Servicio de publicación de eventos al Event Bus (RabbitMQ).
 * Emite el evento `course.completed` según el contrato de events.md
 * cuando un usuario completa un curso de educación financiera.
 *
 * Este evento es consumido por:
 *   - scoring-engine: para actualizar el puntaje del usuario
 *   - credit-ledger: para registrar la bonificación
 *
 * NOTA: En este MVP se mockea la conexión a RabbitMQ.
 * En producción se usaría amqplib o @nestjs/microservices.
 */
@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  /** Registro de eventos emitidos (para testing y auditoría) */
  private emittedEvents: any[] = [];

  /**
   * Emitir evento course.completed al Event Bus.
   * Estructura según el envelope definido en shared/events/events.md:
   *   routing key: course.completed
   *   producer: gamification
   *   consumers: scoring, credit-ledger
   */
  async publishCourseCompleted(
    userId: string,
    courseId: string,
    scoreBonus: number,
    courseTitle: string,
  ): Promise<any> {
    const event = {
      eventId: uuidv4(),
      eventType: 'course.completed',
      aggregateId: userId,
      aggregateType: 'User',
      version: 1,
      occurredAt: new Date().toISOString(),
      producer: 'gamification',
      payload: {
        userId,
        courseId,
        courseTitle,
        scoreBonus,
        completedAt: new Date().toISOString(),
      },
      metadata: {
        correlationId: uuidv4(),
        causationId: uuidv4(),
      },
    };

    this.logger.log(`📡 Publicando evento: course.completed`);
    this.logger.log(`   → userId: ${userId}`);
    this.logger.log(`   → courseId: ${courseId}`);
    this.logger.log(`   → scoreBonus: +${scoreBonus}`);
    this.logger.log(`   → eventId: ${event.eventId}`);
    this.logger.log(`   → correlationId: ${event.metadata.correlationId}`);

    // En producción:
    // const channel = await this.getChannel();
    // channel.publish(
    //   'neolend.events',
    //   'course.completed',
    //   Buffer.from(JSON.stringify(event)),
    //   { persistent: true }
    // );

    // Mock: almacenar en memoria
    this.emittedEvents.push(event);

    this.logger.log(`✅ Evento course.completed publicado exitosamente (modo mock)`);
    return event;
  }

  /** Obtener historial de eventos emitidos (debug) */
  getEmittedEvents() {
    return {
      total: this.emittedEvents.length,
      events: this.emittedEvents,
    };
  }
}
