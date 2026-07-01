import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { OAuth2Client } from "google-auth-library";
import { BillingService } from "../billing/billing.service";
import { PrismaService } from "../prisma/prisma.service";

type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
  photoUrl?: string | null;
};

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly billingService: BillingService,
  ) {}

  async loginWithGoogle(idToken: string) {
    const profile = idToken.startsWith("dev:") ? this.readDevProfile(idToken) : await this.verifyGoogleToken(idToken);

    const existingByGoogleId = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: profile.googleId }, { email: profile.email }] },
    });
    const isNewUser = !existingByGoogleId;

    const user = existingByGoogleId
      ? await this.prisma.user.update({
          where: { id: existingByGoogleId.id },
          data: {
            googleId: existingByGoogleId.googleId ?? profile.googleId,
            email: profile.email,
            name: profile.name,
            photoUrl: profile.photoUrl,
          },
        })
      : await this.prisma.user.create({
          data: {
            googleId: profile.googleId,
            email: profile.email,
            name: profile.name,
            photoUrl: profile.photoUrl,
          },
        });

    const monetization = await this.billingService.getBillingStatus(user.id);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    return {
      accessToken,
      isNewUser,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        photoUrl: user.photoUrl,
        monetization,
      },
      monetization,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, photoUrl: true, createdAt: true, updatedAt: true },
    });

    if (!user) {
      throw new UnauthorizedException("User not found.");
    }

    const monetization = await this.billingService.getBillingStatus(userId);

    return { ...user, monetization };
  }

  private async verifyGoogleToken(idToken: string): Promise<GoogleProfile> {
    const clientId = this.config.get<string>("GOOGLE_CLIENT_ID");
    if (!clientId) {
      throw new BadRequestException("GOOGLE_CLIENT_ID is required for Google login.");
    }

    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: clientId,
    });
    const payload = ticket.getPayload();

    if (!payload?.email || payload.email_verified === false || !payload.sub) {
      throw new UnauthorizedException("Google token is not valid.");
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email.split("@")[0],
      photoUrl: payload.picture,
    };
  }

  private readDevProfile(idToken: string): GoogleProfile {
    if (this.config.get<string>("ALLOW_DEV_LOGIN") !== "true") {
      throw new UnauthorizedException("Development login is disabled.");
    }

    const encoded = idToken.replace(/^dev:/, "");
    try {
      const json = Buffer.from(encoded, "base64").toString("utf8");
      const parsed = JSON.parse(json) as { email?: string; name?: string };
      if (!parsed.email) {
        throw new Error("Missing email.");
      }

      return {
        googleId: `dev-${parsed.email.toLowerCase()}`,
        email: parsed.email.toLowerCase(),
        name: parsed.name?.trim() || parsed.email.split("@")[0],
        photoUrl: null,
      };
    } catch {
      throw new BadRequestException("Invalid development login token.");
    }
  }

}
