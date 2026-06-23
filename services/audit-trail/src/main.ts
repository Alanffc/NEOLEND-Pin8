import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const port = process.env.PORT || 3008;
  await app.listen(port);
  new Logger('audit-trail').log(`audit-trail escuchando en :${port}`);
}
bootstrap();
