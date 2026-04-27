import React, { useEffect, useState, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getSession } from '@/lib/auth';
import { applyMentorTheme } from '@/lib/theme';
import { syncBackup } from '@/lib/study-backup';
import { useAccessGuard } from '@/hooks/useAccessGuard';
import { BarChart3, BookOpen, Play, RefreshCw, RotateCcw, CheckCircle2, ChevronDown, ChevronRight, Library } from 'lucide-react';

interface DisciplineInfo {
  id: string;
  name: string;
  order: number;
  totalCards: number;
}

interface MentorInfo {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
}

interface ProductInfo {
  id: string;
  name: string;
  cover_image_url: string | null;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

const DisciplinaRow = memo(({ disc, expanded, onToggle }: {
  disc: DisciplineInfo;
  expanded: boolean;
  onToggle: () => void;
}) => (
  <div className="border-b border-border last:border-b-0">
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-hover active:scale-[0.99] touch-manipulation"
    >
      <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-sm text-foreground truncate">{disc.name}</p>
        <p className="text-xs text-muted-foreground">{(disc.totalCards ?? 0).toLocaleString()} cards</p>
      </div>
      {expanded
        ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      }
    </button>
    {expanded && (
      <div className="px-4 pb-4 pt-0 space-y-3">
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
));
DisciplinaRow.displayName = 'DisciplinaRow';

const StudentHome: React.FC = () => {
  const navigate = useNavigate();
  useAccessGuard();
  const session = getSession();

  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [mentor, setMentor] = useState<MentorInfo | null>(null);
  const [disciplines, setDisciplines] = useState<DisciplineInfo[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDisc, setExpandedDisc] = useState<string | null>(null);

  useEffect(() => {
    if (!session || session.role !== 'aluno' || !session.product_id) {
      navigate('/login');
      return;
    }
    syncBackup(session.email, session.product_id).catch(() => {});
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${BACKEND_URL}/api/v1/student/home`, {
        headers: {
          'Authorization': `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || 'Erro ao carregar dados. Tente novamente.');
        return;
      }

      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Erro ao carregar dados.');
        return;
      }

      const { product: prod, mentor: ment, disciplines: discs, total_cards } = json.data;

      // Map disciplines from backend snake_case to frontend camelCase
      const mappedDisciplines = (discs ?? []).map((disc: any) => ({
        id: disc.id,
        name: disc.name,
        order: disc.order,
        totalCards: disc.total_cards ?? 0,
      }));

      setProduct(prod);
      setMentor(ment);
      setDisciplines(mappedDisciplines);
      setTotalCards(total_cards ?? 0);

      if (ment?.primary_color && ment?.secondary_color) {
        applyMentorTheme(ment.primary_color, ment.secondary_color);
      }
    } catch (err: any) {
      setError('Erro ao carregar dados. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4">
        <p className="mb-4 text-center text-muted-foreground">{error}</p>
        <button
          onClick={loadData}
          className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 font-display font-semibold text-primary-foreground hover:opacity-90"
        >
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background px-5 sm:px-6 pb-8 pb-safe" style={{ paddingTop: 'max(32px, calc(env(safe-area-inset-top) + 16px))' }}>
      <div className="mx-auto max-w-lg">
        {/* Header */}
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

            <div className="flex items-center gap-5 text-sm py-3 border-t border-b border-border/40">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <RotateCcw className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">{totalCards.toLocaleString()}</span> cards no total
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">{disciplines.length}</span> disciplinas
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

        {/* Disciplines */}
        <div className="mb-8">
          <h2 className="font-display text-sm font-semibold text-foreground mb-3 px-1 flex items-center gap-2">
            <Library className="h-4 w-4 text-muted-foreground" />
            Disciplinas ({disciplines.length})
          </h2>
          {disciplines.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma disciplina encontrada.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              {disciplines.map((disc) => (
                <DisciplinaRow
                  key={disc.id}
                  disc={disc}
                  expanded={expandedDisc === disc.id}
                  onToggle={() => setExpandedDisc(expandedDisc === disc.id ? null : disc.id)}
                />
              ))}
            </div>
          )}
        </div>

        {disciplines.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-secondary" />
            <p className="font-display font-semibold text-foreground">Material pronto!</p>
            <p className="text-sm text-muted-foreground">Escolha uma disciplina ou estude tudo.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentHome;
