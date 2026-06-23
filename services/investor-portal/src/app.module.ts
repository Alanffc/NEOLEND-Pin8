import { Module } from '@nestjs/common';
import { InvestorController } from './investor.controller';
import { PortfolioService } from './services/portfolio.service';
import { EventConsumerService } from './services/event-consumer.service';
import { FinancialCalculationService } from './services/financial-calculation.service';

/**
 * Módulo raíz del microservicio investor-portal.
 * Registra el controller y los servicios de portafolio y consumo de eventos.
 */
@Module({
  imports: [],
  controllers: [InvestorController],
  providers: [
      PortfolioService, 
      EventConsumerService,
      FinancialCalculationService
  ],
})
export class AppModule {}
