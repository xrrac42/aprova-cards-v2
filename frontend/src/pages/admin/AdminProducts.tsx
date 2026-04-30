import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { sanitizeCardFields } from '@/lib/html-entities';
import { AdminLayout } from './AdminDashboard';
import { Plus, Search, ChevronRight, Loader2, ToggleLeft, ToggleRight, Copy, X, CheckCircle2, Check, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';



// ─── Duplicate Modal ──────────────────────────────────────────────────────────
interface DuplicateModalProps {
  product: any;
  mentors: any[];
  onClose: () => void;
  onSuccess: (newProductId: string) => void;
}

const DuplicateModal: React.FC<DuplicateModalProps> = ({ product, mentors, onClose, onSuccess }) => {
  const navigate = useNavigate();
  const [name, setName] = useState(`${product.name} — Cópia`);
  const [accessCode, setAccessCode] = useState('');
  const [kiwifyProductId, setKiwifyProductId] = useState('');
  const [mentorId, setMentorId] = useState(product.mentor_id || '');
  const [includeCards, setIncludeCards] = useState(true);
  const [duplicating, setDuplicating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState<{ newProductId: string; disciplines: number; cards: number; duplicates?: number } | null>(null);
  const [error, setError] = useState('');

  const handleDuplicate = async () => {
    if (!name.trim() || !accessCode.trim() || !mentorId) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    setError('');
    setDuplicating(true);
    setProgress(0);
    setStage('Criando produto...');

    try {
      // 1. Create new product (inactive by default)
      const { data: newProduct, error: prodErr } = await supabase
        .from('products')
        .insert({
          mentor_id: mentorId,
          name: name.trim(),
          access_code: accessCode.trim().toUpperCase(),
          kiwify_product_id: kiwifyProductId.trim() || null,
          active: false,
          cover_image_url: (product as any).cover_image_url || null,
        })
        .select()
        .single();

      if (prodErr || !newProduct) throw new Error(prodErr?.message || 'Erro ao criar produto.');

      // 2. Fetch source disciplines
      setStage('Copiando disciplinas...');
      setProgress(5);
      const { data: disciplines } = await supabase
        .from('disciplines')
        .select('id, name, order')
        .eq('product_id', product.id)
        .order('order');

      if (!disciplines?.length) {
        setResult({ newProductId: newProduct.id, disciplines: 0, cards: 0 });
        onSuccess(newProduct.id);
        return;
      }

      // 3. Create all disciplines at once
      const { data: newDiscs, error: discErr } = await supabase
        .from('disciplines')
        .insert(disciplines.map(d => ({ product_id: newProduct.id, name: d.name, order: d.order })))
        .select('id, name');

      if (discErr || !newDiscs) throw new Error(discErr?.message || 'Erro ao copiar disciplinas.');

      let totalCards = 0;
      let totalDuplicates = 0;

      if (includeCards) {
        // 4. Clone cards discipline by discipline in batches
        const BATCH = 500;

        for (let i = 0; i < disciplines.length; i++) {
          const srcDisc = disciplines[i];
          const destDisc = newDiscs[i];

          setStage(`Copiando cards: ${srcDisc.name} (${i + 1}/${disciplines.length})`);
          setProgress(Math.round(10 + (i / disciplines.length) * 85));

          // Fetch existing fronts in the destination discipline for dedup
          const { data: existingCards } = await supabase
            .from('cards')
            .select('front')
            .eq('discipline_id', destDisc.id);

          const existingFronts = new Set(
            existingCards?.map(c => c.front.toLowerCase().trim()) || []
          );

          let offset = 0;
          while (true) {
            const { data: cards } = await supabase
              .from('cards')
              .select('front, back, order')
              .eq('discipline_id', srcDisc.id)
              .eq('product_id', product.id)
              .range(offset, offset + BATCH - 1);

            if (!cards?.length) break;

            const uniqueCards = cards.filter(c => {
              const key = c.front.toLowerCase().trim();
              if (existingFronts.has(key)) return false;
              existingFronts.add(key);
              return true;
            });

            const duplicates = cards.length - uniqueCards.length;
            totalDuplicates += duplicates;

            if (uniqueCards.length > 0) {
              await supabase.from('cards').insert(
                uniqueCards.map(c => {
                  const sanitized = sanitizeCardFields(c);
                  return {
                    front: sanitized.front,
                    back: sanitized.back,
                    order: c.order,
                    product_id: newProduct.id,
                    discipline_id: destDisc.id,
                  };
                })
              );
            }

            totalCards += uniqueCards.length;
            offset += BATCH;
            if (cards.length < BATCH) break;
          }
        }
      }

      setProgress(100);
      setStage('');
      setResult({ newProductId: newProduct.id, disciplines: disciplines.length, cards: totalCards, duplicates: totalDuplicates });
      onSuccess(newProduct.id);
    } catch (e: any) {
      setError(e.message || 'Erro ao duplicar produto.');
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Clonar Produto Completo</h2>
          {!duplicating && !result && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="p-6">
          {/* Success state */}
          {result ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-secondary" />
              <h3 className="font-display text-lg font-semibold text-foreground mb-1">Produto clonado com sucesso!</h3>
              <p className="text-sm text-muted-foreground mb-2">
                {result.disciplines} disciplina{result.disciplines !== 1 ? 's' : ''} e{' '}
                {result.cards.toLocaleString()} card{result.cards !== 1 ? 's' : ''} copiado{result.cards !== 1 ? 's' : ''}
                {result.duplicates ? ` · ${result.duplicates} duplicado${result.duplicates !== 1 ? 's' : ''} ignorado${result.duplicates !== 1 ? 's' : ''}` : ''}.
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-6">
                ⚠️ O produto foi criado como <strong>Inativo</strong>. Ative manualmente quando estiver pronto.
              </p>
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors">
                  Fechar
                </button>
                <button
                  onClick={() => navigate(`/admin/produto/${result.newProductId}`)}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-all"
                >
                  Ir para o produto
                </button>
              </div>
            </div>
          ) : duplicating ? (
            /* Loading state with progress */
            <div className="flex flex-col items-center py-6 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground text-center">{stage}</p>
              <div className="w-full rounded-full bg-muted h-2 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>
          ) : (
            /* Form */
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Produto original: <span className="font-medium text-foreground">{product.name}</span>
              </p>

              {error && (
                <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Nome do novo produto</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors"
                  placeholder="Nome do produto"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Código de acesso</label>
                <input
                  value={accessCode}
                  onChange={e => setAccessCode(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors font-mono"
                  placeholder="Ex: PMGO2025-JOAO"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  ID do Produto na Kiwify
                  <span className="ml-1 text-xs text-muted-foreground">(opcional)</span>
                </label>
                <input
                  value={kiwifyProductId}
                  onChange={e => setKiwifyProductId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors font-mono"
                  placeholder="Ex: prod_abc123xyz"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Pode ser preenchido depois na edição do produto.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Mentor destino</label>
                <select
                  value={mentorId}
                  onChange={e => setMentorId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground focus:border-primary focus:outline-none transition-colors"
                >
                  <option value="">Selecionar mentor...</option>
                  {mentors.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-3 cursor-pointer py-1">
                <button
                  type="button"
                  onClick={() => setIncludeCards(!includeCards)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${includeCards ? 'bg-secondary' : 'bg-muted'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-transform ${includeCards ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm text-foreground">Incluir todos os cards</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleDuplicate}
                  disabled={!name.trim() || !accessCode.trim() || !mentorId}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50"
                >
                  <Copy className="h-4 w-4" />
                  Clonar produto
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Delete Product Modal ─────────────────────────────────────────────────────
const DeleteProductModal: React.FC<{ product: any; onClose: () => void; onDeleted: () => void }> = ({ product, onClose, onDeleted }) => {
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const nameMatches = confirmation === product.name;

  const handleDelete = async () => {
    if (!nameMatches) return;
    setDeleting(true);
    setError('');
    try {
      // Cascade delete in correct order
      await supabase.from('student_progress').delete().eq('product_id', product.id);
      await supabase.from('student_sessions').delete().eq('product_id', product.id);
      await supabase.from('student_access').delete().eq('product_id', product.id);
      await supabase.from('cards').delete().eq('product_id', product.id);
      await supabase.from('disciplines').delete().eq('product_id', product.id);
      const { error: delErr } = await supabase.from('products').delete().eq('id', product.id);
      if (delErr) throw delErr;
      toast.success(`Produto "${product.name}" apagado com sucesso.`);
      onDeleted();
    } catch (e: any) {
      setError(e.message || 'Erro ao apagar produto.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-destructive">Apagar Produto</h2>
          {!deleting && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-foreground space-y-2">
            <p className="font-medium">⚠️ Essa ação é irreversível. Será apagado:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 text-xs">
              <li>O produto <strong className="text-foreground">{product.name}</strong></li>
              <li>Todas as disciplinas vinculadas</li>
              <li>Todos os cards do produto</li>
              <li>Todos os acessos de alunos vinculados</li>
              <li>Todo o progresso e sessões dos alunos</li>
            </ul>
          </div>

          {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

          <div>
            <label className="mb-1.5 block text-sm text-foreground">
              Para confirmar, digite o nome do produto: <strong>{product.name}</strong>
            </label>
            <input
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
              disabled={deleting}
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-destructive focus:outline-none transition-colors"
              placeholder="Digite o nome exato do produto"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} disabled={deleting} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={!nameMatches || deleting}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-destructive py-2.5 text-sm font-medium text-destructive-foreground hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {deleting ? 'Apagando...' : 'Apagar permanentemente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const AdminProducts: React.FC = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [products, setProducts] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMentor, setFilterMentor] = useState('');
  const [duplicatingProduct, setDuplicatingProduct] = useState<any | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<any | null>(null);

  useEffect(() => {
    if (!session || session.role !== 'admin') { navigate('/login'); return; }
    load();
  }, []);

  const load = async () => {
    const [{ data: prods }, { data: mnts }] = await Promise.all([
      supabase.from('products').select('*, mentors(name)').order('created_at', { ascending: false }),
      supabase.from('mentors').select('id, name').order('name'),
    ]);
    setProducts(prods || []);
    setMentors(mnts || []);
    setLoading(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('products').update({ active: !active }).eq('id', id);
    load();
  };

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.access_code.toLowerCase().includes(search.toLowerCase());
    const matchMentor = !filterMentor || p.mentor_id === filterMentor;
    return matchSearch && matchMentor;
  });

  return (
    <AdminLayout>
      {duplicatingProduct && (
        <DuplicateModal
          product={duplicatingProduct}
          mentors={mentors}
          onClose={() => setDuplicatingProduct(null)}
          onSuccess={() => { load(); }}
        />
      )}

      {deletingProduct && (
        <DeleteProductModal
          product={deletingProduct}
          onClose={() => setDeletingProduct(null)}
          onDeleted={() => { setDeletingProduct(null); load(); }}
        />
      )}

      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">Produtos</h1>
            <Link to="/admin/produtos/novo" className="flex items-center gap-2 rounded-xl bg-primary px-3 sm:px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-all shrink-0">
              <Plus className="h-4 w-4" /> <span className="hidden xs:inline">Novo</span> Produto
            </Link>
          </div>

          <div className="mb-4 flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors"
                placeholder="Buscar produto ou código..." />
            </div>
            <select value={filterMentor} onChange={e => setFilterMentor(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-primary focus:outline-none transition-colors">
              <option value="">Todos os mentores</option>
              {mentors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <>
<div className="space-y-3">
              {filtered.map(p => (
                <div key={p.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-semibold text-foreground truncate">{p.name}</h3>
                        {!(p as any).cover_image_url && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 shrink-0">
                            <AlertTriangle className="h-3 w-3" /> Sem capa
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        <span className="font-mono">{p.access_code}</span> · {(p.mentors as any)?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setDuplicatingProduct(p)}
                        className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors touch-manipulation"
                        title="Clonar produto"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeletingProduct(p)}
                        className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors touch-manipulation"
                        title="Apagar produto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => toggleActive(p.id, p.active)} className="rounded-lg p-1 text-muted-foreground hover:text-foreground transition-colors touch-manipulation">
                        {p.active ? <ToggleRight className="h-6 w-6 text-secondary" /> : <ToggleLeft className="h-6 w-6" />}
                      </button>
                      <Link to={`/admin/produto/${p.id}`} className="rounded-lg p-2 text-primary hover:bg-primary/10 transition-colors touch-manipulation" title="Gerenciar">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${p.active ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive'}`}>
                      {p.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="rounded-2xl border border-border bg-card p-8 text-center">
                  <p className="text-muted-foreground">Nenhum produto encontrado</p>
                </div>
              )}
            </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminProducts;

