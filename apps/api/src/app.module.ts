import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load .env from repository root (2 levels up from apps/api)
      envFilePath: [
        join(process.cwd(), '.env'),        // If run from repo root
        join(process.cwd(), '..', '..', '.env'), // If run from apps/api
      ],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
