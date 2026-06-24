import { Module } from '@nestjs/common';
import { CreditController } from './credit.controller';
import { CommandService } from './cqrs/command.service';
import { QueryService } from './cqrs/query.service';
import { EventStore } from './infra/event-store';
import { EventBus } from './infra/event-bus';
import { AuditClient } from './infra/audit.client';

@Module({
  controllers: [CreditController],
  providers: [CommandService, QueryService, EventStore, EventBus, AuditClient],
})
export class AppModule {}
