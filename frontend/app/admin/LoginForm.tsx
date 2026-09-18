"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const resp = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: senha }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        setErro(data.erro ?? "Senha incorreta");
        return;
      }
      router.refresh();
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a1a0a] text-[#f0fdf4] flex items-center justify-center p-8 font-sans">
      <form
        onSubmit={handleSubmit}
        className="bg-[#122012] border border-[#1e4a1e] rounded-xl p-8 w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl font-bold text-[#facc15]">Painel Admin</h1>
        <p className="text-sm text-[#86efac]">Sorte do Dia — acesso restrito</p>
        <div>
          <label className="block text-sm text-[#86efac] mb-1">Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full bg-[#0a1a0a] border border-[#1e4a1e] rounded px-3 py-2 text-[#f0fdf4] focus:outline-none focus:border-[#22c55e]"
            autoFocus
          />
        </div>
        {erro && <p className="text-red-400 text-sm">{erro}</p>}
        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-[#22c55e] text-black font-semibold py-2 rounded hover:bg-[#4ade80] transition disabled:opacity-50"
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
