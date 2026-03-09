import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseArrayPipe,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import { QRCodeService } from "./qrcode.service";
import type { PDFSize, PDFTemplate } from "./qrcode.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import type { CreateQRCodeInput } from "./dto/generate-qr.dto";
import type { UpdateQRCodeInput } from "./dto/update-qrcode.dto";

@Controller("api/qrcode")
export class QRCodeController {
  constructor(private readonly qrCodeService: QRCodeService) {}

  // ─── Admin — CRUD ─────────────────────────────────────────────────────────

  // POST /api/qrcode
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  generateQRCode(@Body() data: CreateQRCodeInput) {
    return this.qrCodeService.generateQRCode(data);
  }

  // POST /api/qrcode/bulk
  @Post("bulk")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  generateBulkQRCodes(
    @Body()
    data: {
      tableNumbers: number[];
      location: string;
      customization?: Record<string, unknown>;
    },
  ) {
    return this.qrCodeService.generateBulkQRCodes(data);
  }

  // GET /api/qrcode
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  getAllQRCodes() {
    return this.qrCodeService.getAllQRCodes();
  }

  // GET /api/qrcode/:id
  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  getQRCode(@Param("id") id: string) {
    return this.qrCodeService.getQRCode(id);
  }

  // PUT /api/qrcode/:id
  @Put(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  updateQRCode(@Param("id") id: string, @Body() data: UpdateQRCodeInput) {
    return this.qrCodeService.updateQRCode(id, data);
  }

  // DELETE /api/qrcode/:id
  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  deleteQRCode(@Param("id") id: string) {
    return this.qrCodeService.deleteQRCode(id);
  }

  // ─── Admin — PDF ──────────────────────────────────────────────────────────
  // GET /api/qrcode/:id/pdf
  @Get(":id/pdf")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async generatePDF(
    @Param("id") id: string,
    @Query("size", new DefaultValuePipe("medium")) size: PDFSize,
    @Query("template", new DefaultValuePipe("modern")) template: string,
    @Query("name", new DefaultValuePipe("")) name: string,
    @Query("location", new DefaultValuePipe("")) location: string,
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer = await this.qrCodeService.downloadQRCodePDF(
        id,
        size,
        name || undefined,
        location || undefined,
      );

      const filename = encodeURIComponent(name || `qr-${id}`) + ".pdf";

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length,
      });
      return res.send(pdfBuffer);
    } catch (error) {
      return res.status(400).json({
        message: "Failed to generate PDF",
        error: String(error),
      });
    }
  }

  @Get(":id/download/pdf")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async downloadPDF(
    @Param("id") id: string,
    @Query("size", new DefaultValuePipe("medium")) size: PDFSize,
    @Query("name", new DefaultValuePipe("")) name: string,
    @Query("location", new DefaultValuePipe("")) location: string,
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer = await this.qrCodeService.downloadQRCodePDF(
        id,
        size,
        name || undefined,
        location || undefined,
      );

      const filename = encodeURIComponent(name || `qr-${id}`) + ".pdf";

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length,
      });
      return res.send(pdfBuffer);
    } catch (error) {
      return res.status(400).json({
        message: "Failed to download PDF",
        error: String(error),
      });
    }
  }

  // POST /api/qrcode/pdf/bulk
  @Post("pdf/bulk")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async generateBulkPDFs(
    @Body("qrCodeIds", new ParseArrayPipe({ items: String }))
    qrCodeIds: string[],
    @Body("size", new DefaultValuePipe("medium")) size: PDFSize,
    @Body("template", new DefaultValuePipe("modern")) template: PDFTemplate,
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer = await this.qrCodeService.generateBulkPDFs(
        qrCodeIds,
        size,
        template,
      );

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="qr-codes-bulk.pdf"',
        "Content-Length": pdfBuffer.length,
      });

      return res.send(pdfBuffer);
    } catch (error) {
      return res.status(400).json({
        message: "Failed to generate bulk PDF",
        error: String(error),
      });
    }
  }

  // ─── Admin — Analytics ────────────────────────────────────────────────────

  // GET /api/qrcode/analytics/overall
  // ⚠️  Must be declared BEFORE ":id/analytics" so NestJS doesn't treat
  //     "analytics" as an :id param
  @Get("analytics/overall")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  getOverallAnalytics(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.qrCodeService.getOverallAnalytics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  // GET /api/qrcode/:id/analytics
  @Get(":id/analytics")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  getQRAnalytics(
    @Param("id") id: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.qrCodeService.getQRAnalytics(
      id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  // POST /api/qrcode/analytics/compare
  @Post("analytics/compare")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  compareQRPerformance(
    @Body("qrCodeIds", new ParseArrayPipe({ items: String }))
    qrCodeIds: string[],
  ) {
    return this.qrCodeService.compareQRPerformance(qrCodeIds);
  }

  // ─── Public ───────────────────────────────────────────────────────────────

  // GET /api/qrcode/:id/scan  (customer scans the physical QR)
  @Get(":id/scan")
  async scanAndRedirect(@Param("id") id: string, @Res() res: Response) {
    try {
      await this.qrCodeService.trackScan(id, {
        userIdentifier: "anonymous",
        deviceType: "unknown",
      });
    } catch (error) {
      this.logger.error(`Scan tracking failed for ${id}`, error);
    }

    return res.redirect(
      "https://twilight-cafe-frontend.onrender.com/menu-list/",
    );
  }

  // PUT /api/qrcode/scan/:scanId/convert
  @Put("scan/:scanId/convert")
  @HttpCode(HttpStatus.OK)
  markScanAsConverted(@Param("scanId") scanId: string) {
    return this.qrCodeService.markScanAsConverted(scanId);
  }

  // ─── Private ──────────────────────────────────────────────────────────────
  private readonly logger = new Logger(QRCodeController.name);
}
