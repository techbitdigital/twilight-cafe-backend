// /* eslint-disable @typescript-eslint/no-unsafe-assignment */
// /* eslint-disable @typescript-eslint/no-unsafe-member-access */

// import { Injectable, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import twilio, { Twilio } from 'twilio';

// export interface SendWhatsAppMessageDto {
//   to: string;
//   message: string;
// }

// @Injectable()
// export class WhatsAppNotificationService {
//   private readonly logger = new Logger(WhatsAppNotificationService.name);
//   private readonly twilioClient: Twilio | null;
//   private readonly isEnabled: boolean;

//   constructor(private readonly configService: ConfigService) {
//     const enabled = this.configService.get<string>('WHATSAPP_ENABLED');
//     this.isEnabled = enabled === 'true';

//     if (!this.isEnabled) {
//       this.logger.log('ℹ️ WhatsApp messaging disabled');
//       this.twilioClient = null;
//       return;
//     }

//     const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
//     const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

//     if (!accountSid || !authToken) {
//       this.logger.warn('⚠️ Missing Twilio credentials');
//       this.isEnabled = false;
//       this.twilioClient = null;
//       return;
//     }

//     this.twilioClient = twilio(accountSid, authToken);
//     this.logger.log('✅ Twilio WhatsApp initialized');
//   }

//   async sendMessage(data: SendWhatsAppMessageDto) {
//     if (!this.isEnabled || !this.twilioClient) {
//       return { success: false, error: 'WhatsApp disabled' };
//     }

//     const from = this.configService.get<string>('TWILIO_WHATSAPP_FROM');
//     const to = data.to.startsWith('whatsapp:')
//       ? data.to
//       : `whatsapp:${data.to}`;

//     try {
//       const message = await this.twilioClient.messages.create({
//         from,
//         to,
//         body: data.message,
//       });

//       return { success: true, messageId: message.sid };
//     } catch (error: any) {
//       this.logger.error(error.message);
//       return { success: false, error: error.message };
//     }
//   }

//   notifyCustomer(phone: string, message: string) {
//     return this.sendMessage({ to: phone, message });
//   }

//   notifyCafeStaff(message: string) {
//     const staffNumber = this.configService.get<string>(
//       'WHATSAPP_BUSINESS_NUMBER',
//     );

//     if (!staffNumber) {
//       return { success: false, error: 'Staff number not set' };
//     }

//     return this.sendMessage({ to: staffNumber, message });
//   }
// }
