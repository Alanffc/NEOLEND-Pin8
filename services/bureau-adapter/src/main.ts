import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = parseInt(process.env.PORT ?? '3002', 10);
  await app.listen(port);
  console.log(`bureau-adapter escuchando en :${port}`);
  console.log(`  REDIS_URL      : ${process.env.REDIS_URL ?? 'redis://localhost:6379'}`);
  console.log(`  BUREAU_SOAP_URL: ${process.env.BUREAU_SOAP_URL ?? '(no configurado)'}`);
}
bootstrap();
