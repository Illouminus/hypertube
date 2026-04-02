import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { join } from 'node:path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve uploaded files (avatars, etc.) as static assets
  app.useStaticAssets(join(__dirname, '..', '..', 'uploads'), { prefix: '/uploads' });

  app.use(cookieParser());

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe ({
    whitelist: true, // Strip properties that do not have any decorators
    forbidNonWhitelisted: true // Throw an error if non-whitelisted properties are present
    })
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Hypertube API')
    .setDescription('Backend API documentation for movies, auth, and users')
    .setVersion('1.0')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
