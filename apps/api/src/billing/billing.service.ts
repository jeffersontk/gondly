import { BadRequestException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EntitlementSource, PaymentStatus, Prisma } from "@prisma/client";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

const REMOVE_ADS_TITLE = "Gondly Sem Anuncios";
const REMOVE_ADS_DESCRIPTION = "Pague uma vez e remova os anuncios para sempre.";

type MercadoPagoPreferenceResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

type MercadoPagoPaymentResponse = {
  id: string | number;
  status?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  currency_id?: string;
  metadata?: Record<string, unknown>;
};

type WebhookPayload = {
  type?: string;
  action?: string;
  data?: { id?: string | number };
  resource?: string;
};

type WebhookQuery = Record<string, string | string[] | undefined>;
type WebhookHeaders = Record<string, string | string[] | undefined>;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getBillingStatus(userId: string) {
    const entitlements = await this.activeEntitlementKeys(userId);
    const hasNoAds = entitlements.includes("no_ads");

    return {
      adsEnabled: !hasNoAds,
      hasNoAds,
      entitlements,
      availableOffers: hasNoAds ? [] : [await this.removeAdsOffer()],
    };
  }

  async hasNoAds(userId: string) {
    return Boolean(
      await this.prisma.userEntitlement.findFirst({
        where: { userId, key: "no_ads", active: true },
        select: { id: true },
      }),
    );
  }

  async shouldShowAds(userId: string) {
    return !(await this.hasNoAds(userId));
  }

  async canCreateSharedList(_userId: string) {
    return true;
  }

  async canUseRealtimeCollaboration(_userId: string) {
    return true;
  }

  async canViewFullHistory(_userId: string) {
    return true;
  }

  async canExport(_userId: string) {
    return false;
  }

  async createRemoveAdsCheckout(userId: string) {
    if (await this.hasNoAds(userId)) {
      throw new BadRequestException("Os anuncios ja foram removidos desta conta.");
    }

    const offer = await this.removeAdsOffer();
    const externalReference = `remove_ads_${randomUUID()}`;
    const amount = new Prisma.Decimal(offer.price.toFixed(2));

    const purchase = await this.prisma.oneTimePurchase.create({
      data: {
        userId,
        type: "remove_ads",
        provider: "mercado_pago",
        providerExternalReference: externalReference,
        status: "pending",
        amount,
        currency: offer.currency,
      },
    });

    try {
      const preference = await this.createMercadoPagoPreference({
        purchaseId: purchase.id,
        userId,
        externalReference,
        price: offer.price,
        currency: offer.currency,
      });

      const checkoutUrl = preference.init_point ?? preference.sandbox_init_point;
      if (!checkoutUrl) {
        throw new ServiceUnavailableException("Mercado Pago nao retornou uma URL de checkout.");
      }

      const updated = await this.prisma.oneTimePurchase.update({
        where: { id: purchase.id },
        data: {
          providerPreferenceId: preference.id,
          checkoutUrl,
        },
      });

      return {
        checkoutUrl,
        purchaseId: updated.id,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      this.logger.error(`Failed to create Mercado Pago preference for purchase ${purchase.id}`, error);
      throw new ServiceUnavailableException("Nao foi possivel iniciar o checkout no Mercado Pago.");
    }
  }

  async handleMercadoPagoWebhook(payload: WebhookPayload, headers: WebhookHeaders, query: WebhookQuery) {
    const paymentId = this.extractPaymentId(payload, query);
    if (!paymentId) {
      this.logger.warn("Mercado Pago webhook without payment id.");
      return { received: true };
    }

    this.validateWebhookSignature(paymentId, headers);

    const payment = await this.fetchMercadoPagoPayment(paymentId);
    await this.applyMercadoPagoPayment(payment);

    return { received: true };
  }

  async purchases(userId: string) {
    return this.prisma.oneTimePurchase.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async purchase(userId: string, id: string) {
    const purchase = await this.prisma.oneTimePurchase.findFirst({
      where: { id, userId },
    });

    if (!purchase) {
      throw new BadRequestException("Compra nao encontrada.");
    }

    return purchase;
  }

  async grantNoAds(userId: string, source: EntitlementSource = "manual") {
    return this.prisma.userEntitlement.upsert({
      where: { userId_key: { userId, key: "no_ads" } },
      update: { active: true, source },
      create: { userId, key: "no_ads", source, active: true },
    });
  }

  async revokeNoAds(userId: string, _reason?: string) {
    return this.prisma.userEntitlement.updateMany({
      where: { userId, key: "no_ads", active: true },
      data: { active: false },
    });
  }

  private async activeEntitlementKeys(userId: string) {
    const entitlements = await this.prisma.userEntitlement.findMany({
      where: { userId, active: true },
      select: { key: true },
      orderBy: { createdAt: "asc" },
    });

    return entitlements.map((entry) => entry.key);
  }

  private async removeAdsOffer() {
    const price = await this.getConfiguredNumber("REMOVE_ADS_PRICE", 19.9);
    const currency = (await this.getConfiguredString("REMOVE_ADS_CURRENCY", "BRL")).toUpperCase();

    return {
      type: "remove_ads",
      title: REMOVE_ADS_TITLE,
      description: REMOVE_ADS_DESCRIPTION,
      price,
      currency,
    };
  }

  private async getConfiguredString(key: string, fallback: string) {
    const fromEnv = this.config.get<string>(key);
    if (fromEnv) {
      return fromEnv;
    }

    const fromDb = await this.prisma.appConfig.findUnique({ where: { key } });
    return fromDb?.value ?? fallback;
  }

  private async getConfiguredNumber(key: string, fallback: number) {
    const raw = await this.getConfiguredString(key, String(fallback));
    const value = Number(raw.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException(`${key} invalido.`);
    }
    return value;
  }

  private async createMercadoPagoPreference(input: {
    purchaseId: string;
    userId: string;
    externalReference: string;
    price: number;
    currency: string;
  }) {
    const accessToken = this.config.get<string>("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) {
      throw new ServiceUnavailableException("MERCADO_PAGO_ACCESS_TOKEN nao configurado.");
    }

    const frontendUrl = this.trimTrailingSlash(this.config.get<string>("FRONTEND_URL") ?? "http://localhost:5173");
    const autoReturn = frontendUrl.startsWith("https://") ? { auto_return: "approved" } : {};
    const payload = {
      items: [
        {
          title: REMOVE_ADS_TITLE,
          description: REMOVE_ADS_DESCRIPTION,
          quantity: 1,
          unit_price: input.price,
          currency_id: input.currency,
        },
      ],
      external_reference: input.externalReference,
      notification_url: `${this.apiPublicUrl()}/billing/webhook/mercado-pago`,
      back_urls: {
        success: `${frontendUrl}/app/billing/success`,
        failure: `${frontendUrl}/app/billing/failure`,
        pending: `${frontendUrl}/app/billing/pending`,
      },
      ...autoReturn,
      metadata: {
        purchase_id: input.purchaseId,
        user_id: input.userId,
        type: "remove_ads",
      },
    };

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Mercado Pago preference error ${response.status}: ${body}`);
      throw new ServiceUnavailableException("Mercado Pago recusou a criacao da preferencia.");
    }

    return (await response.json()) as MercadoPagoPreferenceResponse;
  }

  private async fetchMercadoPagoPayment(paymentId: string) {
    const accessToken = this.config.get<string>("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) {
      throw new ServiceUnavailableException("MERCADO_PAGO_ACCESS_TOKEN nao configurado.");
    }

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Mercado Pago payment fetch error ${response.status}: ${body}`);
      throw new ServiceUnavailableException("Nao foi possivel confirmar o pagamento no Mercado Pago.");
    }

    return (await response.json()) as MercadoPagoPaymentResponse;
  }

  private async applyMercadoPagoPayment(payment: MercadoPagoPaymentResponse) {
    const externalReference =
      payment.external_reference ?? (typeof payment.metadata?.external_reference === "string" ? payment.metadata.external_reference : undefined);

    if (!externalReference) {
      this.logger.warn(`Payment ${payment.id} has no external_reference.`);
      return;
    }

    const nextStatus = this.mapPaymentStatus(payment.status);
    const providerPaymentId = String(payment.id);

    await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.oneTimePurchase.findUnique({
        where: { providerExternalReference: externalReference },
      });

      if (!purchase) {
        this.logger.warn(`Payment ${providerPaymentId} references unknown purchase ${externalReference}.`);
        return;
      }

      if (nextStatus === "approved") {
        await tx.oneTimePurchase.update({
          where: { id: purchase.id },
          data: {
            status: "approved",
            providerPaymentId,
            paidAt: purchase.paidAt ?? new Date(),
          },
        });

        await tx.userEntitlement.upsert({
          where: { userId_key: { userId: purchase.userId, key: "no_ads" } },
          update: { active: true, source: "one_time_purchase" },
          create: {
            userId: purchase.userId,
            key: "no_ads",
            source: "one_time_purchase",
            active: true,
          },
        });
        return;
      }

      if (nextStatus === "refunded") {
        await tx.oneTimePurchase.update({
          where: { id: purchase.id },
          data: {
            status: "refunded",
            providerPaymentId,
            refundedAt: purchase.refundedAt ?? new Date(),
          },
        });
        await tx.userEntitlement.updateMany({
          where: { userId: purchase.userId, key: "no_ads", active: true },
          data: { active: false },
        });
        return;
      }

      if (purchase.status === "approved") {
        return;
      }

      await tx.oneTimePurchase.update({
        where: { id: purchase.id },
        data: {
          status: nextStatus,
          providerPaymentId,
          rejectedAt: nextStatus === "rejected" || nextStatus === "cancelled" || nextStatus === "expired" ? new Date() : purchase.rejectedAt,
        },
      });
    });
  }

  private extractPaymentId(payload: WebhookPayload, query: WebhookQuery) {
    const queryId = this.firstQueryValue(query.id) ?? this.firstQueryValue(query["data.id"]);
    if (queryId) {
      return queryId;
    }

    if (payload.data?.id) {
      return String(payload.data.id);
    }

    if (typeof payload.resource === "string") {
      const match = payload.resource.match(/\/payments\/(\d+)/);
      return match?.[1];
    }

    return undefined;
  }

  private validateWebhookSignature(paymentId: string, headers: WebhookHeaders) {
    const secret = this.config.get<string>("MERCADO_PAGO_WEBHOOK_SECRET");
    if (!secret) {
      return;
    }

    const signatureHeader = this.headerValue(headers, "x-signature");
    const requestId = this.headerValue(headers, "x-request-id");
    const parts = Object.fromEntries(
      (signatureHeader ?? "")
        .split(",")
        .map((part) => part.trim().split("="))
        .filter(([key, value]) => key && value),
    );

    const ts = parts.ts;
    const signature = parts.v1;
    if (!requestId || !ts || !signature) {
      throw new UnauthorizedException("Validacao do webhook invalida.");
    }

    const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
    const expected = createHmac("sha256", secret).update(manifest).digest("hex");
    const actualBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
      throw new UnauthorizedException("Validacao do webhook invalida.");
    }
  }

  private mapPaymentStatus(status?: string): PaymentStatus {
    switch (status) {
      case "approved":
        return "approved";
      case "rejected":
        return "rejected";
      case "cancelled":
      case "canceled":
        return "cancelled";
      case "refunded":
      case "charged_back":
        return "refunded";
      case "expired":
        return "expired";
      default:
        return "pending";
    }
  }

  private apiPublicUrl() {
    const configured = this.config.get<string>("API_PUBLIC_URL") ?? this.config.get<string>("PUBLIC_API_URL");
    if (configured) {
      return this.trimTrailingSlash(configured);
    }

    const port = this.config.get<string>("API_PORT") ?? "3333";
    return `http://localhost:${port}`;
  }

  private trimTrailingSlash(value: string) {
    return value.replace(/\/+$/, "");
  }

  private firstQueryValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }

  private headerValue(headers: WebhookHeaders, key: string) {
    const value = headers[key] ?? headers[key.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }
}
