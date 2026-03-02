/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
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
  DefaultValuePipe,
  ParseArrayPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import * as qrcodeService from './qrcode.service';
import type { PDFSize } from './qrcode.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

import type { CreateQRCodeInput } from './dto/generate-qr.dto';
import type { UpdateQRCodeInput } from './dto/update-qrcode.dto';

@Controller('api/qrcode')
export class QRCodeController {
  constructor(private readonly qrCodeService: qrcodeService.QRCodeService) {}

  // =========================
  // ADMIN ROUTES
  // =========================

  /**
   * Generate a single QR code
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  generateQRCode(@Body() data: CreateQRCodeInput) {
    return this.qrCodeService.generateQRCode(data);
  }

  /**
   * Generate multiple QR codes
   */
  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
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

  @Get(':id/download/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async downloadPDF(
    @Param('id') id: string,
    @Query('size') size: PDFSize = 'medium',
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer = await this.qrCodeService.downloadQRCodePDF(id, size);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="qr-${id}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.send(pdfBuffer);
    } catch (error) {
      res.status(400).json({
        message: 'Failed to download QR code PDF',
        error: String(error),
      });
    }
  }

  /**
   * Get all QR codes (optional filters)
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getAllQRCodes(
    @Query('location') location?: string,
    @Query('isActive') isActive?: string, // keep as string
  ) {
    // Convert string to boolean if provided
    let active: boolean | undefined = undefined;
    if (isActive !== undefined) {
      active = isActive.toLowerCase() === 'true';
    }

    return this.qrCodeService.getAllQRCodes({
      location,
      isActive: active,
    });
  }

  /**
   * Get QR codes by location
   */
  @Get('location/:location')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getQRCodesByLocation(@Param('location') location: string) {
    return this.qrCodeService.getQRCodesByLocation(location);
  }

  /**
   * Get single QR code
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getQRCode(@Param('id') id: string) {
    return this.qrCodeService.getQRCode(id);
  }

  /**
   * Update QR code
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateQRCode(@Param('id') id: string, @Body() data: UpdateQRCodeInput) {
    return this.qrCodeService.updateQRCode(id, data);
  }

  /**
   * Toggle QR code active status
   */
  @Put(':id/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  toggleQRCodeStatus(@Param('id') id: string) {
    return this.qrCodeService.toggleQRCodeStatus(id);
  }

  /**
   * Delete QR code
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  deleteQRCode(@Param('id') id: string) {
    return this.qrCodeService.deleteQRCode(id);
  }

  // =========================
  // PDF GENERATION
  // =========================

  /**
   * Generate PDF for single QR code
   */
  @Get(':id/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async generatePDF(
    @Param('id') id: string,
    @Query('size', new DefaultValuePipe('medium')) size: qrcodeService.PDFSize,
    @Query('template', new DefaultValuePipe('modern'))
    template: qrcodeService.PDFTemplate,
    @Res() res: Response,
  ) {
    const [pdfBuffer, qrCode] = await Promise.all([
      this.qrCodeService.generatePDF(id, size, template),
      this.qrCodeService.getQRCode(id),
    ]);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${qrCode.name}-qr.pdf"`,
    );

    return res.send(pdfBuffer);
  }

  /**
   * Generate bulk PDF
   */
  @Post('pdf/bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  generateBulkPDFs(
    @Body('qrCodeIds', new ParseArrayPipe({ items: String }))
    qrCodeIds: string[],
    @Body('size', new DefaultValuePipe('medium')) size: qrcodeService.PDFSize,
    @Body('template', new DefaultValuePipe('modern'))
    template: qrcodeService.PDFTemplate,
    @Res() res: Response,
  ) {
    const pdfBuffer = this.qrCodeService.generateBulkPDFs(
      qrCodeIds,
      size,
      template,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="qr-codes-bulk.pdf"',
    );

    return res.send(pdfBuffer);
  }

  // =========================
  // ANALYTICS
  // =========================

  /**
   * QR code analytics
   */
  @Get(':id/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getQRAnalytics(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.qrCodeService.getQRAnalytics(
      id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Overall analytics
   */
  @Get('analytics/overall')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getOverallAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.qrCodeService.getOverallAnalytics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Compare performance
   */
  @Post('analytics/compare')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  compareQRPerformance(
    @Body('qrCodeIds', new ParseArrayPipe({ items: String }))
    qrCodeIds: string[],
  ) {
    return this.qrCodeService.compareQRPerformance(qrCodeIds);
  }

  // =========================
  // PUBLIC ROUTES
  // =========================

  /**
   * Track scan
   */
  @Get(':id/scan')
  async scanAndRedirect(@Param('id') id: string, @Res() res: Response) {
    await this.qrCodeService.trackScan(id, {
      userIdentifier: 'anonymous',
      deviceType: 'unknown',
    });

    return res.redirect('https://twilightcafe.com.ng/menu-list');
  }

  /**
   * Mark scan as converted
   */
  @Put('scan/:scanId/convert')
  markScanAsConverted(@Param('scanId') scanId: string) {
    return this.qrCodeService.markScanAsConverted(scanId);
  }
}
