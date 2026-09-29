import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para permitir peticiones desde Angular (localhost:4200)
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const PORT = process.env.PORT || 3000;
  await app.listen(PORT);
  logger.log(`🚀 Backend NestJS escuchando en: http://localhost:${PORT}`);
  logger.log(`📦 Endpoint de subida listo: http://localhost:${PORT}/api/inventario/upload`);
}
bootstrap();
