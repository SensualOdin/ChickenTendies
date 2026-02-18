import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Serve the OAuth callback page for native app deep-link redirect
  app.get("/auth/callback", (_req, res) => {
    const callbackPath = path.resolve(distPath, "auth/callback.html");
    if (fs.existsSync(callbackPath)) {
      res.sendFile(callbackPath);
    } else {
      res.sendFile(path.resolve(distPath, "index.html"));
    }
  });

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
