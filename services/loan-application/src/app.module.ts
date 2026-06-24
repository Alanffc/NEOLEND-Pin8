import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { LoanApplicationController } from './loan-application.controller';
import { LoanApplicationService } from './loan-application.service';
import { initSchema } from './infra/db';
import { subscribe } from './infra/event-bus';

@Module({
  controllers: [LoanApplicationController],
  providers: [LoanApplicationService],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(private readonly loanService: LoanApplicationService) {}

  async onModuleInit() {
    await initSchema();
    this.logger.log('Esquema PostgreSQL verificado');

    // Escucha decisiones del credit-ledger (idempotente por applicationId)
    await subscribe('credit.approved', (p) => this.loanService.onCreditApproved(p));
    await subscribe('credit.rejected', (p) => this.loanService.onCreditRejected(p));
    this.logger.log('Suscripciones RabbitMQ activas: credit.approved, credit.rejected');
  }
}
