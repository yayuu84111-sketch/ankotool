import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";

const SessionStore = MemoryStore(session);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Simple session setup for admin auth
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "default_secret",
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 86400000 },
      store: new SessionStore({
        checkPeriod: 86400000,
      }),
    })
  );

  app.post(api.captures.create.path, async (req, res) => {
    try {
      const input = api.captures.create.input.parse(req.body);
      const capture = await storage.createCapture(input);
      res.status(201).json(capture);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.get(api.captures.list.path, async (req, res) => {
    // Check for admin session
    if (!(req.session as any).isAdmin) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const captures = await storage.getCaptures();
    res.json(captures);
  });

  app.post(api.auth.login.path, async (req, res) => {
    const { password } = req.body;
    // Hardcoded password as requested by user
    if (password === "aa119289621") {
      (req.session as any).isAdmin = true;
      res.json({ success: true });
    } else {
      res.status(401).json({ message: "Invalid password" });
    }
  });

  return httpServer;
}
