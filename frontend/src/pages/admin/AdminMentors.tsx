import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { AdminLayout } from './AdminDashboard';
import { Plus, Edit, Trash2, Search, Loader2, Eye, Upload, Copy, Check, AlertTriangle } from 'lucide-react';

const AdminMentors: React.FC = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [mentors, setMentors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', slug: '', mentor_password: 'MENTOR2025', primary_color: '#6c63ff', secondary_color: '#43e97b', kiwify_webhook_token: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const baseUrl = window.location.origin;

  const copyLoginUrl = async (slug: string) => {
    await navigator.clipboard.writeText(`${baseUrl}/login/${slug}`);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const generateSlug = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  useEffect(() => {
    if (!session || session.role !== 'admin') { navigate('/login'); return; }
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase.from('mentors').select('*').order('created_at', { ascending: false });
    setMentors(data || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', slug: '', mentor_password: 'MENTOR2025', primary_color: '#6c63ff', secondary_color: '#43e97b', kiwify_webhook_token: '' });
    setLogoFile(null);
    setShowModal(true);
  };

  const openEdit = (m: any) => {
    setEditing(m);
    setForm({ name: m.name, email: m.email || '', slug: m.slug, mentor_password: m.mentor_password, primary_color: m.primary_color, secondary_color: m.secondary_color, kiwify_webhook_token: m.kiwify_webhook_token || '' });
    setLogoFile(null);
    setShowModal(true);
  };

  const save = async () => {
    setSaving(true);
    let logoUrl = editing?.logo_url || null;

    if (logoFile) {
      const ext = logoFile.name.split('.').pop();
      const path = `${form.slug || 'mentor'}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('mentor-logos').upload(path, logoFile);
      if (!error) {
        const { data: urlData } = supabase.storage.from('mentor-logos').getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      }
    }

    const payload = { ...form, email: form.email || null, kiwify_webhook_token: form.kiwify_webhook_token || null, logo_url: logoUrl };
    if (editing) {
      await supabase.from('mentors').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('mentors').insert(payload);
    }
    setSaving(false);
    setShowModal(false);
    load();
  };

  const deleteMentor = async (id: string) => {
    if (!confirm('Excluir mentor? Isso pode afetar produtos vinculados.')) return;
    await supabase.from('mentors').delete().eq('id', id);
    load();
  };

  const filtered = mentors.filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">Mentores</h1>
            <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-primary px-3 sm:px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-all shrink-0">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo</span> Mentor
            </button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors"
              placeholder="Buscar por nome ou e-mail..." />
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-3">
              {filtered.map(m => (
                <div key={m.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center" style={{ backgroundColor: m.primary_color + '20' }}>
                        <span className="font-display font-bold" style={{ color: m.primary_color }}>{m.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-foreground truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.email || 'Sem e-mail'} · <span className="font-mono">{m.mentor_password}</span></p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Link to={`/admin/mentor/${m.id}`} className="rounded-lg p-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors touch-manipulation" title="Ver detalhes">
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button onClick={() => openEdit(m)} className="rounded-lg p-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors touch-manipulation">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteMentor(m.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors touch-manipulation">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Login URL or slug warning */}
                  {m.slug ? (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-xl bg-surface border border-border px-3 py-2 text-xs font-mono text-muted-foreground">
                        {baseUrl}/login/{m.slug}
                      </code>
                      <button
                        onClick={() => copyLoginUrl(m.slug)}
                        className="shrink-0 rounded-xl border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover flex items-center gap-1.5"
                      >
                        {copiedSlug === m.slug ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      <span className="text-xs text-destructive font-medium">Sem slug — link de login indisponível</span>
                      <button onClick={() => openEdit(m)} className="ml-auto text-xs text-destructive underline underline-offset-2 shrink-0">Editar</button>
                    </div>
                  )}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="rounded-2xl border border-border bg-card p-8 text-center">
                  <p className="text-muted-foreground">Nenhum mentor encontrado</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-foreground">{editing ? 'Editar Mentor' : 'Novo Mentor'}</h3>
            
            {/* Nome */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome do mentor</label>
              <input type="text" value={form.name}
                onChange={e => {
                  const newName = e.target.value;
                  setForm(f => ({ ...f, name: newName, ...(!editing && !f.slug ? { slug: generateSlug(newName) } : {}) }));
                }}
                className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground focus:border-primary focus:outline-none transition-colors" />
            </div>
            
            {/* Slug */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Slug (URL)</label>
              <input type="text" value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground font-mono focus:border-primary focus:outline-none transition-colors" />
              <p className="mt-1 text-[11px] text-muted-foreground">Gerado automaticamente a partir do nome</p>
            </div>
            
            {/* E-mail */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail do mentor</label>
              <input type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="mentor@email.com"
                className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground focus:border-primary focus:outline-none transition-colors" />
              <p className="mt-1 text-[11px] text-muted-foreground">Usado no login do painel mentor</p>
            </div>
            
            {/* Senha */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Senha do mentor</label>
              <input type="text" value={form.mentor_password}
                onChange={e => setForm(f => ({ ...f, mentor_password: e.target.value }))}
                className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground font-mono focus:border-primary focus:outline-none transition-colors" />
            </div>
            
            {/* Cores */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Cor Primária</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className="h-10 w-14 rounded-lg cursor-pointer" />
                  <span className="font-mono text-xs text-muted-foreground">{form.primary_color}</span>
                </div>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Cor Secundária</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.secondary_color} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} className="h-10 w-14 rounded-lg cursor-pointer" />
                  <span className="font-mono text-xs text-muted-foreground">{form.secondary_color}</span>
                </div>
              </div>
            </div>
            
            {/* Logo */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Upload de logo</label>
              <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground file:cursor-pointer" />
              {editing?.logo_url && !logoFile && (
                <p className="mt-1 text-[11px] text-muted-foreground">Logo atual já configurada</p>
              )}
            </div>
            
            {/* Token Webhook */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Token Webhook Kiwify</label>
              <input type="text" value={form.kiwify_webhook_token}
                onChange={e => setForm(f => ({ ...f, kiwify_webhook_token: e.target.value }))}
                className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground font-mono focus:border-primary focus:outline-none transition-colors"
                placeholder="Cole aqui o token do webhook" />
              <p className="mt-1 text-[11px] text-muted-foreground">Após criar o webhook na Kiwify (Apps → Webhooks), copie o token gerado e cole aqui</p>
            </div>
            
            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={saving || !form.name || !form.slug}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-medium text-primary-foreground disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
              </button>
              <button onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-border py-3 font-medium text-foreground">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminMentors;
