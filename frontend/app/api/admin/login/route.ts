import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, MAX_AGE_SECONDS, createSessionToken } from "@/lib/session";

export async function POST(request: Request) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json(
      { erro: "ADMIN_PASSWORD não configurada no servidor" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const senha = typeof body.password === "string" ? body.password : "";

  if (senha !== adminPassword) {
    return NextResponse.json({ erro: "Senha incorreta" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });

  return NextResponse.json({ sucesso: true });
}
