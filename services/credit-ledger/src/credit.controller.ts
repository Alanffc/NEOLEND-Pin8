import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CommandService, DecideCommand } from './cqrs/command.service';
import { QueryService } from './cqrs/query.service';

/**
 * API del servicio de créditos (CQRS).
 *
 *  COMMAND
 *   POST /credits/decide              decide una solicitud (aprobar/rechazar/escalar)
 *   POST /credits/:id/disburse        registra desembolso
 *   POST /credits/:id/payment         registra pago
 *  QUERY
 *   GET  /credits/:id                 estado actual (proyección)
 *   GET  /credits/:id/events          trazabilidad: stream de eventos
 */
@Controller()
export class CreditController {
  constructor(
    private readonly commands: CommandService,
    private readonly queries: QueryService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'credit-ledger' };
  }

  @Post('credits/decide')
  async decide(@Body() cmd: DecideCommand) {
    if (!cmd?.applicationId || typeof cmd.amount !== 'number' || typeof cmd.score !== 'number') {
      throw new HttpException('applicationId, amount y score son obligatorios', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.commands.decide(cmd);
    } catch (err: any) {
      if (err?.status === 409) {
        throw new HttpException('Conflicto de concurrencia: la solicitud ya fue decidida', HttpStatus.CONFLICT);
      }
      throw new HttpException(err.message ?? 'error', HttpStatus.BAD_REQUEST);
    }
  }

  @Post('credits/:id/disburse')
  disburse(@Param('id') id: string, @Body() body: { channel: string; reference: string }) {
    return this.commands.disburse(id, body.channel, body.reference);
  }

  @Post('credits/:id/payment')
  payment(@Param('id') id: string, @Body() body: { amount: number }) {
    return this.commands.registerPayment(id, body.amount);
  }

  @Get('credits/:id/events')
  events(@Param('id') id: string) {
    return this.queries.getEvents(id);
  }

  @Get('credits/:id')
  async getById(@Param('id') id: string) {
    const credit = await this.queries.getById(id);
    if (!credit) throw new NotFoundException(`Crédito ${id} no encontrado`);
    return credit;
  }
}
