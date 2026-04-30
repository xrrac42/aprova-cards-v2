import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { applyMentorTheme } from '@/lib/theme';
import { ArrowLeft } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Period = 'today' | 'week' | 'month';

const MentorReports: React.FC = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [period, setPeriod] = useState<Period>('week');
  const [loading, setLoading] = useState(true);

  const [activeByDay, setActiveByDay] = useState<{ date: string; alunos: number }[]>([]);
  const [cardsByDay, setCardsByDay] = useState<{ date: string; cards: number }[]>([]);
  const [topDisciplines, setTopDisciplines] = useState<{ name: string; cards: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; sessions: number }[]>([]);

  useEffect(() => {
    if (!session || session.role !== 'mentor' || !session.mentor_id) { navigate('/login'); return; }
    loadTheme();
  }, []);

  useEffect(() => {
    if (session?.mentor_id) loadReports();
  }, [period]);

  const loadTheme = async () => {
    const { data } = await supabase.from('mentors').select('*').eq('id', session!.mentor_id).maybeSingle();
    if (data) applyMentorTheme(data.primary_color, data.secondary_color);
  };

  const getDateRange = (): { start: string; end: string } => {
    const today = new Date();
    const end = today.toISOString().split('T')[0];
    if (period === 'today') return { start: end, end };
    if (period === 'week') {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return { start: d.toISOString().split('T')[0], end };
    }
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: d.toISOString().split('T')[0], end };
  };

  const loadReports = async () => {
    setLoading(true);
    const mentorId = session!.mentor_id!;
    const { start, end } = getDateRange();

    const { data: products } = await supabase.from('products').select('id, name').eq('mentor_id', mentorId);
    if (!products || products.length === 0) { setLoading(false); return; }

    const productIds = products.map(p => p.id);
    const productMap = Object.fromEntries(products.map(p => [p.id, p.name]));

    const { data: sessions } = await supabase.from('student_sessions')
      .select('*')
      .in('product_id', productIds)
      .gte('session_date', start)
      .lte('session_date', end);

    const allSessions = sessions || [];

    const dayMap = new Map<string, Set<string>>();
    const cardDayMap = new Map<string, number>();
    const discMap = new Map<string, number>();
    const prodMap = new Map<string, number>();

    for (const s of allSessions) {
      if (!dayMap.has(s.session_date)) dayMap.set(s.session_date, new Set());
      dayMap.get(s.session_date)!.add(s.student_email);
      cardDayMap.set(s.session_date, (cardDayMap.get(s.session_date) || 0) + s.cards_reviewed);
      discMap.set(s.discipline_id, (discMap.get(s.discipline_id) || 0) + s.cards_reviewed);
      const pName = productMap[s.product_id] || s.product_id;
      prodMap.set(pName, (prodMap.get(pName) || 0) + 1);
    }

    const sortedDays = Array.from(dayMap.keys()).sort();
    setActiveByDay(sortedDays.map(d => ({ date: d.slice(5), alunos: dayMap.get(d)!.size })));
    setCardsByDay(sortedDays.map(d => ({ date: d.slice(5), cards: cardDayMap.get(d) || 0 })));

    const discIds = Array.from(discMap.keys());
    if (discIds.length > 0) {
      const { data: discs } = await supabase.from('disciplines').select('id, name').in('id', discIds);
      const discNameMap = Object.fromEntries((discs || []).map(d => [d.id, d.name]));
      const ranked = Array.from(discMap.entries())
        .map(([id, cards]) => ({ name: discNameMap[id] || id, cards }))
        .sort((a, b) => b.cards - a.cards)
        .slice(0, 5);
      setTopDisciplines(ranked);
    }

    setTopProducts(
      Array.from(prodMap.entries())
        .map(([name, sessions]) => ({ name, sessions }))
        .sort((a, b) => b.sessions - a.sessions)
    );

    setLoading(false);
  };

  const chartAxisColor = 'hsl(var(--muted-foreground))';
  const tooltipStyle = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', color: 'hsl(var(--foreground))' };
  const maxDiscCards = topDisciplines.length > 0 ? topDisciplines[0].cards : 1;

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 pb-8 pt-6">
      <div className="mx-auto max-w-5xl">
        <Link to="/mentor" className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar ao painel
        </Link>

        <h1 className="mb-6 font-display text-2xl font-bold text-foreground">Relatórios</h1>

        {/* Tabs — underline style */}
        <div className="mb-8 flex border-b border-border">
          {(['today', 'week', 'month'] as const).map(tab => (
            <button key={tab} onClick={() => setPeriod(tab)}
              className={`flex-1 pb-3 text-sm font-medium transition-colors relative ${period === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {tab === 'today' ? 'Hoje' : tab === 'week' ? 'Semana' : 'Mês'}
              {period === tab && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active students chart */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-4 font-display font-semibold text-foreground">Alunos ativos por dia</h3>
              {activeByDay.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem dados para o período</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={activeByDay}>
                    <XAxis dataKey="date" stroke={chartAxisColor} fontSize={12} axisLine={false} tickLine={false} />
                    <YAxis stroke={chartAxisColor} fontSize={12} allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="alunos" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Cards reviewed chart */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-4 font-display font-semibold text-foreground">Cards revisados</h3>
              {cardsByDay.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem dados para o período</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={cardsByDay}>
                    <XAxis dataKey="date" stroke={chartAxisColor} fontSize={12} axisLine={false} tickLine={false} />
                    <YAxis stroke={chartAxisColor} fontSize={12} allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="cards" stroke="hsl(var(--secondary))" strokeWidth={2} dot={{ fill: 'hsl(var(--secondary))' }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Rankings */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-4 font-display font-semibold text-foreground">Disciplinas mais estudadas</h3>
                {topDisciplines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados</p>
                ) : (
                  <div className="space-y-3">
                    {topDisciplines.map((d, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-foreground">{i + 1}. {d.name}</span>
                          <span className="font-mono text-sm text-muted-foreground">{d.cards}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(d.cards / maxDiscCards) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-4 font-display font-semibold text-foreground">Produtos com mais engajamento</h3>
                {topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados</p>
                ) : (
                  <div className="space-y-3">
                    {topProducts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{i + 1}. {p.name}</span>
                        <span className="font-mono text-sm text-muted-foreground">{p.sessions} sessões</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MentorReports;
