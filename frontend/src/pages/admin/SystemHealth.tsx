import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { AdminLayout } from './AdminDashboard';
import {
  Activity, AlertTriangle, CheckCircle, RefreshCw, Shield,
  XCircle, Loader2, Wifi, LogIn, UserX, BookOpen, Users, Clock, Layers, ChevronDown, MessageSquare
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Incident {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string | null;
  metadata: any;
  resolved: boolean;
  created_at: string;
}

interface GroupedIncident {
  type: string;
  severity: string;
  title: string;
  ids: string[];
  descriptions: string[];
  latest: string;
  resolved: boolean;
  metadata: any;
}

const severityConfig: Record<string, { color: string; icon: typeof AlertTriangle; label: string }> = {
  critical: { color: 'text-destructive', icon: XCircle, label: 'Crítico' },
  warning: { color: 'text-yellow-500', icon: AlertTriangle, label: 'Aviso' },
  info: { color: 'text-primary', icon: Activity, label: 'Info' },
};

const typeConfig: Record<string, { icon: typeof Wifi; label: string }> = {
  webhook_failed: { icon: Wifi, label: 'Webhook' },
  login_failed: { icon: LogIn, label: 'Login' },
  health_critical: { icon: Shield, label: 'Saúde' },
  inactive_student: { icon: UserX, label: 'Inativo' },
};

function groupIncidents(incidents: Incident[]): GroupedIncident[] {
  const groups = new Map<string, GroupedIncident>();

  for (const inc of incidents) {
    // Login failures are now deduped per-email at insert time, group normally
    const key = `${inc.type}__${inc.resolved}`;

    const existing = groups.get(key);
    if (existing) {
      existing.ids.push(inc.id);
      if (inc.description) existing.descriptions.push(inc.description);
      if (inc.created_at > existing.latest) {
        existing.latest = inc.created_at;
        existing.title = inc.title;
      }
      if (inc.metadata) existing.metadata = inc.metadata;
    } else {
      groups.set(key, {
        type: inc.type,
        severity: inc.severity,
        title: inc.title,
        ids: [inc.id],
        descriptions: inc.description ? [inc.description] : [],
        latest: inc.created_at,
        resolved: inc.resolved,
        metadata: inc.metadata,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.latest.localeCompare(a.latest));
}

interface Metrics {
  active_students_today: number;
  cards_studied_today: number;
  sessions_today: number;
  uptime_hours: number | null;
}

interface ResolveException {
  id: string;
  type: string;
  reference_key: string;
  resolved_by: string | null;
  resolved_at: string;
  note: string | null;
}

const SystemHealth: React.FC = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [resolvedIncidents, setResolvedIncidents] = useState<Incident[]>([]);
  const [exceptions, setExceptions] = useState<ResolveException[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [score, setScore] = useState(100);
  const [stats, setStats] = useState({ webhooks24h: 0, logins24h: 0, inactive: 0 });
  const [metrics, setMetrics] = useState<Metrics>({ active_students_today: 0, cards_studied_today: 0, sessions_today: 0, uptime_hours: null });

  // Resolve modal state
  const [resolveModal, setResolveModal] = useState<{ open: boolean; group: GroupedIncident | null }>({ open: false, group: null });
  const [resolveNote, setResolveNote] = useState('');
  const [resolving, setResolving] = useState(false);


  useEffect(() => {
    if (!session || session.role !== 'admin') { navigate('/login'); return; }
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    setLoading(true);
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ data: unresolvedIncidents }, { data: resolvedData }, { data: webhooks }, { data: logins }, { data: inactives }, { data: exceptionsData }] = await Promise.all([
      supabase.from('system_incidents').select('*').eq('resolved', false).order('created_at', { ascending: false }).limit(30),
      supabase.from('system_incidents').select('*').eq('resolved', true).order('created_at', { ascending: false }).limit(50),
      supabase.from('system_incidents').select('id').eq('type', 'webhook_failed').gte('created_at', last24h),
      supabase.from('system_incidents').select('id').eq('type', 'login_failed').gte('created_at', last24h),
      supabase.from('system_incidents').select('id').eq('type', 'inactive_student').eq('resolved', false),
      supabase.from('health_check_exceptions').select('*').order('resolved_at', { ascending: false }),
    ]);

    setIncidents((unresolvedIncidents as Incident[]) || []);
    setResolvedIncidents((resolvedData as Incident[]) || []);
    setExceptions((exceptionsData as ResolveException[]) || []);
    setStats({
      webhooks24h: webhooks?.length || 0,
      logins24h: logins?.length || 0,
      inactive: inactives?.length || 0,
    });

    let s = 100;
    const unresolved = unresolvedIncidents || [];
    const criticalWebhooks = unresolved.filter((i: any) => i.type === 'webhook_failed').length;
    const loginFailures = unresolved.filter((i: any) => i.type === 'login_failed').length;
    const inactiveStudents = unresolved.filter((i: any) => i.type === 'inactive_student').length;
    s -= criticalWebhooks * 30;
    s -= loginFailures >= 10 ? 20 : loginFailures > 0 ? 10 : 0;
    s -= inactiveStudents * 5;
    setScore(Math.max(0, s));
    setLoading(false);
  };

  const runHealthCheck = async () => {
    setChecking(true);
    try {
      const backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
      const resp = await fetch(`${backendURL}/api/v1/admin/health-check`);
      const json = await resp.json();
      if (json?.data?.metrics) setMetrics(json.data.metrics);
      await loadIncidents();
    } catch (err) {
      console.error('Erro ao verificar saúde:', err);
    }
    setChecking(false);
  };

  const openResolveModal = (group: GroupedIncident) => {
    setResolveModal({ open: true, group });
    setResolveNote('');
  };

  const confirmResolve = async () => {
    const group = resolveModal.group;
    if (!group) return;
    setResolving(true);

    try {
      // 1. Mark all incidents in group as resolved
      for (const id of group.ids) {
        await supabase.from('system_incidents').update({ resolved: true }).eq('id', id);
      }

      // 2. Save permanent exceptions based on type
      if (group.type === 'inactive_student' && group.metadata?.emails) {
        const emails = group.metadata.emails as string[];
        for (const email of emails) {
          await supabase.from('health_check_exceptions').upsert({
            type: 'inactive_student',
            reference_key: email,
            resolved_by: session?.email || 'admin',
            note: resolveNote || null,
          }, { onConflict: 'type,reference_key' });
        }
      } else {
        // Generic exception by type + description
        const refKey = group.descriptions[0] || group.type;
        await supabase.from('health_check_exceptions').upsert({
          type: group.type,
          reference_key: refKey,
          resolved_by: session?.email || 'admin',
          note: resolveNote || null,
        }, { onConflict: 'type,reference_key' });
      }

      toast.success(`Incidente resolvido e exceção salva!`);
      setResolveModal({ open: false, group: null });
      await loadIncidents();
    } catch (err) {
      console.error('Erro ao resolver:', err);
      toast.error('Erro ao resolver incidente');
    }
    setResolving(false);
  };

  const scoreColor = score >= 80 ? 'text-secondary' : score >= 50 ? 'text-yellow-500' : 'text-destructive';
  const scoreBg = score >= 80 ? 'bg-secondary/10' : score >= 50 ? 'bg-yellow-500/10' : 'bg-destructive/10';
  const grouped = groupIncidents(incidents);
  const groupedResolved = groupIncidents(resolvedIncidents);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const getAcaoRecomendada = (diagnostico: string): string => {
    if (diagnostico.includes('Código não encontrado'))
      return '👉 Verificar se o produto está ativo e enviar o código correto ao aluno';
    if (diagnostico.includes('não cadastrado em student_access'))
      return '👉 Cadastrar o aluno manualmente em student_access';
    if (diagnostico.includes('active=false'))
      return '👉 Verificar reembolso ou reativar acesso manualmente';
    return '👉 Contatar o aluno para verificar os dados';
  };

  const renderIncidentCard = (group: GroupedIncident, showResolveButton: boolean) => {
    const sev = severityConfig[group.severity] || severityConfig.info;
    const typ = typeConfig[group.type] || { icon: Activity, label: group.type };
    const SevIcon = sev.icon;
    const count = group.ids.length;
    const isLoginFailed = group.type === 'login_failed';
    const meta = group.metadata;

    return (
      <div key={`${group.type}-${group.resolved}-${group.latest}`} className={`rounded-2xl border border-border bg-card p-4 ${group.resolved ? 'opacity-60' : ''}`}>
        <div className="flex items-start gap-3">
          <SevIcon className={`h-5 w-5 shrink-0 mt-0.5 ${sev.color}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                group.resolved ? 'bg-secondary/10 text-secondary' :
                group.severity === 'critical' ? 'bg-destructive/10 text-destructive' :
                group.severity === 'warning' ? 'bg-yellow-500/10 text-yellow-500' :
                'bg-primary/10 text-primary'
              }`}>{group.resolved ? 'Resolvido' : sev.label}</span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{typ.label}</span>
              {count > 1 && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{count}x</span>
              )}
            </div>
            <p className="font-medium text-foreground text-sm">{group.title}</p>
            {group.descriptions.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                {group.descriptions.slice(0, 3).join('\n')}
                {group.descriptions.length > 3 && `\ne mais ${group.descriptions.length - 3}...`}
              </p>
            )}

            {/* Login failure diagnostics */}
            {isLoginFailed && meta && (
              <div className="mt-2 rounded-xl border border-border bg-muted/50 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  {meta.email && (
                    <p className="text-xs text-foreground font-medium">📧 {meta.email}</p>
                  )}
                  {meta.tentativas > 1 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                      {meta.tentativas}x tentativas
                    </span>
                  )}
                </div>
                {meta.diagnostico && (
                  <p className="text-xs text-muted-foreground">🔍 {meta.diagnostico}</p>
                )}
                {meta.access_code_tentado && (
                  <p className="text-xs text-muted-foreground font-mono">🔑 Código: {meta.access_code_tentado}</p>
                )}
                {meta.ultima_tentativa && (
                  <p className="text-xs text-muted-foreground">🕐 Última: {new Date(meta.ultima_tentativa).toLocaleString('pt-BR')}</p>
                )}
                <p className="text-xs text-primary font-medium mt-1">
                  {meta.acao_recomendada || getAcaoRecomendada(meta.diagnostico || '')}
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-1">{new Date(group.latest).toLocaleString('pt-BR')}</p>
          </div>
          {showResolveButton && (
            <button
              onClick={() => openResolveModal(group)}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-secondary bg-secondary/10 hover:bg-secondary/20 transition-colors"
            >
              {count > 1 ? `Resolver todos (${count})` : 'Resolver'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">Saúde do Sistema</h1>
              <p className="text-sm text-muted-foreground">Monitoramento e alertas automáticos</p>
            </div>
            <button
              onClick={runHealthCheck}
              disabled={checking}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
            >
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Verificar agora
            </button>
          </div>

          {/* Score */}
          <div className={`mb-6 rounded-2xl border border-border ${scoreBg} p-6 text-center`}>
            <p className="text-sm font-medium text-muted-foreground mb-1">Score de Saúde</p>
            <p className={`font-display text-6xl font-bold ${scoreColor}`}>{score}</p>
            <p className="text-sm text-muted-foreground mt-1">/100</p>
          </div>

          {/* Metrics row 1 — Alerts */}
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'Falhas de webhook (24h)', value: stats.webhooks24h, icon: Wifi, danger: stats.webhooks24h >= 3 },
              { label: 'Falhas de login (24h)', value: stats.logins24h, icon: LogIn, danger: stats.logins24h >= 5 },
              { label: 'Alunos inativos', value: stats.inactive, icon: UserX, danger: stats.inactive > 0 },
            ].map(({ label, value, icon: Icon, danger }) => (
              <div key={label} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-5 w-5 ${danger ? 'text-destructive' : 'text-muted-foreground'}`} />
                  <span className="text-sm text-muted-foreground">{label}</span>
                </div>
                <p className={`font-display text-3xl font-bold ${danger ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Metrics row 2 — Activity */}
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Alunos ativos hoje', value: metrics.active_students_today, icon: Users },
              { label: 'Cards estudados hoje', value: metrics.cards_studied_today, icon: BookOpen },
              { label: 'Sessões hoje', value: metrics.sessions_today, icon: Layers },
              { label: 'Uptime (horas)', value: metrics.uptime_hours !== null ? `${metrics.uptime_hours}h` : '∞', icon: Clock },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <p className="font-display text-2xl font-bold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          {/* Tabs: Ativos / Resolvidos */}
          <Tabs defaultValue="active">
            <TabsList className="mb-4">
              <TabsTrigger value="active">
                Ativos ({grouped.length})
              </TabsTrigger>
              <TabsTrigger value="resolved">
                Resolvidos ({groupedResolved.reduce((s, g) => s + g.ids.length, 0)})
              </TabsTrigger>
              <TabsTrigger value="exceptions">
                Exceções ({exceptions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              {grouped.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card p-8 text-center">
                  <CheckCircle className="mx-auto h-8 w-8 text-secondary mb-2" />
                  <p className="text-muted-foreground">Nenhum incidente ativo. Sistema saudável! 🎉</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {grouped.map((group) => renderIncidentCard(group, true))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="resolved">
              {groupedResolved.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card p-8 text-center">
                  <p className="text-muted-foreground">Nenhum incidente resolvido ainda.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groupedResolved.map((group) => renderIncidentCard(group, false))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="exceptions">
              {exceptions.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card p-8 text-center">
                  <p className="text-muted-foreground">Nenhuma exceção registrada.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {exceptions.map((exc) => (
                    <div key={exc.id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">
                              {typeConfig[exc.type]?.label || exc.type}
                            </span>
                          </div>
                          <p className="font-medium text-foreground text-sm">{exc.reference_key}</p>
                          {exc.note && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" /> {exc.note}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Resolvido em {new Date(exc.resolved_at).toLocaleString('pt-BR')}
                            {exc.resolved_by && ` por ${exc.resolved_by}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Resolve Modal */}
      <Dialog open={resolveModal.open} onOpenChange={(open) => !open && setResolveModal({ open: false, group: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver incidente</DialogTitle>
            <DialogDescription>
              {resolveModal.group && (
                <>
                  <strong>{resolveModal.group.title}</strong>
                  <br />
                  O incidente será marcado como resolvido e uma exceção permanente será criada para que não seja recriado automaticamente.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Nota (opcional)</label>
            <Input
              placeholder="Ex: aluno contatado, aguardando acesso..."
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveModal({ open: false, group: null })}>
              Cancelar
            </Button>
            <Button onClick={confirmResolve} disabled={resolving}>
              {resolving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar resolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AdminLayout>
  );
};

export default SystemHealth;
