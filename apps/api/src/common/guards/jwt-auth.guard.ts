import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import type { JwtUser } from "../auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtUser }>();
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

    if (!token) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: string; userId?: string; email: string; name: string }>(token, {
        secret: process.env.JWT_SECRET ?? "dev-secret",
      });
      const userId = payload.sub ?? payload.userId;
      if (!userId) {
        throw new UnauthorizedException("Invalid token payload.");
      }
      request.user = { id: userId, email: payload.email, name: payload.name };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token.");
    }
  }
}
