import { Module } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker';
import { CacheService } from './cache.service';
import { BureauService } from './bureau.service';
import { BureauController } from './bureau.controller';

@Module({
  controllers: [BureauController],
  providers: [CircuitBreakerService, CacheService, BureauService],
})
export class AppModule {}
