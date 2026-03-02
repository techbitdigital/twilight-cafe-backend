/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Post,
  Req,
  Headers,
  BadRequestException,
} from "@nestjs/common";
import type { Request } from "express";
import * as crypto from "crypto";
import { PaystackService } from "./paystack.service";
import { OrdersService } from "../modules/orders/orders.service";

@Controller("api/payments")
export class PaymentsController {
  constructor(
    private readonly paystackService: PaystackService,
    private readonly ordersService: OrdersService,
  ) {}

  @Post("webhook")
  async handleWebhook(
    @Req() req: Request,
    @Headers("x-paystack-signature") signature: string,
  ) {
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== signature) {
      throw new BadRequestException("Invalid signature");
    }

    const event = req.body;

    if (event.event === "charge.success") {
      const reference = event.data.reference;
      const orderId = event.data.metadata?.orderId;

      // Verify transaction with Paystack
      const verification =
        await this.paystackService.verifyTransaction(reference);

      if (verification.data.status === "success") {
        await this.ordersService.updateOrderStatus(orderId, "paid");
      }
    }

    return { received: true };
  }
}
