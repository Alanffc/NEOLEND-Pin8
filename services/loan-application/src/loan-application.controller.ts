import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { LoanApplicationService, CreateApplicationDto } from './loan-application.service';

@Controller()
export class LoanApplicationController {
  constructor(private readonly service: LoanApplicationService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'loan-application' };
  }

  /**
   * Crea una solicitud de crédito.
   * Body: { applicantId, dni, amount, docBase64? }
   * El cliente solo necesita enviar su DNI — sin formularios extensos (inciso I).
   */
  @Post('applications')
  async create(@Body() body: CreateApplicationDto) {
    if (!body.applicantId) throw new BadRequestException('applicantId requerido');
    if (!body.dni)         throw new BadRequestException('dni requerido');
    if (!body.amount || body.amount <= 0)
      throw new BadRequestException('amount debe ser > 0');

    return this.service.submit(body);
  }

  /** Consulta el estado de una solicitud */
  @Get('applications/:id')
  async getOne(@Param('id') id: string) {
    const app = await this.service.findById(id);
    if (!app) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    return app;
  }
}
