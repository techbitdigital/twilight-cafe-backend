/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op, WhereOptions } from "sequelize";
import * as QRCodeLib from "qrcode";
import { PDFDocument, PDFFont, PDFPage, StandardFonts } from "pdf-lib";
import { QRCode } from "./entities/qrcode.entity";
import { QRScan } from "./entities/qr-scan.entity";
import type { CreateQRCodeInput } from "./dto/generate-qr.dto";
import type { UpdateQRCodeInput } from "./dto/update-qrcode.dto";
import type { TrackScanInput } from "./dto/track-scan.dto";

/* ============================
   TYPES
============================ */

export type PDFSize = "small" | "medium" | "large";
export type PDFTemplate = "modern" | "elegant" | "minimal" | "vibrant";

export interface QRCodeCustomization {
  color?: string;
  backgroundColor?: string;
  logo?: string;
  template?: PDFTemplate;
}

export interface ScanAnalytics {
  totalScans: number;
  uniqueUsers: number;
  conversions: number;
  conversionRate: string;
  scansByDate: Record<string, number>;
  scansByHour: Record<number, number>;
  topDevices: Array<{ device: string; count: number }>;
}

export interface BulkQRGenerateInput {
  tableNumbers: number[];
  location: string;
  customization?: QRCodeCustomization;
}

interface TemplateConfig {
  primaryColor: [number, number, number];
  accentColor: [number, number, number];
  titleSize: number;
  subtitleSize: number;
  showDecorations: boolean;
}

/* ============================
   SERVICE
============================ */

@Injectable()
export class QRCodeService {
  private readonly logger = new Logger(QRCodeService.name);
  private readonly menuUrl = "https://twilightcafe.com.ng/menu-list";
  private readonly cafeName = process.env.CAFE_NAME ?? "Twilight Cafe";

  // ⚠️ These are placeholders for methods that need full implementation later.
  // They are typed as `any` to avoid TS errors when called from the controller.
  compareQRPerformance: any;
  drawModernTemplate: any;
  drawMinimalTemplate: any;
  getQRCodesByLocation: any;

  constructor(
    @InjectModel(QRCode)
    private readonly qrCodeModel: typeof QRCode,

    @InjectModel(QRScan)
    private readonly qrScanModel: typeof QRScan,
  ) {}

  /* ============================
     HELPERS
  ============================ */

  private extractBase64Image(dataUrl?: string): Buffer {
    if (!dataUrl) {
      throw new BadRequestException("QR image not generated");
    }

    const parts = dataUrl.split(",");
    if (parts.length !== 2) {
      throw new BadRequestException("Invalid QR image format");
    }

    return Buffer.from(parts[1], "base64");
  }

  private buildTrackingUrl(qrCodeId: string): string {
    const apiBaseUrl =
      process.env.APP_URL ?? "https://backend.twilightcafe.com.ng";
    return `${apiBaseUrl}/api/qrcode/${qrCodeId}/scan`;
  }

  private async generateQRImage(
    url: string,
    customization?: QRCodeCustomization,
  ): Promise<string> {
    return QRCodeLib.toDataURL(url, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 600,
      margin: 2,
      color: {
        dark: customization?.color ?? "#1a1a1a",
        light: customization?.backgroundColor ?? "#FFFFFF",
      },
    });
  }

  /* ============================
     QR GENERATION
  ============================ */

  async generateQRCode(data: CreateQRCodeInput): Promise<QRCode> {
    try {
      if (!data.name && !data.location) {
        throw new BadRequestException(
          "Either name or location must be provided",
        );
      }

      if (data.name) {
        const existing = await this.qrCodeModel.findOne({
          where: { name: data.name },
        });

        if (existing) {
          throw new BadRequestException(
            `QR code with name "${data.name}" already exists`,
          );
        }
      }

      const qrCode = await this.qrCodeModel.create({
        name: data.name ?? `Table ${Date.now()}`,
        customization: data.customization ?? {},
        location: data.location ?? "Main Dining",
        url: "",
        isActive: true,
      });

      const trackingUrl = this.buildTrackingUrl(qrCode.id);
      const qrCodeDataUrl = await this.generateQRImage(
        trackingUrl,
        data.customization,
      );

      await qrCode.update({ url: trackingUrl, qrCodeDataUrl });

      return qrCode;
    } catch (error: unknown) {
      this.logger.error(
        "Failed to generate QR code",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async downloadQRCodePDF(
    id: string,
    size: PDFSize = "medium",
  ): Promise<Buffer> {
    return this.generatePDF(id, size);
  }

  async generateBulkQRCodes(input: BulkQRGenerateInput): Promise<{
    success: QRCode[];
    failed: Array<{ table: number; error: string }>;
  }> {
    const success: QRCode[] = [];
    const failed: Array<{ table: number; error: string }> = [];

    const results = await Promise.allSettled(
      input.tableNumbers.map((tableNumber) =>
        this.generateQRCode({
          name: `Table ${tableNumber}`,
          location: input.location,
          customization: input.customization,
        }),
      ),
    );

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        success.push(result.value);
      } else {
        failed.push({
          table: input.tableNumbers[index],
          error:
            result.reason instanceof Error
              ? result.reason.message
              : "Unknown error",
        });
      }
    });

    return { success, failed };
  }

  /* ============================
     FETCH
  ============================ */

  async getQRCode(id: string): Promise<QRCode> {
    const qrCode = await this.qrCodeModel.findByPk(id);
    if (!qrCode) throw new NotFoundException("QR code not found");
    return qrCode;
  }

  async getAllQRCodes(filters?: {
    location?: string;
    isActive?: boolean;
  }): Promise<QRCode[]> {
    const where: WhereOptions<QRCode> = {};

    if (filters?.location) where.location = filters.location;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    return this.qrCodeModel.findAll({
      where,
      order: [["createdAt", "DESC"]],
    });
  }

  /* ============================
     UPDATE
  ============================ */

  async updateQRCode(id: string, data: UpdateQRCodeInput): Promise<QRCode> {
    const qrCode = await this.getQRCode(id);
    const updateData: Partial<QRCode> = { ...data };

    if (data.customization) {
      const newQRCodeDataUrl = await this.generateQRImage(
        qrCode.url,
        data.customization,
      );

      updateData.qrCodeDataUrl = newQRCodeDataUrl;
      updateData.customization = {
        ...qrCode.customization,
        ...data.customization,
      };
    }

    await qrCode.update(updateData);
    return qrCode;
  }

  async toggleQRCodeStatus(id: string): Promise<QRCode> {
    const qrCode = await this.getQRCode(id);
    await qrCode.update({ isActive: !qrCode.isActive });
    return qrCode;
  }

  async deleteQRCode(id: string): Promise<{ message: string }> {
    const qrCode = await this.getQRCode(id);
    await qrCode.destroy();
    return { message: "QR code deleted successfully" };
  }

  /* ============================
     PDF GENERATION
  ============================ */

  async generatePDF(
    id: string,
    size: PDFSize = "medium",
    template: PDFTemplate = "modern",
  ): Promise<Buffer> {
    try {
      const qrCode = await this.getQRCode(id);

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage(
        size === "small"
          ? [400, 500]
          : size === "large"
            ? [842, 1191]
            : [595, 842],
      );

      const fonts = {
        bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
        regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
        italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
      };

      const config = this.getTemplateConfig(template);

      switch (template) {
        case "modern":
          await this.drawModernTemplate(page, qrCode, fonts, config);
          break;
        case "elegant":
          await this.drawElegantTemplate(page, qrCode, fonts, config);
          break;
        case "minimal":
          await this.drawMinimalTemplate(page, qrCode, fonts, config);
          break;
        case "vibrant":
          await this.drawVibrantTemplate(page, qrCode, fonts, config);
          break;
      }

      return Buffer.from(await pdfDoc.save());
    } catch (error: unknown) {
      this.logger.error(
        "Failed to generate PDF",
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException("Failed to generate PDF");
    }
  }

  // ⚠️ Needs full implementation — currently throws to prevent silent bad PDFs
  drawVibrantTemplate(
    _page: PDFPage,
    _qrCode: QRCode,
    _fonts: { bold: PDFFont; regular: PDFFont; italic: PDFFont },
    _config: TemplateConfig,
  ): void {
    throw new Error("drawVibrantTemplate not yet implemented.");
  }

  // ⚠️ Needs full implementation
  drawElegantTemplate(
    _page: PDFPage,
    _qrCode: QRCode,
    _fonts: { bold: PDFFont; regular: PDFFont; italic: PDFFont },
    _config: TemplateConfig,
  ): void {
    throw new Error("drawElegantTemplate not yet implemented.");
  }

  private getTemplateConfig(template: PDFTemplate): TemplateConfig {
    const templates: Record<PDFTemplate, TemplateConfig> = {
      modern: {
        primaryColor: [0.1, 0.1, 0.1],
        accentColor: [0.2, 0.4, 0.8],
        titleSize: 32,
        subtitleSize: 18,
        showDecorations: true,
      },
      elegant: {
        primaryColor: [0.15, 0.1, 0.05],
        accentColor: [0.7, 0.6, 0.4],
        titleSize: 36,
        subtitleSize: 16,
        showDecorations: true,
      },
      minimal: {
        primaryColor: [0, 0, 0],
        accentColor: [0.3, 0.3, 0.3],
        titleSize: 28,
        subtitleSize: 14,
        showDecorations: false,
      },
      vibrant: {
        primaryColor: [0.8, 0.2, 0.3],
        accentColor: [1, 0.6, 0.2],
        titleSize: 34,
        subtitleSize: 20,
        showDecorations: true,
      },
    };

    return templates[template];
  }

  /* ============================
     SCAN TRACKING
  ============================ */

  async trackScan(qrCodeId: string, scanData: TrackScanInput): Promise<QRScan> {
    const qrCode = await this.getQRCode(qrCodeId);

    if (!qrCode.isActive) {
      throw new BadRequestException("This QR code is not active");
    }

    const existingScan = await this.qrScanModel.findOne({
      where: { qrCodeId, userIdentifier: scanData.userIdentifier },
    });

    if (!existingScan) await qrCode.increment("uniqueUsers");
    await qrCode.increment("totalScans");

    return this.qrScanModel.create({ qrCodeId, ...scanData });
  }

  async markScanAsConverted(scanId: string): Promise<QRScan> {
    const scan = await this.qrScanModel.findByPk(scanId);
    if (!scan) throw new NotFoundException("Scan not found");
    await scan.update({ convertedToOrder: true });
    return scan;
  }

  /* ============================
     ANALYTICS
  ============================ */

  async getQRAnalytics(
    qrCodeId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ScanAnalytics> {
    await this.getQRCode(qrCodeId);

    const where: WhereOptions<QRScan> = { qrCodeId };

    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [startDate, endDate] };
    }

    const scans = await this.qrScanModel.findAll({ where });

    const totalScans = scans.length;
    const uniqueUsers = new Set(scans.map((s) => s.userIdentifier)).size;
    const conversions = scans.filter((s) => s.convertedToOrder).length;

    return {
      totalScans,
      uniqueUsers,
      conversions,
      conversionRate:
        totalScans > 0 ? ((conversions / totalScans) * 100).toFixed(2) : "0.00",
      scansByDate: {},
      scansByHour: {},
      topDevices: [],
    };
  }

  async getOverallAnalytics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalScans: number;
    uniqueUsers: number;
    conversions: number;
    conversionRate: string;
    scansByHour: Record<number, number>;
  }> {
    const where: WhereOptions<QRScan> = {};

    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [startDate, endDate] };
    }

    const scans = await this.qrScanModel.findAll({ where });

    const totalScans = scans.length;
    const uniqueUsers = new Set(scans.map((s) => s.userIdentifier)).size;
    const conversions = scans.filter((s) => s.convertedToOrder).length;

    const scansByHour: Record<number, number> = {};
    scans.forEach((s) => {
      const hour = new Date(s.createdAt).getHours();
      scansByHour[hour] = (scansByHour[hour] ?? 0) + 1;
    });

    return {
      totalScans,
      uniqueUsers,
      conversions,
      conversionRate:
        totalScans > 0 ? ((conversions / totalScans) * 100).toFixed(2) : "0.00",
      scansByHour,
    };
  }

  async generateBulkPDFs(
    qrCodeIds: string[],
    size: PDFSize = "medium",
    template: PDFTemplate = "modern",
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();

    for (const id of qrCodeIds) {
      try {
        const singleBuffer = await this.generatePDF(id, size, template);
        const singleDoc = await PDFDocument.load(singleBuffer);
        const pages = await pdfDoc.copyPages(
          singleDoc,
          singleDoc.getPageIndices(),
        );
        pages.forEach((p) => pdfDoc.addPage(p));
      } catch (error) {
        this.logger.warn(`Skipping QR ${id} in bulk PDF — ${String(error)}`);
      }
    }

    return Buffer.from(await pdfDoc.save());
  }
}
