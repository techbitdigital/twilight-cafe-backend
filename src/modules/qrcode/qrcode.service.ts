/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op } from "sequelize";
import * as QRCodeLib from "qrcode";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { Readable } from "stream";
import { QRCode } from "./entities/qrcode.entity";
import { QRScan } from "./entities/qr-scan.entity";
import type { CreateQRCodeInput } from "./dto/generate-qr.dto";
import type { UpdateQRCodeInput } from "./dto/update-qrcode.dto";
import type { TrackScanInput } from "./dto/track-scan.dto";

export type PDFSize = "small" | "medium" | "large";
export type PDFTemplate = "modern" | "elegant" | "minimal" | "vibrant";

export interface QRCodeCustomization {
  color?: string;
  backgroundColor?: string;
  style?: "standard" | "logo";
  frameStyle?: "none" | "frame-1" | "frame-2" | "frame-3";
  logo?: string;
}

// ── Return type interfaces (stops TS4053) ─────────────────────────────────────

export interface QRAnalyticsResult {
  qrCodeId: string;
  name: string;
  totalScans: number;
  uniqueUsers: number;
  conversions: number;
  conversionRate: number;
  scansByDay: Record<string, number>;
  scansByHour: Record<number, number>;
  deviceBreakdown: Record<string, number>;
}

export interface OverallAnalyticsResult {
  totalScans: number;
  uniqueUsers: number;
  conversions: number;
  conversionRate: number;
  scansByHour: Record<number, number>;
}

export interface CompareResult {
  qrCodeId: string;
  name: string;
  totalScans: number;
  conversions: number;
  conversionRate: number;
}

export interface MessageResult {
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class QRCodeService {
  private readonly logger = new Logger(QRCodeService.name);

  constructor(
    @InjectModel(QRCode)
    private readonly qrCodeModel: typeof QRCode,

    @InjectModel(QRScan)
    private readonly qrScanModel: typeof QRScan,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private buildTrackingUrl(qrCodeId: string): string {
    const base =
      process.env.APP_URL ?? "https://twilight-cafe-backend.onrender.com";
    return `${base}/api/qrcode/${qrCodeId}/scan`;
  }

  private buildDateWhere(startDate?: Date, endDate?: Date) {
    if (!startDate && !endDate) return {};
    const createdAt: Record<string, Date> = {};
    if (startDate) createdAt[Op.gte as unknown as string] = startDate;
    if (endDate) createdAt[Op.lte as unknown as string] = endDate;
    return { createdAt };
  }

  // ─── QR Image Generation ──────────────────────────────────────────────────

  private async generateQRImage(
    url: string,
    customization?: QRCodeCustomization,
  ): Promise<string> {
    const qrBuffer = await QRCodeLib.toBuffer(url, {
      errorCorrectionLevel: "H",
      type: "png",
      width: 600,
      margin: 2,
      color: {
        dark: customization?.color ?? "#000000",
        light: customization?.backgroundColor ?? "#ffffff",
      },
    });

    let finalBuffer: Buffer = qrBuffer;

    // Logo overlay
    if (customization?.style === "logo" && customization?.logo) {
      const logoBuffer = Buffer.from(
        customization.logo.replace(/^data:image\/\w+;base64,/, ""),
        "base64",
      );
      finalBuffer = await sharp(qrBuffer)
        .composite([{ input: logoBuffer, gravity: "center" }])
        .png()
        .toBuffer();
    }

    // Frame overlay
    if (customization?.frameStyle && customization.frameStyle !== "none") {
      const framePath = `assets/frames/${customization.frameStyle}.png`;
      try {
        finalBuffer = await sharp(finalBuffer)
          .composite([{ input: framePath }])
          .png()
          .toBuffer();
      } catch {
        this.logger.warn(
          `Frame ${customization.frameStyle} not found, skipping`,
        );
      }
    }

    return `data:image/png;base64,${finalBuffer.toString("base64")}`;
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  async generateQRCode(data: CreateQRCodeInput): Promise<QRCode> {
    const qrCode = await this.qrCodeModel.create({
      name: data.name ?? `Table ${Date.now()}`,
      location: data.location ?? "Main Dining",
      customization: data.customization ?? {},
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
  }

  // ─── Bulk Create ──────────────────────────────────────────────────────────

  async generateBulkQRCodes(data: {
    tableNumbers: number[];
    location: string;
    customization?: Record<string, unknown>;
  }): Promise<QRCode[]> {
    const results: QRCode[] = [];

    for (const tableNumber of data.tableNumbers) {
      const qrCode = await this.qrCodeModel.create({
        name: `Table ${tableNumber}`,
        location: data.location,
        customization: data.customization ?? {},
        url: "",
        isActive: true,
      });

      const trackingUrl = this.buildTrackingUrl(qrCode.id);
      const qrCodeDataUrl = await this.generateQRImage(
        trackingUrl,
        data.customization as QRCodeCustomization | undefined,
      );

      await qrCode.update({ url: trackingUrl, qrCodeDataUrl });
      results.push(qrCode);
    }

    return results;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async updateQRCode(id: string, data: UpdateQRCodeInput): Promise<QRCode> {
    const qrCode = await this.getQRCode(id);

    const updatedCustomization = data.customization
      ? { ...qrCode.customization, ...data.customization }
      : qrCode.customization;

    const qrCodeDataUrl = await this.generateQRImage(
      qrCode.url,
      updatedCustomization,
    );

    await qrCode.update({
      ...data,
      customization: updatedCustomization,
      qrCodeDataUrl,
    });
    return qrCode;
  }

  // ─── Fetch ────────────────────────────────────────────────────────────────

  async getQRCode(id: string): Promise<QRCode> {
    const qr = await this.qrCodeModel.findByPk(id);
    if (!qr) throw new NotFoundException("QR code not found");
    return qr;
  }

  async getAllQRCodes(): Promise<QRCode[]> {
    return this.qrCodeModel.findAll({ order: [["createdAt", "DESC"]] });
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async deleteQRCode(id: string): Promise<MessageResult> {
    const qr = await this.getQRCode(id);
    await qr.destroy();
    return { message: "QR code deleted successfully" };
  }

  // ─── Scan Tracking ────────────────────────────────────────────────────────

  async trackScan(qrCodeId: string, scanData: TrackScanInput): Promise<void> {
    const qrCode = await this.getQRCode(qrCodeId);
    await qrCode.increment("totalScans");
    await this.qrScanModel.create({ qrCodeId, ...scanData });
  }

  async markScanAsConverted(scanId: string): Promise<MessageResult> {
    const scan = await this.qrScanModel.findByPk(scanId);
    if (!scan) throw new NotFoundException("Scan not found");
    await (scan as any).update({ converted: true });
    return { message: "Scan marked as converted" };
  }

  // ─── Per-QR Analytics ────────────────────────────────────────────────────

  async getQRAnalytics(
    id: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<QRAnalyticsResult> {
    const qrCode = await this.getQRCode(id);
    const dateWhere = this.buildDateWhere(startDate, endDate);

    const scans = await this.qrScanModel.findAll({
      where: { qrCodeId: id, ...dateWhere },
    });

    const uniqueUsers = new Set(scans.map((s) => s.userIdentifier)).size;
    const conversions = scans.filter((s) => (s as any).converted).length;
    const conversionRate =
      scans.length > 0
        ? Math.round((conversions / scans.length) * 100 * 10) / 10
        : 0;

    // Scans grouped by calendar date
    const scansByDay: Record<string, number> = {};
    scans.forEach((s) => {
      const day = new Date(s.createdAt).toISOString().split("T")[0];
      scansByDay[day] = (scansByDay[day] ?? 0) + 1;
    });

    // Scans grouped by hour-of-day
    const scansByHour: Record<number, number> = {};
    scans.forEach((s) => {
      const hour = new Date(s.createdAt).getHours();
      scansByHour[hour] = (scansByHour[hour] ?? 0) + 1;
    });

    // Device breakdown
    const deviceBreakdown: Record<string, number> = {};
    scans.forEach((s) => {
      const device = (s as any).deviceType ?? "unknown";
      deviceBreakdown[device] = (deviceBreakdown[device] ?? 0) + 1;
    });

    return {
      qrCodeId: id,
      name: qrCode.name,
      totalScans: scans.length,
      uniqueUsers,
      conversions,
      conversionRate,
      scansByDay,
      scansByHour,
      deviceBreakdown,
    };
  }

  // ─── Overall Analytics ────────────────────────────────────────────────────

  async getOverallAnalytics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<OverallAnalyticsResult> {
    const dateWhere = this.buildDateWhere(startDate, endDate);
    const scans = await this.qrScanModel.findAll({ where: { ...dateWhere } });

    const uniqueUsers = new Set(scans.map((s) => s.userIdentifier)).size;
    const conversions = scans.filter((s) => (s as any).converted).length;
    const conversionRate =
      scans.length > 0
        ? Math.round((conversions / scans.length) * 100 * 10) / 10
        : 0;

    const scansByHour: Record<number, number> = {};
    scans.forEach((s) => {
      const hour = new Date(s.createdAt).getHours();
      scansByHour[hour] = (scansByHour[hour] ?? 0) + 1;
    });

    return {
      totalScans: scans.length,
      uniqueUsers,
      conversions,
      conversionRate,
      scansByHour,
    };
  }

  // ─── Compare QR Performance ───────────────────────────────────────────────

  async compareQRPerformance(qrCodeIds: string[]): Promise<CompareResult[]> {
    const results: CompareResult[] = [];

    for (const id of qrCodeIds) {
      const qrCode = await this.getQRCode(id);
      const scans = await this.qrScanModel.findAll({ where: { qrCodeId: id } });

      const conversions = scans.filter((s) => (s as any).converted).length;
      const conversionRate =
        scans.length > 0
          ? Math.round((conversions / scans.length) * 100 * 10) / 10
          : 0;

      results.push({
        qrCodeId: id,
        name: qrCode.name,
        totalScans: scans.length,
        conversions,
        conversionRate,
      });
    }

    // Sort by totalScans descending
    return results.sort((a, b) => b.totalScans - a.totalScans);
  }

  // ─── PDF Download ─────────────────────────────────────────────────────────
  // Returns the raw base64 QR image as a simple downloadable buffer.
  // Replace with a real PDF library (pdf-lib / puppeteer) when needed.

  // Install if not already present: npm install sharp
  // sharp is already in your dependencies from QR image generation

  // Helper: collect a Node stream into a Buffer
  private streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk) =>
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
      );
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  }

  async downloadQRCodePDF(
    id: string,
    size: PDFSize = "medium",
    name?: string,
    location?: string,
  ): Promise<Buffer> {
    const qrCode = await this.getQRCode(id);

    if (!qrCode.qrCodeDataUrl) {
      throw new NotFoundException(
        "QR image not generated yet. Please generate the QR code first.",
      );
    }

    // ── Page dimensions ───────────────────────────────────────────────────
    const SIZE_MAP: Record<PDFSize, { width: number; height: number }> = {
      small: { width: 283, height: 340 }, // ~100mm × 120mm (table tent)
      medium: { width: 595, height: 842 }, // A4
      large: { width: 842, height: 1191 }, // A3
    };

    const { width, height } = SIZE_MAP[size] ?? SIZE_MAP.medium;

    // ── Decode base64 QR image ────────────────────────────────────────────
    const base64Data = qrCode.qrCodeDataUrl.replace(
      /^data:image\/\w+;base64,/,
      "",
    );
    const qrBuffer = Buffer.from(base64Data, "base64");

    // ── Resize QR to 70% of page width ───────────────────────────────────
    const qrSize = Math.round(width * 0.7);
    const resizedQR = await sharp(qrBuffer)
      .resize(qrSize, qrSize)
      .png()
      .toBuffer();

    // ── Build PDF ─────────────────────────────────────────────────────────
    const doc = new PDFDocument({
      size: [width, height],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: name ?? qrCode.name ?? "QR Code",
        Subject: "QR Code — Twilight Cafe",
      },
    });

    const xCenter = width / 2;
    const qrX = (width - qrSize) / 2;

    // White background
    doc.rect(0, 0, width, height).fill("#ffffff");

    // "SCAN TO ORDER" label — top
    const topLabelY = size === "small" ? 22 : 40;
    doc
      .font("Helvetica-Bold")
      .fontSize(size === "small" ? 8 : 11)
      .fillColor("#C4704F")
      .text("SCAN TO ORDER", 0, topLabelY, {
        width,
        align: "center",
        characterSpacing: 2,
      });

    // QR image — centred vertically with room for labels
    const labelSpace = name || location ? (size === "small" ? 55 : 80) : 20;
    const qrY = (height - qrSize - labelSpace) / 2;

    doc.image(resizedQR, qrX, qrY, { width: qrSize, height: qrSize });

    // Decorative border around QR
    doc
      .rect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8)
      .lineWidth(0.5)
      .strokeColor("#F1E4DE")
      .stroke();

    // Name
    const displayName = name || qrCode.name;
    if (displayName) {
      doc
        .font("Helvetica-Bold")
        .fontSize(size === "small" ? 11 : 16)
        .fillColor("#1f2937")
        .text(displayName, 0, qrY + qrSize + (size === "small" ? 12 : 20), {
          width,
          align: "center",
        });
    }

    // Location
    const displayLocation = location || qrCode.location;
    if (displayLocation) {
      doc
        .font("Helvetica")
        .fontSize(size === "small" ? 8 : 11)
        .fillColor("#6b7280")
        .text(displayLocation, 0, qrY + qrSize + (size === "small" ? 28 : 44), {
          width,
          align: "center",
        });
    }

    // Subtle footer
    doc
      .font("Helvetica")
      .fontSize(size === "small" ? 6 : 8)
      .fillColor("#d1d5db")
      .text(
        "Powered by Twilight Cafe",
        0,
        height - (size === "small" ? 14 : 20),
        {
          width,
          align: "center",
        },
      );

    doc.end();

    return this.streamToBuffer(doc as unknown as Readable);
  }

  // ── XML escape helper ──────────────────────────────────────────────────────
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  // ─── Bulk PDF ─────────────────────────────────────────────────────────────

  async generateBulkPDFs(
    qrCodeIds: string[],
    _size: PDFSize = "medium",
    _template: PDFTemplate = "modern",
  ): Promise<Buffer> {
    // Concatenates raw PNG buffers as a placeholder.
    // Swap for pdf-lib multi-page PDF when you add the dependency.
    const buffers: Buffer[] = [];

    for (const id of qrCodeIds) {
      const qrCode = await this.getQRCode(id);
      if (qrCode.qrCodeDataUrl) {
        const buf = Buffer.from(
          qrCode.qrCodeDataUrl.replace(/^data:image\/png;base64,/, ""),
          "base64",
        );
        buffers.push(buf);
      }
    }

    return Buffer.concat(buffers);
  }
}
