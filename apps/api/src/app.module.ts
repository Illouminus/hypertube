import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { join } from 'path';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

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
    // Rate limiting - default: 100 requests per minute
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute in ms
        limit: 100,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
  ],
  providers: [
    // Global JWT authentication guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
