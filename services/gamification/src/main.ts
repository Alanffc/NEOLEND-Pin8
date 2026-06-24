import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

/**
 * Bootstrap del microservicio de gamificación.
 * Puerto: 3007 (según docker-compose.yml)
 *
 * Habilita CORS para el frontend de la app móvil.
 */
async function bootstrap() {
  const logger = new Logger('Gamification');
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para el frontend
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
  });

  // Prefijo global de la API
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3007;
  await app.listen(port);

  logger.log(`🎮 Gamification Service corriendo en http://localhost:${port}`);
  logger.log(`📚 Cursos: http://localhost:${port}/api/v1/gamification/courses`);
  logger.log(`💚 Health: http://localhost:${port}/api/v1/gamification/health`);
}

bootstrap();
