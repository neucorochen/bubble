import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { uploadUrlSchema } from "@commune/shared";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { asyncHandler } from "./utils/errors.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { noStore, originGuard } from "./middleware/security.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { lemonSqueezyWebhook, rawBody } from "./controllers/paymentController.js";
import { router } from "./routes/index.js";
import { getObject } from "./services/storageService.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Needed for correct client IPs (rate limiting) behind reverse proxies. Set TRUST_PROXY to
  // the number of proxies in front of the API (2 for a Vercel rewrite in front of Render).
  app.set("trust proxy", env.TRUST_PROXY);

  // Only method, path (no query string) and status are logged. The default serializers would
  // write every request header (cookies, tokens, client IPs) to the log on every call.
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: (req: { id?: unknown; method?: string; url?: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        }),
        res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
      },
      autoLogging: { ignore: (req) => req.url === "/api/health" },
    }),
  );
  app.use((req, res, next) => {
    res.set("X-Request-Id", String(req.id));
    next();
  });
  app.use(
    helmet({
      // The web app runs on another origin and must be allowed to display uploaded images.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(globalLimiter);

  // Uploaded images. File names are random, so they can be cached for a long time.
  // Helmet already sets X-Content-Type-Options: nosniff on these responses.

  app.get(
    "/uploads/:file",
    asyncHandler(async (req, res) => {
      const file = req.params.file ?? "";

      if (!uploadUrlSchema.safeParse(`/uploads/${file}`).success) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      let object;

      try {
        object = await getObject(`uploads/${file}`);
      } catch (err) {
        const isNotFound =
          err instanceof Error &&
          (err.name === "NoSuchKey" ||
            err.name === "NotFound" ||
            (err as Error & {
              $metadata?: { httpStatusCode?: number };
            }).$metadata?.httpStatusCode === 404);

        if (isNotFound) {
          res.status(404).json({ error: "Not found" });
          return;
        }

        throw err;
      }

      if (!object.Body) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      if (object.ContentType) {
        res.setHeader("Content-Type", object.ContentType);
      }

      if (object.ContentLength !== undefined) {
        res.setHeader("Content-Length", String(object.ContentLength));
      }

      res.setHeader("Cache-Control", "public, max-age=2592000, immutable");

      object.Body.pipe(res);
    }),
  );


  // The payment webhook needs the raw bytes to check the provider's signature, so it is
  // registered before the JSON parser.
  app.post("/api/webhooks/lemonsqueezy", rawBody, asyncHandler(lemonSqueezyWebhook));

  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());

  // API answers carry personal data and tokens: never let a browser or proxy cache them. Handlers
  // that are meant to be cached (the news feed) set their own Cache-Control afterwards.
  app.use("/api", noStore, originGuard, router);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
