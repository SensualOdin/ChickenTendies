import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startCleanupScheduler } from "./cleanup";
import { startScheduledNotifications } from "./scheduled-notifications";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// CORS — allow frontend origin, localhost dev, and native Capacitor apps
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "capacitor://localhost",
  "https://localhost",
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, health checks, curl).
    // Note: Capacitor iOS/Android send "capacitor://localhost" or "https://localhost"
    // explicitly, so the no-origin case is not needed for native apps.
    if (!origin) return callback(null, true);
    // Exact-match only — prefix matching allows e.g. "capacitor://localhost.evil.com"
    // to bypass the allowlist.
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Member-Bindings", "X-CSRF-Token"],
  exposedHeaders: ["X-Member-Bindings"],
}));

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));
const cookieSecret = process.env.COOKIE_SECRET;
// Require COOKIE_SECRET everywhere except explicit development mode. Previously
// this allowed a hardcoded "dev-secret" fallback whenever NODE_ENV wasn't
// "production", which silently degraded security if NODE_ENV was unset in staging.
if (!cookieSecret && process.env.NODE_ENV !== "development") {
  throw new Error("COOKIE_SECRET environment variable is required");
}
app.use(cookieParser(cookieSecret || "chickentinders-dev-secret-DO-NOT-USE-IN-PROD"));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const SENSITIVE_KEYS = new Set([
          "leaderToken",
          "token",
          "accessToken",
          "refreshToken",
          "supabaseToken",
          "apiKey",
          "password",
          "secret",
          "sessionId",
          "cookie",
          "authorization",
          "memberBindings",
        ]);
        const redactSensitive = (obj: any): any => {
          if (obj === null || typeof obj !== 'object') return obj;
          if (Array.isArray(obj)) return obj.map(redactSensitive);
          const result: any = {};
          for (const key of Object.keys(obj)) {
            if (SENSITIVE_KEYS.has(key)) {
              result[key] = "[REDACTED]";
            } else {
              result[key] = redactSensitive(obj[key]);
            }
          }
          return result;
        };
        logLine += ` :: ${JSON.stringify(redactSensitive(capturedJsonResponse))}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Register WebSocket upgrade handler AFTER Vite so Vite's HMR
  // handler is already attached and handles /vite-hmr upgrades first
  const { appWss } = await import("./routes");
  if (appWss) {
    httpServer.on("upgrade", (request, socket, head) => {
      if (request.url?.startsWith("/ws")) {
        appWss.handleUpgrade(request, socket, head, (ws) => {
          appWss.emit("connection", ws, request);
        });
      }
    });
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
      startCleanupScheduler();
      startScheduledNotifications();
    },
  );
})();
