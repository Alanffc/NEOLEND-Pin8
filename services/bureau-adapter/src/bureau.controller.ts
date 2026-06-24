import {
  Controller,
  Get,
  Delete,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BureauService } from './bureau.service';
import { CacheService } from './cache.service';
import { CircuitBreakerService } from './circuit-breaker';

@Controller()
export class BureauController {
  constructor(
    private readonly bureauService: BureauService,
    private readonly cache: CacheService,
    private readonly cb: CircuitBreakerService,
  ) {}

  /** Liveness/readiness + estado del circuit breaker */
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'bureau-adapter',
      circuit: this.cb.status(),
    };
  }

  /** Obtiene el reporte de buró para un DNI.
   *  Flujo: circuit breaker → caché Redis → fallback duro.
   */
  @Get('bureau/:dni')
  async getReport(@Param('dni') dni: string) {
    if (!dni || dni.length < 7 || dni.length > 12) {
      throw new HttpException('Formato de DNI inválido', HttpStatus.BAD_REQUEST);
    }
    console.log(`[BureauController] GET /bureau/${dni.slice(0, 3)}*** — circuit: ${this.cb.status().state}`);
    try {
      return await this.bureauService.getReport(dni);
    } catch (err) {
      throw new HttpException(
        (err as Error).message,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /** Invalida la caché de un DNI (útil cuando el buró emite un reporte nuevo) */
  @Delete('bureau/:dni/cache')
  async invalidateCache(@Param('dni') dni: string) {
    console.log(`[BureauController] DELETE /bureau/${dni.slice(0, 3)}***/cache`);
    await this.cache.invalidate(dni);
    return { invalidated: true, dni };
  }

  /** Expone el estado actual del circuit breaker */
  @Get('circuit/status')
  circuitStatus() {
    return this.cb.status();
  }
}
