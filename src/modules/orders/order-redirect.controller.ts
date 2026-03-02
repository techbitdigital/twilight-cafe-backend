// import { Controller, Get, Query, Req, Res } from '@nestjs/common';
// import type { Response, Request } from 'express'; // <-- use Express types
// import { QRCodeService } from '../qrcode/qrcode.service';

// @Controller()
// export class OrderRedirectController {
//   constructor(private readonly qrCodeService: QRCodeService) {}

//   @Get('order')
//   async redirectToWhatsApp(
//     @Query('qr') qrCodeId: string,
//     @Req() req: Request, // <-- express Request
//     @Res() res: Response,
//   ) {
//     if (!qrCodeId) {
//       return res.status(400).send('Invalid QR code');
//     }

//     // Use req.ip from Express
//     const userIdentifier = `${req.headers['user-agent']}-${req.ip}`;

//     const whatsappLink = await this.qrCodeService.generateWhatsAppLink(
//       qrCodeId,
//       userIdentifier,
//     );

//     return res.redirect(302, whatsappLink);
//   }
// }
