/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import * as express from "express";
import * as path from "path";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── CORS — must be first before anything else ──────────────────────────
  const allowedOrigins = process.env.CORS_ORIGINS?.split(",").map((o) =>
    o.trim(),
  ) ?? ["http://localhost:3000", "http://localhost:5173"];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, mobile apps, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        console.warn(`[CORS] Allowed origins: ${allowedOrigins.join(", ")}`);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
    ],
    optionsSuccessStatus: 204,
  });

  // ── Global validation pipe ─────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── Static file serving — absolute path works in any environment ───────
  app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
  app.use(
    "/uploads/menu-items",
    express.static(path.join(__dirname, "..", "uploads", "menu-items")),
  );
  app.use(
    "/uploads/qr-codes",
    express.static(path.join(__dirname, "..", "uploads", "qr-codes")),
  );

  // ── Port — PASSENGER_PORT must take priority ───────────────────────────
  // Passenger assigns a random port via PASSENGER_PORT
  // If we don't use it, Passenger cannot proxy requests to the app
  const port = process.env.PASSENGER_PORT
    ? parseInt(process.env.PASSENGER_PORT, 10)
    : parseInt(process.env.PORT ?? "4500", 10);

  await app.listen(port, "0.0.0.0");

  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`✅ Allowed CORS origins: ${allowedOrigins.join(", ")}`);
}

void bootstrap();
