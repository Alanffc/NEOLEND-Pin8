import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const port = process.env.PORT || 3003;
  await app.listen(port);
  new Logger('credit-ledger').log(`credit-ledger (CQRS+ES) escuchando en :${port}`);
}
bootstrap();
