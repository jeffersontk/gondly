import { Injectable, NotFoundException } from "@nestjs/common";
import type { SharedPriceReportReason } from "@prisma/client";
import { optionalText } from "../common/utils/normalize";
import { PrismaService } from "../prisma/prisma.service";
import { ReportSharedPriceRecordDto } from "./dto";

const REPORT_THRESHOLD = 3;

@Injectable()
export class SharedPriceRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async report(userId: string, id: string, dto: ReportSharedPriceRecordDto) {
    const record = await this.prisma.sharedPriceRecord.findFirst({
      where: {
        id,
        visibility: "shared",
        status: { not: "ignored" },
      },
      select: { id: true },
    });

    if (!record) {
      throw new NotFoundException("Shared price record not found.");
    }

    const comment = optionalText(dto.comment) ?? null;

    return this.prisma.$transaction(async (tx) => {
      await tx.sharedPriceReport.upsert({
        where: {
          sharedPriceRecordId_reporterUserId: {
            sharedPriceRecordId: record.id,
            reporterUserId: userId,
          },
        },
        create: {
          sharedPriceRecordId: record.id,
          reporterUserId: userId,
          reason: dto.reason,
          comment,
        },
        update: {
          reason: dto.reason,
          comment,
        },
      });

      const reportsCount = await tx.sharedPriceReport.count({
        where: { sharedPriceRecordId: record.id },
      });
      const status = reportsCount >= REPORT_THRESHOLD ? "user_reported" : "suspected";
      const qualityReason = this.qualityReason(dto.reason, reportsCount);
      const updatedRecord = await tx.sharedPriceRecord.update({
        where: { id: record.id },
        data: {
          status,
          qualityReason,
          confidenceScore: status === "user_reported" ? 0 : 0.25,
        },
        select: {
          id: true,
          status: true,
          qualityReason: true,
        },
      });

      return {
        id: updatedRecord.id,
        status: updatedRecord.status,
        qualityReason: updatedRecord.qualityReason,
        reportsCount,
      };
    });
  }

  private qualityReason(reason: SharedPriceReportReason, reportsCount: number) {
    if (reportsCount >= REPORT_THRESHOLD) return "multiple_reports";
    return `reported_${reason}`;
  }
}
