// import { Controller, Get, Query, Req, Res } from '@nestjs/common';
// import type { Request, Response } from 'express';
// import { QRCodeService } from './qrcode.service';

// @Controller()
// export class QRCodeRedirectController {
//   constructor(private readonly qrCodeService: QRCodeService) {}

//   @Get('order')
//   async redirectOrder(
//     @Query('qr') qrCodeId: string,
//     @Req() req: Request,
//     @Res() res: Response,
//   ) {
//     if (!qrCodeId) {
//       return res.status(400).send('Invalid QR code');
//     }

//     // ✅ Create a semi-stable user identifier
//     const userIdentifier = `${req.headers['user-agent'] ?? 'unknown'}-${req.ip}`;

//     try {
//       // ✅ Pass both required arguments
//       const whatsappLink = await this.qrCodeService.generateWhatsAppLink(
//         qrCodeId,
//         userIdentifier,
//       );

//       // ✅ Redirect user to WhatsApp
//       return res.redirect(302, whatsappLink);
//     } catch (error) {
//       console.error(error);
//       return res
//         .status(500)
//         .send(error instanceof Error ? error.message : 'Internal server error');
//     }
//   }
// }
