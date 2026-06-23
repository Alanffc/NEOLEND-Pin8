import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditRepository } from './audit.repository';
import { CryptoService } from './crypto.service';
import { EventConsumer } from './event-consumer';

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditRepository, CryptoService, EventConsumer],
})
export class AppModule {}
