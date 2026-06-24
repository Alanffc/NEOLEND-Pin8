import { Controller, Get, Param, Post, Body, Query, HttpCode, Logger } from '@nestjs/common';
import { PortfolioService } from '../services/portfolio.service';
import { EventConsumerService } from '../services/event-consumer.service';
import { EventEnvelope } from '../dto/event-envelope.dto';

/**
 * Controller REST del Portal de Inversionistas.
 * Expone las métricas de cartera en tiempo real (inciso VI del kata):
 *   - TIR (Tasa Interna de Retorno)
 *   - Morosidad por segmento
 *   - Flujo de caja proyectado
 *   - Exposición al riesgo
 *
 * Endpoints principales:
 *   GET  /investor/health         → Health check
 *   GET  /investor/funds          → Lista de fondos
 *   GET  /investor/dashboard/:id  → Dashboard completo de un fondo
 *   GET  /investor/portfolio/:id  → Resumen del portafolio
 *   GET  /investor/delinquency/:id → Morosidad por segmento
 *   GET  /investor/cashflow/:id   → Proyecciones de flujo de caja
 *   GET  /investor/history        → Métricas históricas (12 meses)
 *   POST /investor/events         → Recibir eventos del Event Bus (webhook)
 *   GET  /investor/events/stats   → Estadísticas de eventos procesados
 */
@Controller('investor')
export class InvestorController {
  private readonly logger = new Logger(InvestorController.name);

  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly eventConsumerService: EventConsumerService,
  ) {}

  /** Health check del microservicio */
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'investor-portal',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  /** Obtener lista de fondos inversionistas disponibles */
  @Get('funds')
  getFunds() {
    this.logger.log('GET /investor/funds');
    return {
      success: true,
      data: this.portfolioService.getFunds(),
      total: this.portfolioService.getFunds().length,
    };
  }

  /**
   * Dashboard completo de un fondo — endpoint principal.
   * Retorna TIR, morosidad por segmento, flujo de caja, exposición al riesgo,
   * distribución de créditos y métricas históricas.
   */
  @Get('dashboard/:fundId')
  getDashboard(@Param('fundId') fundId: string) {
    this.logger.log(`GET /investor/dashboard/${fundId}`);
    return {
      success: true,
      data: this.portfolioService.getFullDashboard(fundId),
    };
  }

  /** Resumen del portafolio con métricas clave */
  @Get('portfolio/:fundId')
  getPortfolio(
    @Param('fundId') fundId: string,
    @Query('index') index?: string,
  ) {
    this.logger.log(`GET /investor/portfolio/${fundId}`);
    const fundIndex = index ? parseInt(index, 10) : 0;
    return {
      success: true,
      data: this.portfolioService.getPortfolioSummary(fundIndex),
    };
  }

  /** Morosidad desglosada por segmento para un fondo */
  @Get('delinquency/:fundId')
  getDelinquency(@Param('fundId') fundId: string) {
    this.logger.log(`GET /investor/delinquency/${fundId}`);
    return {
      success: true,
      data: this.portfolioService.getDelinquencyBySegment(fundId),
    };
  }

  /** Proyecciones de flujo de caja a 30, 60 y 90 días */
  @Get('cashflow/:fundId')
  getCashFlow(@Param('fundId') fundId: string) {
    this.logger.log(`GET /investor/cashflow/${fundId}`);
    const portfolio = this.portfolioService.getPortfolioSummary(0);
    return {
      success: true,
      data: this.portfolioService.getCashFlowProjections(portfolio.totalDisbursed),
    };
  }

  /** Métricas históricas de los últimos 12 meses */
  @Get('history')
  getHistoricalMetrics() {
    this.logger.log('GET /investor/history');
    return {
      success: true,
      data: this.portfolioService.getHistoricalMetrics(),
    };
  }

  /** Distribución de créditos por estado */
  @Get('distribution/:fundId')
  getCreditDistribution(@Param('fundId') fundId: string) {
    this.logger.log(`GET /investor/distribution/${fundId}`);
    const portfolio = this.portfolioService.getPortfolioSummary(0);
    return {
      success: true,
      data: this.portfolioService.getCreditDistribution(portfolio.totalCredits),
    };
  }

  /**
   * Endpoint webhook para recibir eventos del Event Bus.
   * En producción se reemplaza por el consumer nativo de RabbitMQ.
   * Implementa deduplicación por eventId (idempotencia).
   */
  @Post('events')
  @HttpCode(200)
  async receiveEvent(@Body() event: EventEnvelope) {
    this.logger.log(`POST /investor/events — tipo: ${event.eventType}`);
    const result = await this.eventConsumerService.processEvent(event);
    return {
      success: true,
      data: result,
    };
  }

  /** Estadísticas de eventos procesados */
  @Get('events/stats')
  getEventStats() {
    this.logger.log('GET /investor/events/stats');
    return {
      success: true,
      data: this.eventConsumerService.getEventStats(),
    };
  }
}
