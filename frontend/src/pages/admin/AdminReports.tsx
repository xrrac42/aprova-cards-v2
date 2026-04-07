import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { AdminLayout } from './AdminDashboard';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts';

const AdminReports: React.FC = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('week');
  const [weekData, setWeekData] = useState<any[]>([]);
  const [monthData, setMonthData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState({ totalStudents: 0, totalSessions: 0, totalCards: 0 });

  useEffect(() => {
    if (!session || session.role !== 'admin') { navigate('/login'); return; }
    load();
  }, []);

  const load = async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    const [{ data: allSessions }, { count: totalCards }] = await Promise.all([
      supabase.from('student_sessions').select('*, products(name)').gte('session_date', startOfMonth),
      supabase.from('cards').select('*', { count: 'exact', head: true }),
    ]);

    const sessions = allSessions || [];

    // Global stats
    const uniqueStudents = new Set(sessions.map(s => s.student_email)).size;
    setGlobalStats({
      totalStudents: uniqueStudents,
      totalSessions: sessions.length,
      totalCards: totalCards || 0,
    });

    // Week chart
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const weekSessions = sessions.filter(s => s.session_date >= sevenDaysAgo);
    const wData = days.map(date => {
      const daySessions = weekSessions.filter(s => s.session_date === date);
      const d = new Date(date + 'T12:00:00');
      return {
        day: dayNames[d.getDay()],
        alunos: new Set(daySessions.map(s => s.student_email)).size,
        cards: daySessions.reduce((a, s) => a + s.cards_reviewed, 0),
      };
    });
    setWeekData(wData);

    // Month chart
    const byDay: Record<string, { students: Set<string>; cards: number }> = {};
    for (const s of sessions) {
      if (!byDay[s.session_date]) byDay[s.session_date] = { students: new Set(), cards: 0 };
      byDay[s.session_date].students.add(s.student_email);
      byDay[s.session_date].cards += s.cards_reviewed;
    }
    const mData = Object.entries(byDay).sort().map(([date, d]) => ({
      day: new Date(date + 'T12:00:00').getDate(),
      alunos: d.students.size,
      cards: d.cards,
    }));
    setMonthData(mData);

    // Top products
    const prodMap: Record<string, { name: string; students: Set<string>; cards: number }> = {};
    for (const s of sessions) {
      const pid = s.product_id;
      if (!prodMap[pid]) prodMap[pid] = { name: (s.products as any)?.name || pid, students: new Set(), cards: 0 };
      prodMap[pid].students.add(s.student_email);
      prodMap[pid].cards += s.cards_reviewed;
    }
    setTopProducts(
      Object.values(prodMap)
        .map(p => ({ ...p, students: p.students.size }))
        .sort((a, b) => b.cards - a.cards)
        .slice(0, 5)
    );

    setLoading(false);
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold text-foreground">Relatórios</h1>
            <p className="text-sm text-muted-foreground">Visão consolidada da plataforma</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <>
              {/* Global stats */}
              <div className="mb-6 grid grid-cols-3 gap-4">
                {[
                  { label: 'Alunos ativos (mês)', value: globalStats.totalStudents },
                  { label: 'Sessões no mês', value: globalStats.totalSessions },
                  { label: 'Total de cards', value: globalStats.totalCards },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-2xl border border-border bg-card p-4">
                    <p className="font-display text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div className="mb-4 flex gap-1 rounded-xl border border-border bg-card p-1">
                {(['week', 'month'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                    {tab === 'week' ? 'Semana' : 'Mês'}
                  </button>
                ))}
              </div>

              {activeTab === 'week' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="mb-3 text-sm font-medium text-foreground">Alunos ativos por dia</p>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weekData}>
                          <XAxis dataKey="day" tick={{ fill: 'hsl(240, 8%, 54%)', fontSize: 12 }} axisLine={false} tickLine={false} />
                          <YAxis hide />
                          <Tooltip contentStyle={{ background: 'hsl(240, 12%, 8%)', border: '1px solid hsl(240, 10%, 18%)', borderRadius: '12px' }} />
                          <Bar dataKey="alunos" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Alunos" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="mb-3 text-sm font-medium text-foreground">Cards revisados por dia</p>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weekData}>
                          <XAxis dataKey="day" tick={{ fill: 'hsl(240, 8%, 54%)', fontSize: 12 }} axisLine={false} tickLine={false} />
                          <YAxis hide />
                          <Tooltip contentStyle={{ background: 'hsl(240, 12%, 8%)', border: '1px solid hsl(240, 10%, 18%)', borderRadius: '12px' }} />
                          <Bar dataKey="cards" fill="hsl(var(--secondary))" radius={[6, 6, 0, 0]} name="Cards" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'month' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="mb-3 text-sm font-medium text-foreground">Evolução mensal de alunos</p>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthData}>
                          <XAxis dataKey="day" tick={{ fill: 'hsl(240, 8%, 54%)', fontSize: 12 }} axisLine={false} tickLine={false} />
                          <YAxis hide />
                          <Tooltip contentStyle={{ background: 'hsl(240, 12%, 8%)', border: '1px solid hsl(240, 10%, 18%)', borderRadius: '12px' }} />
                          <Line type="monotone" dataKey="alunos" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Alunos" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Top products */}
              <div className="mt-6 rounded-2xl border border-border bg-card p-4">
                <p className="mb-3 text-sm font-medium text-foreground">Produtos com mais engajamento (mês)</p>
                <div className="space-y-2">
                  {topProducts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground">#{i + 1}</span>
                        <span className="text-sm font-medium text-foreground">{p.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{p.cards} cards</p>
                        <p className="text-xs text-muted-foreground">{p.students} alunos</p>
                      </div>
                    </div>
                  ))}
                  {topProducts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem dados ainda</p>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminReports;
