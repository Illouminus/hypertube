import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),

  // Database
  DATABASE_URL: Joi.string().required().description('PostgreSQL connection URL'),

  // Redis
  REDIS_URL: Joi.string().default('redis://localhost:6379'),

  // JWT Configuration
  JWT_ACCESS_SECRET: Joi.string()
    .default('dev-access-secret-change-in-production')
    .description('Secret key for JWT access tokens'),
  JWT_REFRESH_SECRET: Joi.string()
    .default('dev-refresh-secret-change-in-production')
    .description('Secret key for JWT refresh tokens'),
  JWT_ACCESS_TTL: Joi.string()
    .default('15m')
    .description('Access token time-to-live (e.g., 15m, 1h)'),
  JWT_REFRESH_TTL: Joi.string()
    .default('7d')
    .description('Refresh token time-to-live (e.g., 7d, 30d)'),

  // Frontend URL (for password reset links)
  FRONTEND_URL: Joi.string()
    .default('http://localhost:3000')
    .description('Frontend URL for email links'),

  // SMTP Configuration (optional - falls back to console logging if not set)
  SMTP_HOST: Joi.string()
    .default('')
    .description('SMTP server hostname (e.g., smtp.gmail.com)'),
  SMTP_PORT: Joi.number()
    .default(587)
    .description('SMTP server port (587 for TLS, 465 for SSL)'),
  SMTP_USER: Joi.string()
    .default('')
    .description('SMTP authentication username'),
  SMTP_PASS: Joi.string()
    .default('')
    .description('SMTP authentication password'),
  SMTP_FROM: Joi.string()
    .default('noreply@hypertube.local')
    .description('Default "From" email address'),

  // OMDb API
  OMDB_API_KEY: Joi.string()
    .default('')
    .description('OMDb API key for movie metadata enrichment'),
});
