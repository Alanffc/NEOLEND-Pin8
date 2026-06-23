import { Module } from '@nestjs/common';
import { InvestorController } from './investor.controller';
import { PortfolioService } from './services/portfolio.service';
import { EventConsumerService } from './services/event-consumer.service';

/**
 * Módulo raíz del microservicio investor-portal.
 * Registra el controller y los servicios de portafolio y consumo de eventos.
 *
 * En producción se agregaría:
 *   - TypeOrmModule.forRoot() para PostgreSQL (read model)
 *   - ClientsModule.register() para RabbitMQ (Event Bus)
 */
@Module({
  imports: [
    // TypeOrmModule.forRoot({
    //   type: 'postgres',
    //   url: process.env.DATABASE_URL,
    //   entities: [PortfolioSnapshot, CreditEvent, DelinquencyBySegment],
    //   synchronize: true, // solo en desarrollo
    // }),
  ],
  controllers: [InvestorController],
  providers: [PortfolioService, EventConsumerService],
})
export class AppModule {}
