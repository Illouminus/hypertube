import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Decorator to extract the current authenticated user from the request.
 * Can optionally extract a specific property of the user.
 *
 * @example
 * // Get entire user object
 * @Get('profile')
 * getProfile(@CurrentUser() user: User) { ... }
 *
 * @example
 * // Get specific property
 * @Get('profile')
 * getProfile(@CurrentUser('id') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as Record<string, unknown> | undefined;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
