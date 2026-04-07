// REGRA DE NEGÓCIO: O acesso do aluno é controlado pela tabela student_access.
// Um aluno SÓ pode entrar se:
// 1. O access_code existir e estiver ativo na tabela products
// 2. O e-mail estiver cadastrado em student_access com active = true
// Alunos com reembolso ou chargeback têm active = false e não conseguem entrar.
// NUNCA remover essa verificação dupla.

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { login } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { applyMentorTheme, resetTheme } from '@/lib/theme';
import { Loader2 } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [mentor, setMentor] = useState<any>(null);
  const [mentorLoading, setMentorLoading] = useState(!!slug);
  const [mentorNotFound, setMentorNotFound] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug) {
      resetTheme();
      return;
    }
    (async () => {
      setMentorLoading(true);
      const { data } = await supabase
        .from('mentors')
        .select('id, name, logo_url, primary_color, secondary_color, accent_color')
        .eq('slug', slug)
        .maybeSingle();

      if (data) {
        setMentor(data);
        applyMentorTheme(data.primary_color, data.secondary_color, data.accent_color);
      } else {
        setMentorNotFound(true);
      }
      setMentorLoading(false);
    })();

    return () => resetTheme();
  }, [slug]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setLoadingMessage('Verificando acesso...');

    try {
      const { redirect } = await login(email, password, (msg) => setLoadingMessage(msg));
      navigate(redirect);
    } catch (err: any) {
      const motivo = err.message || 'Erro desconhecido';
      setError(motivo);

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
