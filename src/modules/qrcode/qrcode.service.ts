/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
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

  // ✅ Reusable duplicate name check — throws ConflictException if taken,
  //    optionally excluding a specific ID (used during updates).
  private async assertNameUnique(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const where: Record<string, unknown> = { name };
    if (excludeId) where.id = { [Op.ne]: excludeId };

    const existing = await this.qrCodeModel.findOne({ where });
    if (existing) {
      throw new ConflictException(
        `A QR code named "${name}" already exists. Please choose a different name.`,
      );
    }
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
    // ✅ Validation: name is required
    if (!data.name || data.name.trim().length === 0) {
      throw new BadRequestException("QR code name is required.");
    }

    // ✅ Validation: duplicate name check
    await this.assertNameUnique(data.name.trim());

    const qrCode = await this.qrCodeModel.create({
      name: data.name.trim(),
      location: data.location?.trim() ?? "Main Dining",
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
    // ✅ Validation: tableNumbers must be a non-empty array
    if (!Array.isArray(data.tableNumbers) || data.tableNumbers.length === 0) {
      throw new BadRequestException("At least one table number is required.");
    }

    // ✅ Validation: no duplicate table numbers in the request itself
    const unique = new Set(data.tableNumbers);
    if (unique.size !== data.tableNumbers.length) {
      throw new BadRequestException(
        "Duplicate table numbers found in the request.",
      );
    }

    // ✅ Validation: check ALL names upfront before creating any,
    //    so we don't create partial sets if one name is taken.
    for (const tableNumber of data.tableNumbers) {
      await this.assertNameUnique(`Table ${tableNumber}`);
    }

    const results: QRCode[] = [];

    for (const tableNumber of data.tableNumbers) {
      const qrCode = await this.qrCodeModel.create({
        name: `Table ${tableNumber}`,
        location: data.location?.trim() ?? "Main Dining",
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
    // ✅ Validation: if name is being changed, check it's not already taken
    //    by another QR code (excludeId ensures the QR can keep its own name).
    if (data.name !== undefined) {
      if (data.name.trim().length === 0) {
        throw new BadRequestException("QR code name cannot be empty.");
      }
      await this.assertNameUnique(data.name.trim(), id);
    }

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
      ...(data.name && { name: data.name.trim() }),
      customization: updatedCustomization,
      qrCodeDataUrl,
    });

    return qrCode;
  }

  // ─── Fetch ────────────────────────────────────────────────────────────────

  async getQRCode(id: string): Promise<QRCode> {
    // ✅ Validation: id must be provided
    if (!id || id.trim().length === 0) {
      throw new BadRequestException("QR code ID is required.");
    }
    const qr = await this.qrCodeModel.findByPk(id);
    if (!qr) throw new NotFoundException(`QR code with ID "${id}" not found.`);
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

    // ✅ Validation: don't track scans for inactive QR codes
    if (!qrCode.isActive) {
      throw new BadRequestException("This QR code is no longer active.");
    }

    await qrCode.increment("totalScans");
    await this.qrScanModel.create({ qrCodeId, ...scanData });
  }

  async markScanAsConverted(scanId: string): Promise<MessageResult> {
    if (!scanId || scanId.trim().length === 0) {
      throw new BadRequestException("Scan ID is required.");
    }
    const scan = await this.qrScanModel.findByPk(scanId);
    if (!scan)
      throw new NotFoundException(`Scan with ID "${scanId}" not found.`);
    await (scan as any).update({ converted: true });
    return { message: "Scan marked as converted" };
  }

  // ─── Per-QR Analytics ────────────────────────────────────────────────────

  async getQRAnalytics(
    id: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<QRAnalyticsResult> {
    // ✅ Validation: date range sanity check
    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException("startDate must be before endDate.");
    }

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

    const scansByDay: Record<string, number> = {};
    scans.forEach((s) => {
      const day = new Date(s.createdAt).toISOString().split("T")[0];
      scansByDay[day] = (scansByDay[day] ?? 0) + 1;
    });

    const scansByHour: Record<number, number> = {};
    scans.forEach((s) => {
      const hour = new Date(s.createdAt).getHours();
      scansByHour[hour] = (scansByHour[hour] ?? 0) + 1;
    });

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
    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException("startDate must be before endDate.");
    }

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
    // ✅ Validation: at least 2 QR codes needed for a meaningful comparison
    if (!Array.isArray(qrCodeIds) || qrCodeIds.length < 2) {
      throw new BadRequestException(
        "At least 2 QR code IDs are required for comparison.",
      );
    }

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

    return results.sort((a, b) => b.totalScans - a.totalScans);
  }

  // ─── PDF Download ─────────────────────────────────────────────────────────

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  // ✅ Fix: start collecting the stream BEFORE calling doc.end().
  //    The original code called doc.end() first, then passed the stream to
  //    streamToBuffer — on a fast/synchronous flush, 'data' and 'end' events
  //    fire before listeners are attached, producing an empty/corrupt buffer.
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
    // ✅ Validation: size must be a recognised value
    const validSizes: PDFSize[] = ["small", "medium", "large"];
    if (!validSizes.includes(size)) {
      throw new BadRequestException(
        `Invalid size "${size}". Valid options: ${validSizes.join(", ")}.`,
      );
    }

    const qrCode = await this.getQRCode(id);

    if (!qrCode.qrCodeDataUrl) {
      throw new NotFoundException(
        "QR image not generated yet. Please generate the QR code first.",
      );
    }

    const SIZE_MAP: Record<PDFSize, { width: number; height: number }> = {
      small: { width: 283, height: 340 },
      medium: { width: 595, height: 842 },
      large: { width: 842, height: 1191 },
    };

    const { width, height } = SIZE_MAP[size];

    const base64Data = qrCode.qrCodeDataUrl.replace(
      /^data:image\/\w+;base64,/,
      "",
    );
    const qrBuffer = Buffer.from(base64Data, "base64");

    const qrSize = Math.round(width * 0.7);
    const resizedQR = await sharp(qrBuffer)
      .resize(qrSize, qrSize)
      .png()
      .toBuffer();

    const doc = new PDFDocument({
      size: [width, height],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: name ?? qrCode.name ?? "QR Code",
        Subject: "QR Code — Twilight Cafe",
      },
    });

    // ✅ Fix: register listeners on the stream BEFORE calling doc.end()
    //    so no data events are missed. Previously doc.end() was called first,
    //    which caused the buffer to be empty/corrupt on fast machines.
    const bufferPromise = this.streamToBuffer(doc as unknown as Readable);

    const xCenter = width / 2;
    const qrX = (width - qrSize) / 2;

    doc.rect(0, 0, width, height).fill("#ffffff");

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

    const labelSpace = name || location ? (size === "small" ? 55 : 80) : 20;
    const qrY = (height - qrSize - labelSpace) / 2;

    doc.image(resizedQR, qrX, qrY, { width: qrSize, height: qrSize });

    doc
      .rect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8)
      .lineWidth(0.5)
      .strokeColor("#F1E4DE")
      .stroke();

    const displayName = name ?? qrCode.name;
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

    const displayLocation = location ?? qrCode.location;
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

    // ✅ doc.end() called AFTER listeners are set up
    doc.end();

    return bufferPromise;
  }

  // ─── Bulk PDF ─────────────────────────────────────────────────────────────

  async generateBulkPDFs(
    qrCodeIds: string[],
    _size: PDFSize = "medium",
    _template: PDFTemplate = "modern",
  ): Promise<Buffer> {
    // ✅ Validation: at least one ID required
    if (!Array.isArray(qrCodeIds) || qrCodeIds.length === 0) {
      throw new BadRequestException("At least one QR code ID is required.");
    }

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

    if (buffers.length === 0) {
      throw new NotFoundException(
        "None of the provided QR codes have generated images yet.",
      );
    }

    return Buffer.concat(buffers);
  }
}
