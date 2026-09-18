import { cookies } from "next/headers";
import { COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import LoginForm from "./LoginForm";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!verifySessionToken(token)) {
    return <LoginForm />;
  }

  const supabase = getSupabaseAdmin();
  const [{ data: casas }, { data: tipos }, { data: configs }] = await Promise.all([
    supabase.from("casas_aposta").select("*").order("id"),
    supabase.from("tipos_aposta").select("*"),
    supabase.from("configuracoes").select("*"),
  ]);

  return (
    <AdminDashboard
      casasIniciais={casas ?? []}
      tiposIniciais={tipos ?? []}
      configsIniciais={configs ?? []}
    />
  );
}
