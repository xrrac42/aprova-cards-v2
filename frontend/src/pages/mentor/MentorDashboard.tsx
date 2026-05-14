import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession, clearSession } from '@/lib/auth';
import { applyMentorTheme } from '@/lib/theme';
import { 
  Users, BookOpen, TrendingUp, Palette, BarChart3, LogOut, 
  Copy, Check, Star, RefreshCw, Link2, Share2, UserPlus, Loader2 
} from 'lucide-react';

interface ProductStat {
  id: string;
  name: string;
  active: boolean;
  totalStudents: number;
  cardsReviewed: number;
  studentsToday: number;
  weeklyAvgCards: number;
  topEngaged: string;
}

const MentorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [mentor, setMentor] = useState<any>(null);
  const [productStats, setProductStats] = useState<ProductStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLoginUrl, setCopiedLoginUrl] = useState(false);
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});
  const [inviteGenerating, setInviteGenerating] = useState<Record<string, boolean>>({});
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null);

  const baseUrl = import.meta.env.PROD ? 'https://aprovacards.com.br' : window.location.origin;

  const copyLoginLink = async () => {
    if (!mentor?.slug) return;
    await navigator.clipboard.writeText(`${baseUrl}/login/${mentor.slug}`);
    setCopiedLoginUrl(true);
    setTimeout(() => setCopiedLoginUrl(false), 2000);
  };

  const shareLoginLink = async () => {
    if (!mentor?.slug) return;
    const url = `${baseUrl}/login/${mentor.slug}`;
    if (navigator.share) {
      try { await navigator.share({ title: `Login — ${mentor.name}`, url }); } catch {}
    } else {
      await copyLoginLink();
    }
  };

  const generateInviteLink = async (productId: string, productName: string) => {
    if (inviteLinks[productId]) return; 
    setInviteGenerating(prev => ({ ...prev, [productId]: true }));
    
    try {
      const code = crypto.randomUUID().replace(/-/g, '');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error: dbError } = await supabase.from('student_invitations').insert({
        mentor_id: session!.mentor_id,
        product_id: productId,
        invite_code: code,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      });

      if (dbError) throw dbError;

      // Link apontando para o checkout para teste do Stripe
      const link = `${baseUrl}/checkout?code=${code}`;
      setInviteLinks(prev => ({ ...prev, [productId]: link }));
    } catch (e) {
      console.error('Erro ao gerar convite:', e);
    } finally {
      setInviteGenerating(prev => ({ ...prev, [productId]: false }));
    }
  };

  const copyInviteLink = async (productId: string) => {
    const link = inviteLinks[productId];
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopiedInvite(productId);
    setTimeout(() => setCopiedInvite(null), 2000);
  };

  const shareInviteLink = async (productId: string, productName: string) => {
    const link = inviteLinks[productId];
    if (!link) return;
    if (navigator.share) {
      try { await navigator.share({ title: `Acesso — ${productName}`, url: link }); } catch {}
    } else {
      await copyInviteLink(productId);
    }
  };

  useEffect(() => {
    if (!session || session.role !== 'mentor' || !session.mentor_id) {
      navigate('/login');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const mentorId = session!.mentor_id!;

      // Buscamos mentor, produtos vinculados e estatísticas em paralelo
      const [mentorRes, productsRes, statsRes] = await Promise.all([
        supabase.from('mentors').select('*').eq('id', mentorId).maybeSingle(),
        supabase.from('products').select('*').eq('mentor_id', mentorId),
        supabase.rpc('get_mentor_stats', { p_mentor_id: mentorId }),
      ]);

      if (mentorRes.data) {
        setMentor(mentorRes.data);
        applyMentorTheme(mentorRes.data.primary_color, mentorRes.data.secondary_color);
      }

      // Mapeamos os produtos e mesclamos com os dados da RPC (se existirem)
      const products = productsRes.data || [];
      const stats = statsRes.data || [];

      const combinedStats: ProductStat[] = products.map(p => {
        const s = stats.find((stat: any) => stat.product_id === p.id);
        return {
          id: p.id,
          name: p.name,
          active: p.active,
          totalStudents: Number(s?.total_students || 0),
          cardsReviewed: Number(s?.cards_reviewed || 0),
          studentsToday: Number(s?.students_today || 0),
          weeklyAvgCards: Number(s?.weekly_avg_cards_per_student || 0),
          topEngaged: s?.top_engaged_email || '',
        };
      });

      setProductStats(combinedStats);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  const totalActiveStudents = productStats.reduce((s, p) => s + p.totalStudents, 0);
  const studentsTodayTotal = productStats.reduce((s, p) => s + p.studentsToday, 0);
  const weeklyAvgCardsTotal = productStats.length > 0
    ? Math.round(productStats.reduce((s, p) => s + p.weeklyAvgCards, 0) / productStats.length)
    : 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 pb-safe pb-8 pt-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {mentor?.logo_url ? (
              <img src={mentor.logo_url} alt={mentor.name} className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <span className="font-display text-xl font-bold text-primary">{mentor?.name?.charAt(0) || 'M'}</span>
              </div>
            )}
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">{mentor?.name || 'Mentor'}</h1>
              <p className="text-sm text-muted-foreground">Painel do Mentor</p>
            </div>
          </div>
          <button onClick={handleLogout} className="rounded-2xl bg-card p-2.5 text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="h-5 w-5" />
          </button>
        </div>

        {/* Login URL */}
        {mentor?.slug && (
          <div className="mb-8 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="h-5 w-5 text-primary shrink-0" />
              <h2 className="font-display font-semibold text-foreground">Link de login dos alunos</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 truncate rounded-xl bg-surface border border-border px-4 py-2.5 text-xs font-mono text-muted-foreground">
                {baseUrl}/login/{mentor.slug}
              </code>
              <button
                onClick={copyLoginLink}
                className="shrink-0 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover flex items-center gap-1.5"
              >
                {copiedLoginUrl ? <><Check className="h-3.5 w-3.5" /> Copiado!</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
              </button>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Alunos ativos', value: totalActiveStudents, icon: Users },
            { label: 'Estudaram hoje', value: studentsTodayTotal, icon: TrendingUp },
            { label: 'Média semanal', value: weeklyAvgCardsTotal, icon: BookOpen },
            { label: 'Mais engajado', value: productStats.find(p => p.topEngaged)?.topEngaged.split('@')[0] || '—', icon: Star, isText: true },
          ].map(({ label, value, icon: Icon, isText }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4">
              <Icon className="mb-2 h-5 w-5 text-muted-foreground" />
              <p className={`font-display font-bold text-foreground ${isText ? 'text-sm truncate' : 'text-2xl'}`}>
                {value}
              </p>
              <p className="text-xs font-medium text-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Products List */}
        <h2 className="mb-3 font-display text-lg font-semibold text-foreground">Seus Produtos</h2>
        <div className="mb-8 space-y-3">
          {productStats.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">Nenhum produto encontrado.</p>
            </div>
          ) : (
            productStats.map((p) => (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-semibold text-foreground">{p.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {p.totalStudents} alunos · {p.cardsReviewed.toLocaleString()} cards revisados
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${p.active ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive'}`}>
                    {p.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {inviteLinks[p.id] ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-xl bg-surface border border-border px-3 py-2 text-xs font-mono text-muted-foreground">
                      {inviteLinks[p.id]}
                    </code>
                    <button
                      onClick={() => copyInviteLink(p.id)}
                      className="shrink-0 rounded-xl border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover flex items-center gap-1"
                    >
                      {copiedInvite === p.id ? <><Check className="h-3 w-3" /> Copiado!</> : <><Copy className="h-3 w-3" /> Copiar</>}
                    </button>
                    <button
                      onClick={() => shareInviteLink(p.id, p.name)}
                      className="shrink-0 rounded-xl border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover flex items-center gap-1"
                    >
                      <Share2 className="h-3 w-3" /> Compartilhar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => generateInviteLink(p.id, p.name)}
                    disabled={inviteGenerating[p.id]}
                    className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50"
                  >
                    {inviteGenerating[p.id]
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
                      : <><UserPlus className="h-4 w-4" /> Gerar link de pagamento</>}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Bottom Nav */}
        <div className="grid grid-cols-3 gap-3">
          <Link to="/mentor/alunos" className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-surface-hover">
            <Users className="h-6 w-6 text-primary" />
            <span className="text-xs font-medium text-foreground">Alunos</span>
          </Link>
          <Link to="/mentor/personalizacao" className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-surface-hover">
            <Palette className="h-6 w-6 text-primary" />
            <span className="text-xs font-medium text-foreground">Visual</span>
          </Link>
          <Link to="/mentor/relatorios" className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-surface-hover">
            <BarChart3 className="h-6 w-6 text-primary" />
            <span className="text-xs font-medium text-foreground">Relatórios</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MentorDashboard;
