"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [historico, setHistorico] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  
  useEffect(() => {
    async function fetchData() {
      const { data: hist } = await supabase
        .from('historico_pipeline')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)
      
      const { data: conf } = await supabase
        .from('configuracoes')
        .select('*')
        
      if (hist) setHistorico(hist)
      if (conf) {
        const confObj = conf.reduce((acc, curr) => {
          acc[curr.chave] = curr.valor
          return acc
        }, {})
        setConfig(confObj)
      }
    }
    fetchData()
  }, [])

  return (
    <div className="min-h-screen bg-[#0a1a0a] text-[#f0fdf4] p-8 font-sans">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#facc15] flex items-center gap-3">
            <span>🍀</span> Sorte do Dia
          </h1>
          <p className="text-[#86efac] mt-1">Dashboard de Controle</p>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-8">
          <div className="bg-[#122012] border border-[#1e4a1e] rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 border-b border-[#1e4a1e] pb-2">Últimos Relatórios</h2>
            {historico.length === 0 ? (
              <p className="text-[#4b7a4b]">Nenhum relatório encontrado.</p>
            ) : (
              <div className="space-y-4">
                {historico.map((item, idx) => (
                  <div key={idx} className="bg-[#0f2a0f] p-4 rounded-lg flex justify-between items-center">
                    <div>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 ${item.status === 'sucesso' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                        {item.status.toUpperCase()}
                      </span>
                      <div className="text-sm text-gray-400">{new Date(item.created_at).toLocaleString('pt-BR')}</div>
                    </div>
                    {item.video_url && (
                      <a href={item.video_url} target="_blank" className="bg-[#22c55e] text-black px-4 py-2 rounded font-semibold hover:bg-[#4ade80] transition">
                        Ver Vídeo
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        
        <aside className="space-y-8">
          <div className="bg-[#122012] border border-[#1e4a1e] rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 border-b border-[#1e4a1e] pb-2">Configurações</h2>
            {config ? (
              <div className="space-y-4">
                <div>
                  <span className="block text-sm text-[#4b7a4b] mb-1">Agendamento Ativo</span>
                  <div className="font-medium">{config.agendamento?.ativo ? 'Sim' : 'Não'}</div>
                </div>
                <div>
                  <span className="block text-sm text-[#4b7a4b] mb-1">Horários</span>
                  <div className="font-medium">{config.agendamento?.horarios?.join(', ')}</div>
                </div>
                <div>
                  <span className="block text-sm text-[#4b7a4b] mb-1">Max Jogos por Vídeo</span>
                  <div className="font-medium">{config.odds_api?.max_jogos_por_video}</div>
                </div>
              </div>
            ) : (
              <p className="text-[#4b7a4b]">Carregando...</p>
            )}
          </div>
          
          <div className="bg-[#122012] border border-[#1e4a1e] rounded-xl p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Rodar Bot Manualmente</h2>
            <p className="text-sm text-[#86efac] mb-4">Execute o script Python na sua máquina local para gerar um novo vídeo.</p>
            <code className="block bg-[#0a1a0a] border border-[#1e4a1e] p-3 rounded text-sm text-gray-300">
              python3 main.py --modo agora
            </code>
          </div>
        </aside>
      </main>
    </div>
  )
}
