/**
 * Production authentication routes (PostgreSQL-backed).
 * Mounted only when DATABASE_URL is configured (see server.ts).
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  registerUser,
  loginUser,
  refreshSession,
  revokeRefreshToken,
} from "./ProductionAuthService";
import { requireProductionAuth, loadAuthenticatedUser, type ProductionAuthedRequest } from "./productionMiddleware";
import { recordAuditEvent } from "../audit/AuditService";

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } },
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export const productionAuthRouter = Router();

productionAuthRouter.post("/register", authRateLimit, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid request." } });
  }
  try {
    const { user, tokens } = await registerUser(parsed.data);
    await recordAuditEvent({ userId: user.id, action: "register_success" });
    return res.status(201).json({ user, ...tokens });
  } catch (error: any) {
    return res.status(400).json({ error: { code: "INVALID_REQUEST", message: error?.message ?? "Registration failed." } });
  }
});

productionAuthRouter.post("/login", authRateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid request." } });
  }
  try {
    const deviceInformation = String(req.headers["user-agent"] ?? "").slice(0, 300);
    const { user, tokens } = await loginUser({ ...parsed.data, deviceInformation });
    await recordAuditEvent({ userId: user.id, action: "login_success", metadata: { deviceInformation } });
    return res.json({ user, ...tokens });
  } catch (error: any) {
    await recordAuditEvent({ action: "login_failure", metadata: { email: parsed.data.email } });
    return res.status(401).json({ error: { code: "AUTH_INVALID", message: "Invalid email or password." } });
  }
});

productionAuthRouter.post("/refresh", authRateLimit, async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "refreshToken is required." } });
  }
  try {
    const { user, tokens } = await refreshSession(parsed.data.refreshToken);
    await recordAuditEvent({ userId: user.id, action: "session_refreshed" });
    return res.json({ user, ...tokens });
  } catch (error: any) {
    return res.status(401).json({ error: { code: "AUTH_INVALID", message: error?.message ?? "Unable to refresh session." } });
  }
});

productionAuthRouter.post("/logout", async (req, res) => {
  const refreshToken = req.body?.refreshToken;
  if (typeof refreshToken === "string" && refreshToken.length > 0) {
    await revokeRefreshToken(refreshToken);
  }
  await recordAuditEvent({ action: "logout" });
  return res.json({ ok: true });
});

productionAuthRouter.get("/me", requireProductionAuth, async (req: ProductionAuthedRequest, res) => {
  const user = await loadAuthenticatedUser(req);
  if (!user) return res.status(404).json({ error: { code: "AUTH_INVALID", message: "User not found." } });
  return res.json({ user });
});
