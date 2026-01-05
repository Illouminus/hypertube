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
});
