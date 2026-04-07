import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, BarChart3, BookOpen, Clock } from 'lucide-react';

const EndSession: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { stats, disciplineName, studyTimeSeconds } = (location.state as any) || { stats: { reviewed: 0, correct: 0, incorrect: 0 }, disciplineName: '', studyTimeSeconds: 0 };

  const accuracy = stats.reviewed > 0 ? Math.round((stats.correct / stats.reviewed) * 100) : 0;

  const formatTime = (secs: number) => {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    return `${m}min ${s}s`;
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 pb-safe">
      <div className="w-full max-w-sm text-center px-2">
        <div className="mb-6">
          <CheckCircle2 className="mx-auto h-16 w-16" style={{ color: 'hsl(var(--color-accent))' }} />
        </div>

        <h1 className="mb-2 font-display text-2xl font-bold text-foreground">
          Sessão concluída!
        </h1>
        <p className="mb-8 text-muted-foreground">{disciplineName}</p>

        {/* Accuracy highlight */}
        <div className="mb-4 rounded-2xl border border-border bg-card p-5">
          <p className="font-display text-4xl font-bold text-foreground">{accuracy}%</p>
          <p className="text-sm text-muted-foreground">Precisão</p>
          <div className="mt-3 h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${accuracy}%`, background: 'hsl(var(--color-accent))' }}
            />
          </div>
        </div>

        {/* Stats cards */}
        <div className="mb-8 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="font-display text-2xl font-bold text-foreground">{stats.reviewed}</p>
            <p className="text-xs text-muted-foreground">Revisados</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="font-display text-2xl font-bold text-secondary">{stats.correct}</p>
            <p className="text-xs text-muted-foreground">Acertos</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <Clock className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
            <p className="font-display text-lg font-bold text-foreground">{formatTime(studyTimeSeconds)}</p>
            <p className="text-xs text-muted-foreground">Tempo</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/aluno/relatorios')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 font-display text-sm sm:text-base font-semibold text-foreground transition-all hover:bg-surface-hover active:scale-[0.98]"
          >
            <BarChart3 className="h-5 w-5" />
            Ver relatório
          </button>
          <button
            onClick={() => navigate('/aluno')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-display text-sm sm:text-base font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'hsl(var(--color-accent))', color: '#000' }}
          >
            <BookOpen className="h-5 w-5" />
            Estudar mais
          </button>
        </div>
      </div>
    </div>
  );
};

export default EndSession;
