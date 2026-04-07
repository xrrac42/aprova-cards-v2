import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { applyMentorTheme } from '@/lib/theme';
import { RotateCcw, BookOpen, Zap, Play, ArrowLeft } from 'lucide-react';

type StudyMode = 'review' | 'new' | 'mixed';

const MODE_INFO: Record<StudyMode, { icon: React.ReactNode; label: string; message: string }> = {
  review: {
    icon: <RotateCcw className="h-5 w-5" />,
    label: 'Revisar pendentes',
    message: 'Revisando o que você já viu — consolidando memória!',
  },
  new: {
    icon: <BookOpen className="h-5 w-5" />,
    label: 'Estudar cards novos',
    message: 'Explorando conteúdo novo — vai no seu ritmo!',
  },
  mixed: {
    icon: <Zap className="h-5 w-5" />,
    label: 'Revisão + Novos',
    message: 'Revisão + conteúdo novo — sessão completa!',
  },
};
const DEFAULT_NEW_LIMIT = 50;

const SessionConfig: React.FC = () => {
  const { disciplineId } = useParams<{ disciplineId: string }>();
  const navigate = useNavigate();
  const session = getSession();

  const [disciplineName, setDisciplineName] = useState('');
  const [totalCards, setTotalCards] = useState(0);
  const [reviewsDue, setReviewsDue] = useState(0);
  const [newAvailable, setNewAvailable] = useState(0);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<StudyMode>('mixed');

  useEffect(() => {
    if (!session || session.role !== 'aluno' || !session.product_id) { navigate('/login'); return; }
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const isAll = disciplineId === 'all';

      const mentorPromise = session?.mentor_id
        ? supabase.from('mentors').select('primary_color, secondary_color, accent_color').eq('id', session.mentor_id).maybeSingle()
        : Promise.resolve({ data: null });

      const statsPromise = supabase.rpc('get_student_discipline_stats', {
        p_email: session!.email,
        p_product_id: session!.product_id!,
      });

      const [mentorResult, statsResult] = await Promise.all([mentorPromise, statsPromise]);

      if (mentorResult.data) applyMentorTheme((mentorResult.data as any).primary_color, (mentorResult.data as any).secondary_color, (mentorResult.data as any).accent_color);

      const allStats = statsResult.data || [];

      if (isAll) {
        setDisciplineName('Todas as disciplinas');
        let total = 0, due = 0, newCount = 0;
        for (const d of allStats) {
          total += Number(d.total_cards);
          due += Number(d.reviews_due);
          newCount += Number(d.new_available);
        }
        setTotalCards(total);
        setReviewsDue(due);
        setNewAvailable(newCount);
      } else {
        const disc = allStats.find((d: any) => d.discipline_id === disciplineId);
        if (disc) {
          setDisciplineName(disc.discipline_name);
          setTotalCards(Number(disc.total_cards));
          setReviewsDue(Number(disc.reviews_due));
          setNewAvailable(Number(disc.new_available));
        }
      }

      const due = isAll
        ? allStats.reduce((s: number, d: any) => s + Number(d.reviews_due), 0)
        : Number(allStats.find((d: any) => d.discipline_id === disciplineId)?.reviews_due || 0);
      const newCount = isAll
        ? allStats.reduce((s: number, d: any) => s + Number(d.new_available), 0)
        : Number(allStats.find((d: any) => d.discipline_id === disciplineId)?.new_available || 0);

      if (due > 0 && newCount > 0) setMode('mixed');
      else if (due > 0) setMode('review');
      else if (newCount > 0) setMode('new');
      else setMode('review');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getNewCardCount = (): number => {
    return Math.min(DEFAULT_NEW_LIMIT, newAvailable);
  };

  const getSessionCardCount = (): number => {
    switch (mode) {
      case 'review': return reviewsDue;
      case 'new': return getNewCardCount();
      case 'mixed': return reviewsDue + getNewCardCount();
    }
  };

  const getButtonLabel = (): string => {
    switch (mode) {
      case 'review': return `Iniciar · ${reviewsDue} revisões`;
      case 'new': return `Iniciar · ${getNewCardCount()} novos`;
      case 'mixed': return `Iniciar · ${reviewsDue} rev. + ${getNewCardCount()} novos`;
    }
  };

  const startSession = () => {
    const params = new URLSearchParams();
    params.set('mode', mode);
    if (mode === 'new' || mode === 'mixed') {
      params.set('newLimit', String(getNewCardCount()));
    }
    navigate(`/aluno/estudo/${disciplineId}?${params.toString()}`);
  };

  if (loading) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>;
  }

  const modeInfo = MODE_INFO[mode];
  const cardCount = getSessionCardCount();

  return (
    <div className="min-h-[100dvh] bg-background px-5 sm:px-6 pb-8 pb-safe" style={{ paddingTop: 'max(32px, calc(env(safe-area-inset-top) + 16px))' }}>
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <button onClick={() => navigate('/aluno')} className="rounded-lg p-2.5 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-lg font-bold text-foreground">{disciplineName}</h1>
            <p className="text-xs text-muted-foreground">{totalCards.toLocaleString()} cards no total</p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mb-8 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <RotateCcw className="mx-auto mb-1.5 h-5 w-5 text-rating-hard" />
            <p className="font-display text-2xl font-bold text-rating-hard">{reviewsDue}</p>
            <p className="text-xs text-muted-foreground">Revisões pendentes</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <BookOpen className="mx-auto mb-1.5 h-5 w-5 text-primary" />
            <p className="font-display text-2xl font-bold text-primary">{newAvailable.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Cards novos</p>
          </div>
        </div>

        {/* Mode selection */}
        <h2 className="mb-3 font-display text-base font-semibold text-foreground">Como você quer estudar hoje?</h2>
        <div className="mb-8 space-y-2">
          {([
            { key: 'review' as StudyMode, count: reviewsDue, disabled: reviewsDue === 0 },
            { key: 'new' as StudyMode, count: newAvailable, disabled: newAvailable === 0 },
            { key: 'mixed' as StudyMode, count: reviewsDue + getNewCardCount(), disabled: reviewsDue === 0 && newAvailable === 0 },
          ]).map(({ key, count, disabled }) => {
            const info = MODE_INFO[key];
            const isSelected = mode === key;
            return (
              <button
                key={key}
                disabled={disabled}
                onClick={() => setMode(key)}
                className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] touch-manipulation ${
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card hover:bg-surface-hover'
                } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {info.icon}
                </div>
                <div className="flex-1">
                  <p className="font-display font-semibold text-sm text-foreground">
                    {info.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {key === 'mixed'
                      ? `${reviewsDue} revisões + novos`
                      : `${count.toLocaleString()} cards`
                    }
                  </p>
                </div>
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                  isSelected ? 'border-primary' : 'border-muted-foreground/30'
                }`}>
                  {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Motivational message */}
        <div className="mb-8 rounded-2xl bg-primary/10 border border-primary/20 p-4 text-center">
          <p className="text-sm text-foreground">{modeInfo.message}</p>
        </div>

        {/* Start button */}
        <button
          onClick={startSession}
          disabled={cardCount === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-base sm:text-lg font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 truncate"
          style={{ background: 'hsl(var(--color-accent))', color: '#000' }}
        >
          <Play className="h-6 w-6" />
          {getButtonLabel()}
        </button>
      </div>
    </div>
  );
};

export default SessionConfig;
