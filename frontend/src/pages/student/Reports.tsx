import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { applyMentorTheme } from '@/lib/theme';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, RefreshCw, BookOpen } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts';

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [todayStats, setTodayStats] = useState({ reviewed: 0, correct: 0, disciplines: 0, yesterdayReviewed: 0 });
  const [weekData, setWeekData] = useState<any[]>([]);
  const [weekStats, setWeekStats] = useState({ avgAccuracy: 0, streak: 0, bestDiscipline: '', worstDiscipline: '' });
  const [monthData, setMonthData] = useState<any[]>([]);
  const [monthStats, setMonthStats] = useState({ totalReviews: 0, coverage: 0, mastered: 0, weak: 0 });

  useEffect(() => {
    if (!session || session.role !== 'aluno') { navigate('/login'); return; }
    if (session.mentor_id) {
      supabase.from('mentors').select('primary_color, secondary_color').eq('id', session.mentor_id).maybeSingle()
        .then(({ data }) => { if (data) applyMentorTheme(data.primary_color, data.secondary_color); });
    }
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([loadTodayStats(), loadWeekStats(), loadMonthStats()]);
    } catch (err: any) {
      setError('Erro ao carregar relatórios. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTodayStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const { data: todaySessions } = await supabase.from('student_sessions')
      .select('*').eq('student_email', session!.email).eq('product_id', session!.product_id!).eq('session_date', today);

    const { data: yesterdaySessions } = await supabase.from('student_sessions')
      .select('*').eq('student_email', session!.email).eq('product_id', session!.product_id!).eq('session_date', yesterday);

    const tReviewed = (todaySessions || []).reduce((a, s) => a + s.cards_reviewed, 0);
    const tCorrect = (todaySessions || []).reduce((a, s) => a + s.correct, 0);
    const yReviewed = (yesterdaySessions || []).reduce((a, s) => a + s.cards_reviewed, 0);
    const disciplines = new Set((todaySessions || []).map(s => s.discipline_id)).size;

    setTodayStats({ reviewed: tReviewed, correct: tCorrect, disciplines, yesterdayReviewed: yReviewed });
  };

  const loadWeekStats = async () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }

    const { data: sessions } = await supabase.from('student_sessions')
      .select('*').eq('student_email', session!.email).eq('product_id', session!.product_id!)
      .gte('session_date', days[0]).lte('session_date', days[6]);

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const chartData = days.map(date => {
      const daySessions = (sessions || []).filter(s => s.session_date === date);
      const reviewed = daySessions.reduce((a, s) => a + s.cards_reviewed, 0);
      const d = new Date(date + 'T12:00:00');
      return { day: dayNames[d.getDay()], reviewed };
    });

    setWeekData(chartData);

    const totalCorrect = (sessions || []).reduce((a, s) => a + s.correct, 0);
    const totalReviewed = (sessions || []).reduce((a, s) => a + s.cards_reviewed, 0);

    setWeekStats({
      avgAccuracy: totalReviewed > 0 ? Math.round((totalCorrect / totalReviewed) * 100) : 0,
      streak: 0,
      bestDiscipline: '',
      worstDiscipline: '',
    });
  };

  const loadMonthStats = async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    const { data: sessions } = await supabase.from('student_sessions')
      .select('*').eq('student_email', session!.email).eq('product_id', session!.product_id!)
      .gte('session_date', startOfMonth).lte('session_date', today);

    const totalReviews = (sessions || []).reduce((a, s) => a + s.cards_reviewed, 0);

    const days: Record<string, { correct: number; total: number }> = {};
    for (const s of (sessions || [])) {
      if (!days[s.session_date]) days[s.session_date] = { correct: 0, total: 0 };
      days[s.session_date].correct += s.correct;
      days[s.session_date].total += s.cards_reviewed;
    }

    const chartData = Object.entries(days).sort().map(([date, d]) => ({
      day: new Date(date + 'T12:00:00').getDate(),
      accuracy: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
    }));

    setMonthData(chartData);

    const { count: totalCards } = await supabase.from('cards').select('*', { count: 'exact', head: true }).eq('product_id', session!.product_id!);
    const { count: reviewedCards } = await supabase.from('student_progress').select('*', { count: 'exact', head: true })
      .eq('student_email', session!.email).eq('product_id', session!.product_id!);

    setMonthStats({
      totalReviews,
      coverage: totalCards ? Math.round(((reviewedCards || 0) / totalCards) * 100) : 0,
      mastered: 0,
      weak: 0,
    });
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>;
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <p className="mb-4 text-center text-muted-foreground">{error}</p>
        <button onClick={loadAll} className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 font-display font-semibold text-primary-foreground hover:opacity-90">
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  const diff = todayStats.reviewed - todayStats.yesterdayReviewed;
  const DiffIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const accuracy = todayStats.reviewed > 0 ? Math.round((todayStats.correct / todayStats.reviewed) * 100) : 0;

  const chartAxisColor = 'hsl(var(--muted-foreground))';
  const tooltipStyle = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', color: 'hsl(var(--foreground))' };

  return (
    <div className="min-h-[100dvh] bg-background px-5 sm:px-6 pb-safe pb-8" style={{ paddingTop: 'max(32px, calc(env(safe-area-inset-top) + 16px))' }}>
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex items-center gap-3">
          <button onClick={() => navigate('/aluno')} className="rounded-lg p-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-2xl font-bold text-foreground">Relatórios</h1>
        </div>

        {/* Tabs — underline style */}
        <div className="mb-8 flex border-b border-border">
          {(['today', 'week', 'month'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 pb-3 text-sm font-medium transition-colors relative ${activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {tab === 'today' ? 'Hoje' : tab === 'week' ? 'Semana' : 'Mês'}
              {activeTab === tab && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>

        {/* TODAY */}
        {activeTab === 'today' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="font-display text-3xl font-bold text-foreground">{todayStats.reviewed}</p>
                <p className="text-xs text-muted-foreground">Cards revisados</p>
                <div className="mt-1 flex items-center gap-1">
                  <DiffIcon className={`h-3 w-3 ${diff > 0 ? 'text-secondary' : diff < 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                  <span className="text-xs text-muted-foreground">vs ontem</span>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="font-display text-3xl font-bold text-primary">{accuracy}%</p>
                <p className="text-xs text-muted-foreground">Taxa de acerto</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-display text-2xl font-bold text-foreground">{todayStats.disciplines}</p>
                  <p className="text-xs text-muted-foreground">Disciplinas estudadas hoje</p>
                </div>
              </div>
            </div>
            {todayStats.reviewed === 0 && (
              <div className="rounded-2xl border border-border bg-card p-8 text-center">
                <BookOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Nenhuma sessão hoje ainda.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Comece a estudar para ver seus dados aqui!</p>
              </div>
            )}
          </div>
        )}

        {/* WEEK */}
        {activeTab === 'week' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-medium text-foreground">Cards por dia</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekData}>
                    <XAxis dataKey="day" tick={{ fill: chartAxisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Bar dataKey="reviewed" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Precisão média</p>
              <p className="font-display text-3xl font-bold text-primary">{weekStats.avgAccuracy}%</p>
            </div>
          </div>
        )}

        {/* MONTH */}
        {activeTab === 'month' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-medium text-foreground">Evolução de acerto</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthData}>
                    <XAxis dataKey="day" tick={{ fill: chartAxisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="font-display text-3xl font-bold text-foreground">{monthStats.totalReviews}</p>
                <p className="text-xs text-muted-foreground">Total de revisões</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="font-display text-3xl font-bold text-secondary">{monthStats.coverage}%</p>
                <p className="text-xs text-muted-foreground">Cobertura do deck</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
