import { cookies } from "next/headers";
import { COOKIE_NAME, verifySessionToken } from "@/lib/session";

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
