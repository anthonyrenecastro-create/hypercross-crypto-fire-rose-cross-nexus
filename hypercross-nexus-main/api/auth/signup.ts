import type { IncomingMessage, ServerResponse } from "http";
import {
  createUser,
  getByEmail,
  getByPhone,
  hashPassword,
  normalizeEmail,
  normalizePhone,
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

    if (password.length < 8) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: "Password must be at least 8 characters." }));
    }

    if (method === "email") {
      if (!email) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: "Email is required." }));
      }

      if (getByEmail(email)) {
        res.writeHead(409);
        return res.end(JSON.stringify({ error: "An account with that email already exists." }));
      }

      const created = createUser({ email, phone: null, passwordHash: hashPassword(password) });
      res.writeHead(201);
      return res.end(JSON.stringify({ ok: true, user: { id: created.id, email, method: "email" } }));
    }

    if (!phone) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: "Phone number is required." }));
    }

    if (getByPhone(phone)) {
      res.writeHead(409);
      return res.end(JSON.stringify({ error: "An account with that phone number already exists." }));
    }

    const created = createUser({ email: null, phone, passwordHash: hashPassword(password) });
    res.writeHead(201);
    return res.end(JSON.stringify({ ok: true, user: { id: created.id, phone, method: "phone" } }));
  } catch (error) {
    console.error("Signup error:", error);
    res.writeHead(500);
    return res.end(JSON.stringify({ error: "Unable to create account." }));
  }
}
