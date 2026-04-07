import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { AdminLayout } from './AdminDashboard';
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';

const AdminMentorDetail: React.FC = () => {
  const navigate = useNavigate();
  const { mentorId } = useParams();
  const session = getSession();
  const [mentor, setMentor] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || session.role !== 'admin') { navigate('/login'); return; }
    load();
  }, []);

  const load = async () => {
    const [{ data: m }, { data: prods }] = await Promise.all([
      supabase.from('mentors').select('*').eq('id', mentorId).maybeSingle(),
      supabase.from('products').select('*').eq('mentor_id', mentorId),
    ]);
    setMentor(m);
    setProducts(prods || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </AdminLayout>
    );
  }

  if (!mentor) {
    return (
      <AdminLayout>
        <div className="p-8 text-center text-muted-foreground">Mentor não encontrado</div>
      </AdminLayout>
    );
  }

  const missingKiwifyProducts = products.filter(p => !p.kiwify_product_id);
  const hasEmail = !!mentor.email;
  const hasToken = !!mentor.kiwify_webhook_token;
  const hasProducts = products.length > 0;

  const checks = [
    { label: 'Mentor cadastrado', ok: true, link: null },
    { label: 'E-mail configurado', ok: hasEmail, link: `/admin/mentores` },
    { label: `Produtos criados (${products.length})`, ok: hasProducts, link: `/admin/produtos` },
    {
      label: missingKiwifyProducts.length > 0
        ? `ID Kiwify faltando em ${missingKiwifyProducts.length} produto${missingKiwifyProducts.length > 1 ? 's' : ''}`
        : 'ID Kiwify configurado em todos os produtos',
      ok: missingKiwifyProducts.length === 0,
      link: missingKiwifyProducts.length > 0 ? `/admin/produtos/editar/${missingKiwifyProducts[0].id}` : null,
    },
    { label: 'Token do webhook configurado', ok: hasToken, link: `/admin/mentores` },
  ];

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-3xl">
          <button onClick={() => navigate('/admin/mentores')} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar para Mentores
          </button>

          {/* Mentor header */}
          <div className="mb-8 flex items-center gap-4">
            {mentor.logo_url ? (
              <img src={mentor.logo_url} alt={mentor.name} className="h-14 w-14 rounded-xl object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl" style={{ backgroundColor: mentor.primary_color + '20' }}>
                <span className="font-display text-2xl font-bold" style={{ color: mentor.primary_color }}>{mentor.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">{mentor.name}</h1>
              <p className="text-sm text-muted-foreground">{mentor.email || 'Sem e-mail'} · <span className="font-mono">{mentor.slug}</span></p>
            </div>
          </div>

          {/* Checklist */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">
              Configuração do Mentor — {mentor.name}
            </h2>
            <div className="space-y-3">
              {checks.map((check, i) => (
                <div key={i} className="flex items-center gap-3">
                  {check.ok ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-secondary" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                  )}
                  <span className={`text-sm ${check.ok ? 'text-foreground' : 'text-amber-600 dark:text-amber-400 font-medium'}`}>
                    {check.label}
                  </span>
                  {!check.ok && check.link && (
                    <Link to={check.link} className="ml-auto text-xs font-medium text-primary hover:underline flex items-center gap-1">
                      Corrigir <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Products list */}
          <h2 className="mt-8 mb-3 font-display text-lg font-semibold text-foreground">Produtos deste Mentor</h2>
          <div className="space-y-3">
            {products.map(p => (
              <Link key={p.id} to={`/admin/produto/${p.id}`}
                className="block rounded-2xl border border-border bg-card p-4 hover:bg-surface-hover transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-semibold text-foreground">{p.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono">{p.access_code}</span>
                      {p.kiwify_product_id ? (
                        <> · Kiwify: <span className="font-mono">{p.kiwify_product_id}</span></>
                      ) : (
                        <span className="ml-2 inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-destructive font-medium">ID Kiwify não configurado</span>
                      )}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${p.active ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive'}`}>
                    {p.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </Link>
            ))}
            {products.length === 0 && (
              <div className="rounded-2xl border border-border bg-card p-8 text-center">
                <p className="text-muted-foreground">Nenhum produto vinculado a este mentor</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminMentorDetail;
