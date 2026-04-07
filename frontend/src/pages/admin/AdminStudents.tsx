import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { AdminLayout } from './AdminDashboard';
import { Search, Loader2, Upload, X, Check, UserPlus, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';

const AdminStudents: React.FC = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [students, setStudents] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMentor, setFilterMentor] = useState('');
  const [filterProduct, setFilterProduct] = useState('');

  // Bulk import state
  const [showImport, setShowImport] = useState(false);
  const [importMentorId, setImportMentorId] = useState('');
  const [importProductId, setImportProductId] = useState('');
  const [importEmails, setImportEmails] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ type: 'success' | 'error'; message: string; count?: number } | null>(null);
  const [accessSearch, setAccessSearch] = useState('');

  const [accessList, setAccessList] = useState<any[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (!session || session.role !== 'admin') { navigate('/login'); return; }
    load();
  }, []);

  useEffect(() => {
    if (importProductId) {
      loadAccessList(importProductId);
    } else {
      setAccessList([]);
    }
  }, [importProductId]);

  const load = async () => {
    // Fetch access data, mentors, products in parallel
    // Use server-side aggregation for sessions via get_mentor_stats or direct aggregation
    const [{ data: accessData }, { data: mnts }, { data: prods }] = await Promise.all([
      supabase.from('student_access').select('id, email, active, created_at, product_id').order('created_at', { ascending: false }),
      supabase.from('mentors').select('id, name').order('name'),
      supabase.from('products').select('id, name, mentor_id').order('name'),
    ]);

    const prodMap = new Map<string, any>();
    for (const p of (prods || [])) prodMap.set(p.id, p);
    const mentorMap = new Map<string, any>();
    for (const m of (mnts || [])) mentorMap.set(m.id, m);

    // Fetch session aggregates per email+product using a paginated approach
    // Since we can't use SQL functions here, we fetch sessions but limit the data
    // We only need: student_email, product_id, cards_reviewed, correct, incorrect, session_date
    let allSessions: any[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data: batch } = await supabase
        .from('student_sessions')
        .select('student_email, product_id, cards_reviewed, correct, incorrect, session_date')
        .range(offset, offset + 999);
      if (!batch || batch.length === 0) break;
      allSessions = allSessions.concat(batch);
      if (batch.length < 1000) hasMore = false;
      offset += 1000;
    }

    // Aggregate sessions by email::product_id
    const sessionMap = new Map<string, { total_reviewed: number; total_correct: number; total_incorrect: number; total_sessions: number; last_session: string | null }>();
    for (const s of allSessions) {
      const key = `${s.student_email}::${s.product_id}`;
      if (!sessionMap.has(key)) {
        sessionMap.set(key, { total_reviewed: 0, total_correct: 0, total_incorrect: 0, total_sessions: 0, last_session: null });
      }
      const agg = sessionMap.get(key)!;
      agg.total_reviewed += s.cards_reviewed;
      agg.total_correct += s.correct;
      agg.total_incorrect += s.incorrect;
      agg.total_sessions += 1;
      if (!agg.last_session || s.session_date > agg.last_session) agg.last_session = s.session_date;
    }

    const studentList = (accessData || []).map(a => {
      const key = `${a.email}::${a.product_id}`;
      const metrics = sessionMap.get(key);
      const prod = prodMap.get(a.product_id);
      const mentor = prod ? mentorMap.get(prod.mentor_id) : null;
      return {
        email: a.email,
        product_id: a.product_id,
        product_name: prod?.name || '—',
        mentor_id: prod?.mentor_id || null,
        mentor_name: mentor?.name || '—',
        last_session: metrics?.last_session || null,
        total_reviewed: metrics?.total_reviewed || 0,
        total_correct: metrics?.total_correct || 0,
        total_sessions: metrics?.total_sessions || 0,
        access_id: a.id,
        active: a.active,
        created_at: a.created_at,
      };
    });

    setStudents(studentList);
    setMentors(mnts || []);
    setProducts(prods || []);
    setLoading(false);
  };

  const loadAccessList = useCallback(async (productId: string) => {
    setLoadingAccess(true);
    const { data, error } = await supabase
      .from('student_access')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar alunos:', error);
    } else {
      setAccessList(data || []);
    }
    setLoadingAccess(false);
  }, []);

  const handleBulkImport = async () => {
    if (!importProductId || !importEmails.trim()) return;

    setImporting(true);
    setImportResult(null);

    const emails = importEmails
      .split('\n')
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0 && e.includes('@'));

    if (emails.length === 0) {
      setImportResult({ type: 'error', message: 'Nenhum e-mail válido encontrado. Use um e-mail por linha.' });
      setImporting(false);
      return;
    }

    const registros = emails.map(email => ({
      email: email.toLowerCase().trim(),
      product_id: importProductId,
      active: true,
    }));

    const { error } = await supabase
      .from('student_access')
      .upsert(registros, { onConflict: 'email,product_id' });

    if (error) {
      console.error('Erro ao salvar alunos:', error);
      setImportResult({ type: 'error', message: `Erro do banco: ${error.message}` });
    } else {
      setImportResult({ type: 'success', message: `Importação concluída!`, count: emails.length });
      setImportEmails('');
      await loadAccessList(importProductId);
    }

    setImporting(false);
  };

  const toggleAccess = async (record: any) => {
    setTogglingId(record.id);
    const { error } = await supabase
      .from('student_access')
      .update({ active: !record.active })
      .eq('id', record.id);

    if (error) {
      console.error('Erro ao alterar acesso:', error);
    } else {
      setAccessList(prev => prev.map(a => a.id === record.id ? { ...a, active: !a.active } : a));
      setStudents(prev => prev.map(s => s.access_id === record.id ? { ...s, active: !record.active } : s));
    }
    setTogglingId(null);
  };

  const toggleMainAccess = async (student: any) => {
    if (!student.access_id) return;
    setTogglingId(student.access_id);
    const newActive = !student.active;
    const { error } = await supabase
      .from('student_access')
      .update({ active: newActive })
      .eq('id', student.access_id);

    if (error) {
      console.error('Erro ao alterar acesso:', error);
    } else {
      setStudents(prev => prev.map(s => s.access_id === student.access_id ? { ...s, active: newActive } : s));
    }
    setTogglingId(null);
  };

  const filteredProducts = filterMentor ? products.filter(p => p.mentor_id === filterMentor) : products;
  const importFilteredProducts = importMentorId ? products.filter(p => p.mentor_id === importMentorId) : products;

  const filtered = students.filter(s => {
    const matchSearch = !search || s.email.toLowerCase().includes(search.toLowerCase());
    const matchMentor = !filterMentor || s.mentor_id === filterMentor;
    const matchProduct = !filterProduct || s.product_id === filterProduct;
    return matchSearch && matchMentor && matchProduct;
  });

  const filteredAccessList = accessList.filter(a =>
    !accessSearch || a.email.toLowerCase().includes(accessSearch.toLowerCase())
  );

  const selectedProductName = products.find(p => p.id === importProductId)?.name;

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Alunos</h1>
              <p className="text-sm text-muted-foreground">{students.length} aluno(s) cadastrado(s)</p>
            </div>
            <button
              onClick={() => { setShowImport(!showImport); setImportResult(null); }}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 shrink-0"
            >
              <UserPlus className="h-4 w-4" />
              Importar Alunos
            </button>
          </div>

          {/* Bulk Import Panel */}
          {showImport && (
            <div className="mb-6 space-y-5 animate-fade-up">
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
                    <Upload className="h-4 w-4 text-primary" />
                    Importação em Lote de Alunos
                  </h2>
                <button onClick={() => { setShowImport(false); setImportMentorId(''); setImportProductId(''); setAccessList([]); setAccessSearch(''); }} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Cole um e-mail por linha. Os alunos serão liberados para acessar o produto mesmo sem passar pela Kiwify.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Mentor</label>
                  <select
                    value={importMentorId}
                    onChange={e => { setImportMentorId(e.target.value); setImportProductId(''); setImportResult(null); setAccessList([]); setAccessSearch(''); }}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-primary focus:outline-none transition-colors"
                  >
                    <option value="">Todos os mentores</option>
                    {mentors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Produto</label>
                  <select
                    value={importProductId}
                    onChange={e => { setImportProductId(e.target.value); setImportResult(null); setAccessSearch(''); }}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-primary focus:outline-none transition-colors"
                    disabled={importFilteredProducts.length === 0}
                  >
                    <option value="">Selecione o produto</option>
                    {importFilteredProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">E-mails (um por linha)</label>
                  <textarea
                    value={importEmails}
                    onChange={e => setImportEmails(e.target.value)}
                    rows={6}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
                    placeholder={"aluno1@email.com\naluno2@email.com\naluno3@email.com"}
                  />
                  {importEmails.trim() && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {importEmails.split('\n').filter(e => e.trim().includes('@')).length} e-mail(s) válido(s) detectado(s)
                    </p>
                  )}
                </div>

                {importResult && (
                  <div className={`rounded-xl px-4 py-3 text-sm ${
                    importResult.type === 'success'
                      ? 'bg-secondary/10 border border-secondary/20 text-secondary'
                      : 'bg-destructive/10 border border-destructive/20 text-destructive'
                  }`}>
                    {importResult.type === 'success' ? (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-medium">{importResult.message}</p>
                          <p className="text-xs opacity-80 mt-0.5">
                            {importResult.count} e-mail(s) processados · Lista de alunos atualizada abaixo
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">Erro na importação</p>
                        <p className="text-xs opacity-80 mt-0.5">{importResult.message}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleBulkImport}
                    disabled={importing || !importProductId || !importEmails.trim()}
                    className="flex items-center gap-2 rounded-xl bg-secondary px-6 py-2.5 font-medium text-secondary-foreground transition-all hover:opacity-90 disabled:opacity-50"
                  >
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {importing ? 'Salvando...' : 'Confirmar Importação'}
                  </button>
                  <button
                    onClick={() => { setImportEmails(''); setImportResult(null); }}
                    className="rounded-xl border border-border px-6 py-2.5 font-medium text-foreground transition-colors hover:bg-surface-hover"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {/* Access List for selected product */}
              {importProductId && (
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-secondary px-4 py-3">
                    <div>
                      <h3 className="font-display text-sm font-semibold text-foreground">
                        Alunos autorizados — {selectedProductName}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {filteredAccessList.length} de {accessList.length} registro(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={accessSearch}
                          onChange={e => setAccessSearch(e.target.value)}
                          placeholder="Buscar e-mail..."
                          className="rounded-lg border border-border bg-surface pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors w-44"
                        />
                      </div>
                      <button
                        onClick={() => loadAccessList(importProductId)}
                        disabled={loadingAccess}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-surface-hover"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${loadingAccess ? 'animate-spin' : ''}`} />
                        Atualizar
                      </button>
                    </div>
                  </div>

                  {loadingAccess ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : accessList.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Nenhum aluno autorizado neste produto ainda.
                    </p>
                  ) : filteredAccessList.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Nenhum resultado para "{accessSearch}".
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">E-mail</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Cadastrado em</th>
                          <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">Status</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredAccessList.map(a => (
                          <tr key={a.id} className="hover:bg-surface-hover transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-foreground">{a.email}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                              {new Date(a.created_at).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                a.active
                                  ? 'bg-secondary/10 text-secondary'
                                  : 'bg-destructive/10 text-destructive'
                              }`}>
                                {a.active ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => toggleAccess(a)}
                                disabled={togglingId === a.id}
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                                title={a.active ? 'Inativar acesso' : 'Ativar acesso'}
                              >
                                {togglingId === a.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : a.active ? (
                                  <ToggleRight className="h-5 w-5 text-secondary" />
                                ) : (
                                  <ToggleLeft className="h-5 w-5" />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sessions filters */}
          <div className="mb-4 flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors"
                placeholder="Buscar por e-mail..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={filterMentor} onChange={e => { setFilterMentor(e.target.value); setFilterProduct(''); }}
                className="rounded-xl border border-border bg-surface px-4 py-3 text-foreground text-sm focus:border-primary focus:outline-none transition-colors">
                <option value="">Todos mentores</option>
                {mentors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
                className="rounded-xl border border-border bg-surface px-4 py-3 text-foreground text-sm focus:border-primary focus:outline-none transition-colors">
                <option value="">Todos produtos</option>
                {filteredProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {filtered.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-8 text-center">
                    <p className="text-muted-foreground">Nenhum aluno encontrado</p>
                  </div>
                ) : filtered.map((s, i) => {
                  const accuracy = s.total_reviewed > 0 ? Math.round((s.total_correct / s.total_reviewed) * 100) : null;
                  return (
                    <div key={i} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-mono font-medium text-foreground truncate">{s.email}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 mb-3">{s.product_name} · {s.mentor_name}</p>
                        </div>
                        <button
                          onClick={() => toggleMainAccess(s)}
                          disabled={togglingId === s.access_id}
                          className="shrink-0"
                          title={s.active ? 'Inativar acesso' : 'Ativar acesso'}
                        >
                          {togglingId === s.access_id ? (
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          ) : s.active ? (
                            <ToggleRight className="h-5 w-5 text-secondary" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">Cards</p>
                          <p className="font-display font-bold text-foreground">{s.total_reviewed}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Acerto</p>
                          <p className={`font-display font-bold ${accuracy === null ? 'text-muted-foreground' : accuracy >= 70 ? 'text-secondary' : accuracy >= 40 ? 'text-primary' : 'text-destructive'}`}>{accuracy !== null ? `${accuracy}%` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Último acesso</p>
                          <p className="font-display font-bold text-foreground text-xs">{s.last_session || 'Nunca'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden">
               <div className="border-b border-border bg-surface-secondary px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground">Todos os alunos cadastrados (compra via webhook ou importação manual)</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">E-mail</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Produto</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Mentor</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Cards</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Acerto</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden lg:table-cell">Último acesso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((s, i) => {
                      const accuracy = s.total_reviewed > 0 ? Math.round((s.total_correct / s.total_reviewed) * 100) : null;
                      return (
                        <tr key={i} className="hover:bg-surface-hover transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-foreground">{s.email}</td>
                          <td className="px-4 py-3 text-muted-foreground text-sm">{s.product_name}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{s.mentor_name}</td>
                          <td className="px-4 py-3 text-right font-medium text-foreground">{s.total_reviewed}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-medium ${accuracy === null ? 'text-muted-foreground' : accuracy >= 70 ? 'text-secondary' : accuracy >= 40 ? 'text-primary' : 'text-destructive'}`}>{accuracy !== null ? `${accuracy}%` : '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => toggleMainAccess(s)}
                              disabled={togglingId === s.access_id}
                              className="inline-flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50"
                              title={s.active ? 'Inativar acesso' : 'Ativar acesso'}
                            >
                              {togglingId === s.access_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : s.active ? (
                                <ToggleRight className="h-5 w-5 text-secondary" />
                              ) : (
                                <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                              )}
                              <span className={s.active ? 'text-secondary' : 'text-muted-foreground'}>{s.active ? 'Ativo' : 'Inativo'}</span>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">{s.last_session || 'Nunca'}</td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum aluno encontrado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminStudents;
