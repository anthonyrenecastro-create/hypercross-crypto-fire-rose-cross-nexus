import type { IncomingMessage, ServerResponse } from "http";
import {
  getByEmail,
  getByPhone,
  normalizeEmail,
  normalizePhone,
  touchLogin,
  verifyPassword,
} from "./_store";

async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.writeHead(405);
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  try {
    const body = await readBody(req);
    const method = body?.method === "phone" ? "phone" : "email";
    const email = normalizeEmail(body?.emailOrSubAccount);
    const phone = normalizePhone(body?.phoneNumber);
    const password = String(body?.password || "");

    if (!password) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: "Password is required." }));
    }

    const user = method === "email"
      ? (email ? getByEmail(email) : null)
      : (phone ? getByPhone(phone) : null);

    if (!user) {
      res.writeHead(401);
      return res.end(JSON.stringify({ error: "Invalid credentials." }));
    }

    if (!verifyPassword(password, String(user.passwordHash))) {
      res.writeHead(401);
      return res.end(JSON.stringify({ error: "Invalid credentials." }));
    }

    touchLogin(String(user.id));
    res.writeHead(200);
    return res.end(JSON.stringify({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        method,
      },
    }));
  } catch (error) {
    console.error("Signin error:", error);
    res.writeHead(500);
    return res.end(JSON.stringify({ error: "Unable to sign in." }));
  }
}
