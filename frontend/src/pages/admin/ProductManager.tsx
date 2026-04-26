import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { sanitizeCardFields } from '@/lib/html-entities';
import CardContent from '@/components/CardContent';
import { ArrowLeft, Plus, Trash2, Search, Edit, BookOpen, CreditCard, Loader2, GripVertical, ChevronDown, ChevronRight, Download, AlertTriangle, Settings, ImageIcon, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';


const CARDS_PAGE_SIZE = 50;

const ProductManager: React.FC = () => {
  const { id: productId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const session = getSession();

  const [product, setProduct] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'disciplines' | 'cards'>('disciplines');
  const [disciplines, setDisciplines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCardCount, setTotalCardCount] = useState(0);

  // Discipline modal
  const [showDisciplineModal, setShowDisciplineModal] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<any>(null);
  const [disciplineName, setDisciplineName] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Cards tab: server-side pagination per discipline
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>('');
  const [cardsPage, setCardsPage] = useState(0);
  const [paginatedCards, setPaginatedCards] = useState<any[]>([]);
  const [filteredCardCount, setFilteredCardCount] = useState(0);
  const [cardsLoading, setCardsLoading] = useState(false);

  const [deletingDisciplineId, setDeletingDisciplineId] = useState<string | null>(null);
  const [deletingDisciplineCards, setDeletingDisciplineCards] = useState(false);
  const [editingCard, setEditingCard] = useState<any>(null);
  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');

  useEffect(() => {
    if (!session || session.role !== 'admin') { navigate('/login'); return; }
    loadDisciplines();
  }, []);

  // Load cards when tab/filter/page changes
  useEffect(() => {
    if (activeTab === 'cards') {
      loadCardsPage();
    }
  }, [activeTab, selectedDisciplineId, cardsPage, searchQuery]);

  const loadDisciplines = async () => {
      if (!productId) {
        toast.error('Produto inválido');
        return;
      }

      setLoading(true);
      const backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
      try {
        // Fetch product from Supabase (for mentor info)
        const { data: prod, error: prodErr } = await supabase
          .from('products')
          .select('*, mentors(name)')
          .eq('id', productId)
          .maybeSingle();
        if (prodErr) throw prodErr;
        setProduct(prod);

        // Fetch disciplines from backend (fallback to protected route for older server builds)
        let resp = await fetch(`${backendURL}/api/v1/admin/products/${productId}/disciplines`);
        if (resp.status === 404) {
          resp = await fetch(`${backendURL}/api/v1/products/${productId}/disciplines`);
        }
        if (!resp.ok) {
          const bodyText = await resp.text();
          throw new Error(`Erro ao carregar disciplinas (${resp.status}): ${bodyText || 'sem detalhe'}`);
        }
        const respData = await resp.json();
        const discs = respData?.data || [];

        // Fetch card counts for each discipline from backend API
        const disciplinesWithCount = await Promise.all(
          (discs || []).map(async (d: any) => {
            const countResp = await fetch(
              `${backendURL}/api/v1/admin/products/${productId}/cards?page=1&page_size=1&discipline_id=${encodeURIComponent(d.id)}`
            );
            if (!countResp.ok) {
              const bodyText = await countResp.text();
              console.error('[cards count]', d.id, bodyText || countResp.statusText);
              return { ...d, card_count: 0 };
            }
            const countPayload = await countResp.json();
            return { ...d, card_count: countPayload?.data?.total || 0 };
          })
        );
        setDisciplines(disciplinesWithCount);

        // Fetch total card count from backend API
        const totalResp = await fetch(
          `${backendURL}/api/v1/admin/products/${productId}/cards?page=1&page_size=1`
        );
        if (!totalResp.ok) {
          const bodyText = await totalResp.text();
          throw new Error(`Erro ao carregar total de cards (${totalResp.status}): ${bodyText || 'sem detalhe'}`);
        }
        const totalPayload = await totalResp.json();
        setTotalCardCount(totalPayload?.data?.total || 0);
      } catch (err: any) {
        toast.error(`Erro ao carregar disciplinas: ${err?.message || 'erro desconhecido'}`);
      } finally {
        setLoading(false);
      }
    };

  const loadCardsPage = async () => {
    if (!productId) {
      setPaginatedCards([]);
      setFilteredCardCount(0);
      return;
    }

    setCardsLoading(true);
    const from = cardsPage * CARDS_PAGE_SIZE;
    const to = from + CARDS_PAGE_SIZE - 1;
    const backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

    try {
      const params = new URLSearchParams({
        page: String(cardsPage + 1),
        page_size: String(CARDS_PAGE_SIZE),
      });
      if (selectedDisciplineId) params.set('discipline_id', selectedDisciplineId);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      let cards: any[] = [];
      let total = 0;

      const resp = await fetch(`${backendURL}/api/v1/admin/products/${productId}/cards?${params.toString()}`);
      if (!resp.ok) {
        const bodyText = await resp.text();
        throw new Error(`Erro ao carregar cards (${resp.status}): ${bodyText || 'sem detalhe'}`);
      }
      const payload = await resp.json();
      cards = payload?.data?.data || [];
      total = payload?.data?.total || 0;

      // Resolve discipline name from already-loaded disciplines list
      const enriched = cards.map((c: any) => ({
        ...c,
        disciplines: { name: disciplines.find(d => d.id === c.discipline_id)?.name ?? '' },
      }));

      setPaginatedCards(enriched);
      setFilteredCardCount(total);
    } catch (err: any) {
      console.error('[cards list]', err);
      toast.error(`Erro ao carregar cards: ${err?.message || 'erro desconhecido'}`);
      setPaginatedCards([]);
      setFilteredCardCount(0);
    } finally {
      setCardsLoading(false);
    }
  };

  const getDiscCardCount = (disc: any) => {
    const fromCardCount = disc.card_count;
    const fromCards = disc.cards?.[0]?.count;
    return fromCardCount ?? fromCards ?? 0;
  };

  const exportDisciplineCSV = async (disc: any) => {
    // Fetch all cards for this discipline for export
    let allCards: any[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data: batch } = await supabase
        .from('cards')
        .select('front, back')
        .eq('discipline_id', disc.id)
        .order('order')
        .range(offset, offset + 999);
      if (!batch || batch.length === 0) break;
      allCards = allCards.concat(batch);
      if (batch.length < 1000) hasMore = false;
      offset += 1000;
    }
    const rows = allCards.map(c => `"${c.front.replace(/"/g, '""')}";"${c.back.replace(/"/g, '""')}"`);
    const csv = ['frente;verso', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${disc.name.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteAllDisciplineCards = async (discId: string) => {
    setDeletingDisciplineCards(true);
    await supabase.from('cards').delete().eq('discipline_id', discId);
    setDeletingDisciplineId(null);
    setDeletingDisciplineCards(false);
    loadDisciplines();
    if (activeTab === 'cards') loadCardsPage();
  };

  // Discipline CRUD
  const saveDiscipline = async () => {
    if (!disciplineName.trim()) {
      toast.error('Informe o nome da disciplina.');
      return;
    }
    if (!productId) {
      toast.error('Produto inválido para criar disciplina.');
      return;
    }

    const backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

    if (editingDiscipline) {
      const resp = await fetch(`${backendURL}/api/v1/admin/disciplines/${editingDiscipline.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: disciplineName.trim() }),
      });

      if (!resp.ok) {
        const error = await resp.json();
        toast.error(`Erro ao atualizar disciplina: ${error.error || 'Erro desconhecido'}`);
        return;
      }
      toast.success('Disciplina atualizada com sucesso.');
    } else {
      const nextOrder = disciplines.length;
      const resp = await fetch(`${backendURL}/api/v1/admin/products/${productId}/disciplines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          product_id: productId,
          name: disciplineName.trim(), 
          order: nextOrder 
        }),
      });

      if (!resp.ok) {
        const error = await resp.json();
        toast.error(`Erro ao criar disciplina: ${error.error || 'Erro desconhecido'}`);
        return;
      }
      toast.success('Disciplina criada com sucesso.');
    }

    setShowDisciplineModal(false);
    setEditingDiscipline(null);
    setDisciplineName('');
    loadDisciplines();
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...disciplines];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    setDisciplines(reordered);
    setDragIndex(null);
    setDragOverIndex(null);

    const backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
    await Promise.all(
      reordered.map((disc, idx) =>
        fetch(`${backendURL}/api/v1/admin/disciplines/${disc.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: idx }),
        })
      )
    );
  };

  const deleteDiscipline = async (id: string) => {
    if (!confirm('Excluir disciplina e todos os cards?')) return;
    const backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
    await fetch(`${backendURL}/api/v1/admin/disciplines/${id}`, { method: 'DELETE' });
    loadDisciplines();
  };

  // Card CRUD
  const saveCard = async () => {
    if (!editingCard) return;
    const sanitized = sanitizeCardFields({ front: cardFront, back: cardBack });

    await supabase
      .from('cards')
      .update({ front: sanitized.front, back: sanitized.back })
      .eq('id', editingCard.id);
    setEditingCard(null);
    loadCardsPage();
  };

  const deleteCard = async (id: string) => {
    if (!confirm('Excluir card?')) return;
    await supabase.from('cards').delete().eq('id', id);
    loadCardsPage();
    loadDisciplines();
  };

  const totalPages = Math.ceil(filteredCardCount / CARDS_PAGE_SIZE);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tabs = [
    { key: 'disciplines' as const, label: 'Disciplinas', icon: BookOpen },
    { key: 'cards' as const, label: 'Cards', icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <button onClick={() => navigate('/admin')} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors touch-manipulation">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">{product?.name}</h1>
            <p className="text-sm text-muted-foreground">Código: {product?.access_code} · {totalCardCount.toLocaleString()} cards</p>
            {!product?.cover_image_url && (
              <Link to={`/admin/produtos/editar/${productId}`} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline">
                <ImageIcon className="h-3 w-3" /> Adicionar imagem de capa
              </Link>
            )}
          </div>
          <Link
            to={`/admin/produtos/editar/${productId}`}
            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors shrink-0"
          >
            <Settings className="h-4 w-4" /> Editar
          </Link>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-border bg-card p-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-2 sm:px-3 py-2.5 text-sm font-medium transition-colors touch-manipulation ${activeTab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden xs:inline sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* DISCIPLINES TAB */}
        {activeTab === 'disciplines' && (
          <div className="space-y-3">
            <button
              onClick={() => { setShowDisciplineModal(true); setEditingDiscipline(null); setDisciplineName(''); }}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-all hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Adicionar Disciplina
            </button>

            {disciplines.map((disc, index) => (
              <div
                key={disc.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                className={`rounded-2xl border bg-card p-4 transition-all ${
                  dragOverIndex === index && dragIndex !== index
                    ? 'border-primary scale-[1.01] shadow-md'
                    : 'border-border'
                } ${dragIndex === index ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-5 w-5 cursor-grab text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing" />
                    <div>
                      <h3 className="font-display font-semibold text-foreground">{disc.name}</h3>
                      <p className="text-xs text-muted-foreground">{getDiscCardCount(disc)} cards</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingDiscipline(disc); setDisciplineName(disc.name); setShowDisciplineModal(true); }}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteDiscipline(disc.id)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

        {/* CARDS TAB — Server-side paginated */}
        {activeTab === 'cards' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCardsPage(0); }}
                  className="w-full rounded-xl border border-border bg-surface pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  placeholder="Buscar por texto..."
                />
              </div>
              <select
                value={selectedDisciplineId}
                onChange={(e) => { setSelectedDisciplineId(e.target.value); setCardsPage(0); }}
                className="rounded-xl border border-border bg-surface px-4 py-3 text-foreground text-sm focus:border-primary focus:outline-none transition-colors"
              >
                <option value="">Todas as disciplinas</option>
                {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{filteredCardCount.toLocaleString()} card{filteredCardCount !== 1 ? 's' : ''}</span>
              {totalPages > 1 && (
                <span>Página {cardsPage + 1} de {totalPages}</span>
              )}
            </div>

            {cardsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : paginatedCards.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-8 text-center">
                <p className="text-muted-foreground">Nenhum card encontrado</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                {paginatedCards.map(card => (
                  <div key={card.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm"><CardContent text={card.front} /></p>
                        <p className="text-sm text-muted-foreground mt-1"><CardContent text={card.back} /></p>
                        <p className="text-xs text-muted-foreground/60 mt-1">{(card.disciplines as any)?.name}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditingCard(card); setCardFront(card.front); setCardBack(card.back); }}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors">
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => deleteCard(card.id)}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-1">
                <button
                  onClick={() => setCardsPage(p => Math.max(0, p - 1))}
                  disabled={cardsPage === 0}
                  className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  ← Anterior
                </button>
                <span className="text-xs text-muted-foreground">
                  {cardsPage * CARDS_PAGE_SIZE + 1}–{Math.min((cardsPage + 1) * CARDS_PAGE_SIZE, filteredCardCount)} de {filteredCardCount.toLocaleString()}
                </span>
                <button
                  onClick={() => setCardsPage(p => p + 1)}
                  disabled={cardsPage + 1 >= totalPages}
                  className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  Próximo →
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Delete All Cards Confirmation Modal */}
      {deletingDisciplineId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
              <h3 className="font-display font-semibold text-foreground">Excluir todos os cards?</h3>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              Todos os cards desta disciplina serão permanentemente excluídos. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => deleteAllDisciplineCards(deletingDisciplineId)}
                disabled={deletingDisciplineCards}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-destructive py-3 font-medium text-destructive-foreground disabled:opacity-50"
              >
                {deletingDisciplineCards ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir todos
              </button>
              <button
                onClick={() => setDeletingDisciplineId(null)}
                disabled={deletingDisciplineCards}
                className="flex-1 rounded-xl border border-border py-3 font-medium text-foreground hover:bg-surface-hover transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discipline Modal */}
      {showDisciplineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowDisciplineModal(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 font-display font-semibold text-foreground">
              {editingDiscipline ? 'Editar Disciplina' : 'Nova Disciplina'}
            </h3>
            <div className="space-y-3">
              <input
                value={disciplineName}
                onChange={e => setDisciplineName(e.target.value)}
                placeholder="Nome da disciplina"
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-primary focus:outline-none transition-colors"
              />
              <div className="flex gap-2">
                <button onClick={saveDiscipline} disabled={!disciplineName}
                  className="flex-1 rounded-xl bg-primary py-3 font-medium text-primary-foreground disabled:opacity-50">
                  Salvar
                </button>
                <button onClick={() => setShowDisciplineModal(false)}
                  className="flex-1 rounded-xl border border-border py-3 font-medium text-foreground">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card Edit Modal */}
      {editingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingCard(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 font-display font-semibold text-foreground">Editar Card</h3>
            <div className="space-y-3">
              <textarea
                value={cardFront}
                onChange={e => setCardFront(e.target.value)}
                rows={3}
                placeholder="Frente"
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-primary focus:outline-none transition-colors resize-none"
              />
              <textarea
                value={cardBack}
                onChange={e => setCardBack(e.target.value)}
                rows={3}
                placeholder="Verso"
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-primary focus:outline-none transition-colors resize-none"
              />
              <div className="flex gap-2">
                <button onClick={saveCard} className="flex-1 rounded-xl bg-primary py-3 font-medium text-primary-foreground">Salvar</button>
                <button onClick={() => setEditingCard(null)} className="flex-1 rounded-xl border border-border py-3 font-medium text-foreground">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProductManager;
