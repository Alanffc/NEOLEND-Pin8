import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port);
  console.log(`loan-application escuchando en :${port}`);
  console.log(`  SCORING_URL: ${process.env.SCORING_URL ?? 'http://scoring-engine:8001'}`);
  console.log(`  FRAUD_URL  : ${process.env.FRAUD_URL ?? 'http://fraud-detection:8002'}`);
}
bootstrap();
