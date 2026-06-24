import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

/**
 * Bootstrap del microservicio investor-portal.
 * Puerto: 3006 (según docker-compose.yml)
 *
 * Habilita CORS para el frontend del portal de inversionistas.
 */
async function bootstrap() {
  const logger = new Logger('InvestorPortal');
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para el frontend
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
  });

  // Prefijo global de la API
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3006;
  await app.listen(port);

  logger.log(`🚀 Investor Portal corriendo en http://localhost:${port}`);
  logger.log(`📊 Dashboard: http://localhost:${port}/api/v1/investor/dashboard/fund-latam-growth-001`);
  logger.log(`💚 Health: http://localhost:${port}/api/v1/investor/health`);
}

bootstrap();
