import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUser } from '../auth/jwt.strategy';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtUser => {
    const request = context.switchToHttp().getRequest<{ user: JwtUser }>();
    return request.user;
  },
);
