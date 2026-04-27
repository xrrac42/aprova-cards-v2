// REGRA DE NEGÓCIO: O acesso do aluno é controlado pela tabela student_access.
// Um aluno SÓ pode entrar se:
// 1. O access_code existir e estiver ativo na tabela products
// 2. O e-mail estiver cadastrado em student_access com active = true
// Alunos com reembolso ou chargeback têm active = false e não conseguem entrar.
// NUNCA remover essa verificação dupla.

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { login, setSession } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { applyMentorTheme, resetTheme } from '@/lib/theme';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

const normalizeSlug = (value?: string) =>
  decodeURIComponent((value || '').trim())
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();

const isValidSlugFormat = (value: string) =>
  value.length >= 3 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

const asHexColor = (value: string | null | undefined, fallback: string) => {
  const raw = (value || '').trim();
  if (!raw) return fallback;
  const normalized = raw.startsWith('#') ? raw : `#${raw}`;
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback;
};

const resolveLogoUrl = (logoUrl: string | null | undefined) => {
  if (!logoUrl) return null;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  return supabase.storage.from('mentor-logos').getPublicUrl(logoUrl).data.publicUrl;
};

const inferSlugFromHostname = () => {
  if (typeof window === 'undefined') return '';

  const host = window.location.hostname.toLowerCase();
  if (!host || host === 'localhost' || host === '127.0.0.1') return '';

  const parts = host.split('.');
  if (parts.length < 3) return '';

  const subdomain = parts[0];
  if (!subdomain || subdomain === 'www') return '';

  return normalizeSlug(subdomain);
};

const resolvePortalSlug = (routeSlug?: string) => {
  const fromRoute = normalizeSlug(routeSlug);
  if (fromRoute) return fromRoute;

  if (typeof window !== 'undefined') {
    const qp = new URLSearchParams(window.location.search).get('slug') || '';
    const fromQuery = normalizeSlug(qp);
    if (fromQuery) return fromQuery;
  }

  return inferSlugFromHostname();
};

const LoginPage: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const portalSlug = resolvePortalSlug(slug);
  const invalidPortalSlug = !!portalSlug && !isValidSlugFormat(portalSlug);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [mentor, setMentor] = useState<any>(null);
  const [mentorLoading, setMentorLoading] = useState(!!portalSlug && !invalidPortalSlug);
  const [mentorNotFound, setMentorNotFound] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const sanitizedSlug = portalSlug;
    if (!sanitizedSlug) {
      setMentor(null);
      setMentorNotFound(false);
      setMentorLoading(false);
      resetTheme();
      return;
    }

    if (!isValidSlugFormat(sanitizedSlug)) {
      setMentor(null);
      setMentorNotFound(false);
      setMentorLoading(false);
      resetTheme();
      return;
    }

    (async () => {
      setMentorLoading(true);
      setMentorNotFound(false);

      const mentorSelect = 'id, name, slug, logo_url, primary_color, secondary_color';
      let { data, error } = await supabase
        .from('mentors')
        .select(mentorSelect)
        .eq('slug', sanitizedSlug)
        .limit(1);

      let mentorData = data?.[0] ?? null;

      // Fallback case-insensitive lookup for older data with inconsistent casing.
      if (!mentorData && !error) {
        const fallback = await supabase
          .from('mentors')
          .select(mentorSelect)
          .ilike('slug', sanitizedSlug)
          .limit(1);
        mentorData = fallback.data?.[0] ?? null;
        error = fallback.error;
      }

      if (error) {
        console.error('Erro ao carregar mentor por slug:', error.message);
        setMentor(null);
        setMentorNotFound(false);
        setMentorLoading(false);
        return;
      }

      if (mentorData) {
        const preparedMentor = {
          ...mentorData,
          logo_url: resolveLogoUrl((mentorData as any).logo_url),
          primary_color: asHexColor((mentorData as any).primary_color, '#6c63ff'),
          secondary_color: asHexColor((mentorData as any).secondary_color, '#43e97b'),
          accent_color: '#ffd166',
        };

        setMentor(preparedMentor);
        applyMentorTheme(
          preparedMentor.primary_color,
          preparedMentor.secondary_color,
          preparedMentor.accent_color,
        );
      } else {
        setMentor(null);
        setMentorNotFound(true);
      }
      setMentorLoading(false);
    })();

    return () => resetTheme();
  }, [portalSlug]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setLoadingMessage('Verificando acesso...');

    try {
      if (invalidPortalSlug) {
        throw new Error('Slug inválido. Verifique o link de acesso do mentor.');
      }

      const { redirect, session, accessToken } = await login(email, password, (msg) => setLoadingMessage(msg));
      const sanitizedSlug = portalSlug;

      if (sanitizedSlug && session.role === 'aluno') {
        setLoadingMessage('Validando portal do mentor...');

        const validationRes = await fetch(`${BACKEND_URL}/api/v1/auth/validate-student-access`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ slug: sanitizedSlug }),
        });

        if (!validationRes.ok) {
          const payload = await validationRes.json().catch(() => null);
          const serverMessage = payload?.error || 'Acesso negado. Você não possui permissão para acessar este portal.';
          throw new Error(`${serverMessage} Se você acredita que isso é um erro, procure o suporte ou utilize o link correto do seu mentor.`);
        }

        const validationPayload = await validationRes.json();
        if (validationPayload?.data?.mentor_id && validationPayload?.data?.product_id) {
          const portalSession = {
            ...session,
            mentor_id: validationPayload.data.mentor_id,
            mentor_name: mentor?.name,
            product_id: validationPayload.data.product_id,
          };
          setSession(portalSession);
        }
      }
      
      // 🎉 Popup de sucesso
      toast({
        title: '✅ Login realizado com sucesso!',
        description: `Bem-vindo ${session.email}!`,
        duration: 3000,
      });

      console.log('🔐 Usuário autenticado:', {
        email: session.email,
        role: session.role,
        timestamp: new Date().toISOString(),
      });
      
      console.log('📍 Redirecionando para:', redirect);

      // Redirecionar após breve pausa para o usuário ver o toast
      setTimeout(() => {
        console.log('⏩ Executando navigate para:', redirect);
        navigate(redirect);
      }, 1500);
    } catch (err: any) {
      const motivo = err.message || 'Erro desconhecido';
      setError(motivo);

      // 🚨 Popup de erro
      toast({
        title: '❌ Erro ao fazer login',
        description: motivo,
        variant: 'destructive',
        duration: 5000,
      });

      console.error('❌ Erro no login:', motivo);

      // Diagnóstico detalhado para o painel de saúde
      let diagnostico = '';
      let acaoRecomendada = '';
      if (motivo.includes('Código de acesso inválido')) {
        diagnostico = 'Código não encontrado em nenhum produto ativo';
        acaoRecomendada = 'Verificar se o produto está ativo e enviar o código correto ao aluno';
      } else if (motivo.includes('E-mail não encontrado')) {
        diagnostico = 'E-mail não cadastrado em student_access para esse produto';
        acaoRecomendada = 'Cadastrar o aluno manualmente em student_access';
      } else if (motivo.includes('acesso foi cancelado')) {
        diagnostico = 'Aluno com active=false em student_access (reembolso ou cancelamento)';
        acaoRecomendada = 'Verificar reembolso ou reativar acesso manualmente';
      } else {
        diagnostico = motivo;
        acaoRecomendada = 'Contatar o aluno para verificar os dados';
      }

      // Dedup: agrupa falhas do mesmo e-mail em um único incidente
      const normalizedEmail = email.toLowerCase().trim();
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      supabase
        .from('system_incidents')
        .select('id, metadata')
        .eq('type', 'login_failed')
        .eq('resolved', false)
        .ilike('description', `%${normalizedEmail}%`)
        .gte('created_at', last24h)
        .maybeSingle()
        .then(({ data: existente }) => {
          if (existente) {
            const tentativas = (existente.metadata as any)?.tentativas || 1;
            supabase
              .from('system_incidents')
              .update({
                title: `${tentativas + 1} falhas de login — ${normalizedEmail}`,
                metadata: {
                  ...(existente.metadata as any),
                  tentativas: tentativas + 1,
                  motivo,
                  diagnostico,
                  acao_recomendada: acaoRecomendada,
                  access_code_tentado: password.substring(0, 3) + '***',
                  ultima_tentativa: new Date().toISOString(),
                },
              })
              .eq('id', existente.id)
              .then(() => {});
          } else {
            supabase.from('system_incidents').insert({
              type: 'login_failed',
              severity: 'warning',
              title: `1 falha de login — ${normalizedEmail}`,
              description: `E-mail: ${normalizedEmail} — ${motivo}`,
              metadata: {
                email: normalizedEmail,
                motivo,
                diagnostico,
                acao_recomendada: acaoRecomendada,
                access_code_tentado: password.substring(0, 3) + '***',
                tentativas: 1,
                primeira_tentativa: new Date().toISOString(),
                ultima_tentativa: new Date().toISOString(),
              },
            }).then(() => {});
          }
        });
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  if (mentorLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (mentorNotFound) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 gap-4">
        <p className="text-center text-muted-foreground">Mentor não encontrado.</p>
        <button onClick={() => navigate('/login')} className="rounded-2xl bg-primary px-6 py-3 font-display font-semibold text-primary-foreground hover:opacity-90">
          Ir para login
        </button>
      </div>
    );
  }

  if (invalidPortalSlug) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 gap-4">
        <p className="text-center text-muted-foreground">Slug inválido. Verifique o link de acesso do mentor.</p>
        <button onClick={() => navigate('/login')} className="rounded-2xl bg-primary px-6 py-3 font-display font-semibold text-primary-foreground hover:opacity-90">
          Ir para login
        </button>
      </div>
    );
  }

  const mentorName = mentor?.name;
  const mentorInitial = mentorName?.charAt(0) || 'F';

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 pb-safe pt-safe">
      <div className="w-full max-w-sm px-1">
        {/* Logo / Avatar */}
        <div className="mb-8 flex justify-center">
          {mentor?.logo_url ? (
            <img src={mentor.logo_url} alt={mentorName} className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <span className="font-display text-2xl font-bold text-primary">{mentorInitial}</span>
            </div>
          )}
        </div>

        <h1 className="mb-2 text-center font-display text-2xl font-bold text-foreground">
          {mentorName ? `Bem-vindo(a) ao` : 'Bem-vindo'}
        </h1>
        {mentorName && (
          <p className="mb-2 text-center font-display text-lg font-semibold text-primary">{mentorName}</p>
        )}
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Entre com seu e-mail e senha de acesso
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="password">
              Seu código de acesso
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-primary py-3.5 font-display font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {loadingMessage || 'Entrando...'}
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div className="mt-8 border-t border-border pt-4">
          <p className="text-center text-[13px] text-muted-foreground">
            Sua senha foi enviada pelo mentor após a compra
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
