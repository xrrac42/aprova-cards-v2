import React, { useEffect, useState, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { applyMentorTheme } from '@/lib/theme';
import { syncBackup } from '@/lib/study-backup';
import { useAccessGuard } from '@/hooks/useAccessGuard';
import { BarChart3, BookOpen, Flame, Play, RefreshCw, RotateCcw, CheckCircle2, ChevronDown, ChevronRight, Library } from 'lucide-react';

interface DisciplineWithStats {
  id: string;
  name: string;
  order: number;
  total: number;
  mastered: number;
  reviewsDue: number;
  newAvailable: number;
}

// Memoized discipline row
const DisciplinaRow = memo(({ disc, statsLoading, expanded, onToggle }: {
  disc: DisciplineWithStats;
  statsLoading: boolean;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const masteredPercent = disc.total > 0 ? Math.round((disc.mastered / disc.total) * 100) : 0;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-hover active:scale-[0.99] touch-manipulation"
      >
        <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm text-foreground truncate">{disc.name}</p>
          <p className="text-xs text-muted-foreground">
            {disc.total.toLocaleString()} cards · {masteredPercent}% dominado
          </p>
        </div>
        {expanded
          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        }
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-3">
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full progress-gradient transition-all" style={{ width: `${masteredPercent}%` }} />
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {!statsLoading && disc.reviewsDue > 0 && (
              <span className="flex items-center gap-1">
                <RotateCcw className="h-3 w-3 text-rating-hard" />
                {disc.reviewsDue} revisões
              </span>
            )}
            {!statsLoading && disc.newAvailable > 0 && (
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3 text-primary" />
                {disc.newAvailable.toLocaleString()} novos
              </span>
            )}
            {!statsLoading && disc.reviewsDue === 0 && disc.newAvailable === 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-secondary" />
                Em dia!
              </span>
            )}
            {statsLoading && <span className="text-muted-foreground/50">Carregando…</span>}
          </div>
          <Link
            to={`/aluno/sessao/${disc.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 font-display text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'hsl(var(--color-accent))', color: '#000' }}
          >
            <Play className="h-4 w-4" />
            Estudar esta disciplina
          </Link>
        </div>
      )}
    </div>
  );
});
DisciplinaRow.displayName = 'DisciplinaRow';

const StudentHome: React.FC = () => {
  const navigate = useNavigate();
  useAccessGuard();
  const session = getSession();
  const [product, setProduct] = useState<any>(null);
  const [mentor, setMentor] = useState<any>(null);
  const [disciplines, setDisciplines] = useState<DisciplineWithStats[]>([]);
  const [totalReviewsDue, setTotalReviewsDue] = useState(0);
  const [totalNewToday, setTotalNewToday] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [totalMastered, setTotalMastered] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isNewStudent, setIsNewStudent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [expandedDisc, setExpandedDisc] = useState<string | null>(null);

  useEffect(() => {
    if (!session || session.role !== 'aluno' || !session.product_id) { navigate('/login'); return; }
    syncBackup(session.email, session.product_id).catch(() => {});
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch product + mentor
      const { data: prod } = await supabase.from('products').select('*, mentors(*)').eq('id', session!.product_id).maybeSingle();
      if (!prod) { setError('Produto não encontrado.'); setLoading(false); return; }
      setProduct(prod);
      const mentorData = prod.mentors as any;
      setMentor(mentorData);
      if (mentorData) applyMentorTheme(mentorData.primary_color, mentorData.secondary_color, mentorData.accent_color);
      setLoading(false);

      // Now fetch stats using the server-side function — ONE query
      setStatsLoading(true);

      const [statsResult, sessionsResult] = await Promise.all([
        supabase.rpc('get_student_discipline_stats', {
          p_email: session!.email,
          p_product_id: session!.product_id!,
        }),
        supabase.from('student_sessions')
          .select('session_date')
          .eq('student_email', session!.email)
          .eq('product_id', session!.product_id!)
          .order('session_date', { ascending: false })
          .limit(30),
      ]);

      const statsData = statsResult.data || [];

      let sumTotal = 0, sumMastered = 0, sumReviews = 0, sumNew = 0, sumStudied = 0;
      const discs: DisciplineWithStats[] = statsData.map((d: any) => {
        sumTotal += Number(d.total_cards);
        sumMastered += Number(d.mastered);
        sumReviews += Number(d.reviews_due);
        sumNew += Number(d.new_available);
        sumStudied += Number(d.studied);
        return {
          id: d.discipline_id,
          name: d.discipline_name,
          order: d.discipline_order,
          total: Number(d.total_cards),
          mastered: Number(d.mastered),
          reviewsDue: Number(d.reviews_due),
          newAvailable: Number(d.new_available),
        };
      });

      setDisciplines(discs);
      setTotalCards(sumTotal);
      setTotalMastered(sumMastered);
      setTotalReviewsDue(sumReviews);
      setTotalNewToday(sumNew);

      if (sumStudied === 0) {
        setIsNewStudent(true);
      }

      // Streak
      const sessions = sessionsResult.data;
      if (sessions) {
        let streakCount = 0;
        const dates = [...new Set(sessions.map(s => s.session_date))].sort().reverse();
        const todayDate = new Date();
        for (let i = 0; i < dates.length; i++) {
          const expected = new Date(todayDate);
          expected.setDate(expected.getDate() - i);
          const expectedStr = expected.toISOString().split('T')[0];
          if (dates[i] === expectedStr) streakCount++;
          else break;
        }
        setStreak(streakCount);
      }

      setStatsLoading(false);
    } catch (err: any) {
      setError('Erro ao carregar dados. Tente novamente.');
      console.error(err);
      setLoading(false);
      setStatsLoading(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>;
  }

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4">
        <p className="mb-4 text-center text-muted-foreground">{error}</p>
        <button onClick={loadData} className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 font-display font-semibold text-primary-foreground hover:opacity-90">
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  if (isNewStudent && !welcomeDismissed) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 pb-safe pt-safe">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-6 flex justify-center">
            {mentor?.logo_url ? (
              <img src={mentor.logo_url} alt={mentor.name} className="h-20 w-20 rounded-3xl object-cover shadow-lg" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl" style={{ background: 'var(--gradient-primary)' }}>
                <span className="font-display text-3xl font-bold text-primary-foreground">{mentor?.name?.charAt(0) || 'M'}</span>
              </div>
            )}
          </div>
          <h1 className="mb-3 font-display text-2xl font-bold text-foreground">
            Bem-vindo(a) ao {product?.name}!
          </h1>
          <p className="mb-2 text-foreground">
            Seu material está pronto para você.
          </p>
          <p className="mb-8 text-muted-foreground leading-relaxed">
            Escolha uma disciplina e comece agora.
          </p>
          <Link
            to="/aluno/sessao/all"
            className="inline-flex items-center gap-3 rounded-2xl px-8 py-4 font-display text-lg font-bold transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'hsl(var(--color-accent))', color: '#000' }}
          >
            <Play className="h-6 w-6" />
            Começar →
          </Link>
          <button
            onClick={() => setWelcomeDismissed(true)}
            className="mt-4 block w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver disciplinas
          </button>
        </div>
      </div>
    );
  }

  const overallPercent = totalCards > 0 ? Math.round((totalMastered / totalCards) * 100) : 0;

  return (
    <div className="min-h-[100dvh] bg-background px-5 sm:px-6 pb-8 pb-safe" style={{ paddingTop: 'max(32px, calc(env(safe-area-inset-top) + 16px))' }}>
      <div className="mx-auto max-w-lg">
        {/* Header with reports link */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {mentor?.logo_url ? (
              <img src={mentor.logo_url} alt={mentor.name} className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <span className="font-display text-lg font-bold text-primary">{mentor?.name?.charAt(0) || 'M'}</span>
              </div>
            )}
            <p className="font-display text-sm font-semibold text-muted-foreground">{mentor?.name}</p>
          </div>
          <Link to="/aluno/relatorios" className="rounded-2xl bg-card p-2.5 text-muted-foreground hover:text-foreground transition-colors">
            <BarChart3 className="h-5 w-5" />
          </Link>
        </div>

        {/* Product card */}
        <div className="mb-8 rounded-2xl border border-border bg-card overflow-hidden">
          {product?.cover_image_url ? (
            <img src={product.cover_image_url} alt={product.name} className="w-full h-[180px] sm:h-52 object-cover" />
          ) : (
            <div
              className="w-full h-[180px] sm:h-52 flex items-center justify-center relative"
              style={{ background: `linear-gradient(135deg, ${mentor?.primary_color || 'hsl(var(--primary))'}, ${mentor?.secondary_color || 'hsl(var(--secondary))'})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <span className="font-display text-xl font-bold text-white drop-shadow-sm relative z-10 px-6 text-center leading-tight">{product?.name}</span>
            </div>
          )}
          <div className="p-5 flex flex-col gap-3">
            <div>
              <h1 className="font-display text-[22px] font-bold text-foreground leading-tight">{product?.name}</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">{mentor?.name}</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">{overallPercent}% concluído</span>
                {streak > 0 && (
                  <span className="flex items-center gap-1 text-xs text-rating-hard font-semibold">
                    <Flame className="h-3.5 w-3.5" /> {streak} dias
                  </span>
                )}
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full progress-gradient transition-all" style={{ width: `${overallPercent}%` }} />
              </div>
            </div>

            <div className="flex items-center gap-5 text-sm py-3 border-t border-b border-border/40">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <RotateCcw className="h-4 w-4 text-rating-hard" />
                <span className="font-semibold text-foreground">{statsLoading ? '…' : totalReviewsDue}</span> revisões
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">{statsLoading ? '…' : totalNewToday.toLocaleString()}</span> novos
              </span>
            </div>

            <Link
              to="/aluno/sessao/all"
              className="flex w-full items-center justify-center gap-2 rounded-xl py-4 font-display text-base font-semibold transition-all hover:opacity-90 active:scale-[0.98] mt-1"
              style={{ background: 'hsl(var(--color-accent))', color: '#000' }}
            >
              <Play className="h-5 w-5" />
              Estudar agora
            </Link>
          </div>
        </div>

        {/* Disciplines section */}
        <div className="mb-8">
          <h2 className="font-display text-sm font-semibold text-foreground mb-3 px-1 flex items-center gap-2">
            <Library className="h-4 w-4 text-muted-foreground" />
            Disciplinas ({disciplines.length})
          </h2>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {disciplines.map((disc) => (
              <DisciplinaRow
                key={disc.id}
                disc={disc}
                statsLoading={statsLoading}
                expanded={expandedDisc === disc.id}
                onToggle={() => setExpandedDisc(expandedDisc === disc.id ? null : disc.id)}
              />
            ))}
          </div>
        </div>

        {!statsLoading && totalReviewsDue === 0 && totalNewToday === 0 && disciplines.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-secondary" />
            <p className="font-display font-semibold text-foreground">Tudo em dia!</p>
            <p className="text-sm text-muted-foreground">Volte amanhã para suas revisões.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentHome;
