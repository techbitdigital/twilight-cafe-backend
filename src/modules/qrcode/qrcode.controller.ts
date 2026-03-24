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
  // ✅ Fix 3: logger declared at the top so it's available to all methods
  private readonly logger = new Logger(QRCodeController.name);

  constructor(private readonly qrCodeService: QRCodeService) {}

  // ─── Admin — CRUD ─────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  generateQRCode(@Body() data: CreateQRCodeInput) {
    return this.qrCodeService.generateQRCode(data);
  }

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

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  getAllQRCodes() {
    return this.qrCodeService.getAllQRCodes();
  }

  // ─── Admin — Analytics ────────────────────────────────────────────────────
  // ⚠️ Static routes MUST come before parameterised routes (:id/...) so NestJS
  //    doesn't treat the static segment (e.g. "analytics") as an :id value.

  // GET /api/qrcode/analytics/overall
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

  // ─── Admin — PDF ──────────────────────────────────────────────────────────
  // ⚠️ Also declared before :id routes for the same reason.

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
    // ✅ Fix 1: no try/catch — let NestJS exception filters handle
    //    BadRequestException and NotFoundException with their correct
    //    HTTP status codes (400, 404). The old catch block forced
    //    every error to 400, losing meaningful status codes.
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
  }

  // ─── Admin — per-ID routes ────────────────────────────────────────────────

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

  // GET /api/qrcode/:id/pdf
  //    — it was identical to this handler. One canonical download endpoint
  //    is cleaner and avoids maintaining two routes that must stay in sync.
  @Get(":id/pdf")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async downloadQRCodePDF(
    @Param("id") id: string,
    @Query("size", new DefaultValuePipe("medium")) size: PDFSize,
    @Query("name", new DefaultValuePipe("")) name: string,
    @Query("location", new DefaultValuePipe("")) location: string,
    @Res() res: Response,
  ) {
    // ✅ Fix 1: no try/catch — NestJS will correctly return 404 for a missing
    //    QR code, 400 for an invalid size, etc. with the right status codes.
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

  // ─── Public ───────────────────────────────────────────────────────────────

  // GET /api/qrcode/:id/scan  (customer scans the physical QR code)
  @Get(":id/scan")
  async scanAndRedirect(@Param("id") id: string, @Res() res: Response) {
    try {
      await this.qrCodeService.trackScan(id, {
        userIdentifier: "anonymous",
        deviceType: "unknown",
      });
    } catch (error) {
      // ✅ Intentionally swallowed: a failed scan track must never block
      //    the customer redirect. Log it for observability only.
      this.logger.error(`Scan tracking failed for QR ${id}`, error);
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
}
