import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeCardFields } from '@/lib/html-entities';
import { X, Loader2, Copy, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface CloneDisciplineModalProps {
  productId: string;
  disciplineId: string;
  disciplineName: string;
  onClose: () => void;
  onComplete: () => void;
}

const CloneDisciplineModal: React.FC<CloneDisciplineModalProps> = ({
  productId,
  disciplineId,
  disciplineName,
  onClose,
  onComplete,
}) => {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [disciplines, setDisciplines] = useState<any[]>([]);
  const [selectedDisciplineId, setSelectedDisciplineId] = useState('');
  const [loadingDiscs, setLoadingDiscs] = useState(false);

  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [previewDups, setPreviewDups] = useState<number>(0);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [cloning, setCloning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ cloned: number; skipped: number } | null>(null);

  // Load all products (except current)
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name')
        .order('name');
      setProducts(data?.filter(p => p.id !== productId) || []);
    };
    load();
  }, [productId]);

  // Load disciplines when product changes
  useEffect(() => {
    if (!selectedProductId) {
      setDisciplines([]);
      setSelectedDisciplineId('');
      return;
    }
    const load = async () => {
      setLoadingDiscs(true);
      setSelectedDisciplineId('');
      setPreviewTotal(null);
      const { data } = await supabase
        .from('disciplines')
        .select('id, name, cards(count)')
        .eq('product_id', selectedProductId)
        .order('order');
      setDisciplines(data || []);
      setLoadingDiscs(false);
    };
    load();
  }, [selectedProductId]);

  // Load preview when discipline selected
  useEffect(() => {
    if (!selectedDisciplineId) {
      setPreviewTotal(null);
      return;
    }
    const load = async () => {
      setLoadingPreview(true);

      // Count source cards
      const { count: sourceCount } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .eq('discipline_id', selectedDisciplineId);

      // Get existing fronts in destination
      const { data: existing } = await supabase
        .from('cards')
        .select('front')
        .eq('discipline_id', disciplineId);

      const existingSet = new Set(
        existing?.map(c => c.front.toLowerCase().trim()) || []
      );

      // Get source fronts to count duplicates
      let allSourceFronts: string[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: batch } = await supabase
          .from('cards')
          .select('front')
          .eq('discipline_id', selectedDisciplineId)
          .range(offset, offset + 999);
        if (!batch || batch.length === 0) break;
        allSourceFronts = allSourceFronts.concat(batch.map(c => c.front));
        if (batch.length < 1000) hasMore = false;
        offset += 1000;
      }

      const dups = allSourceFronts.filter(f => existingSet.has(f.toLowerCase().trim())).length;
      setPreviewTotal(sourceCount || 0);
      setPreviewDups(dups);
      setLoadingPreview(false);
    };
    load();
  }, [selectedDisciplineId, disciplineId]);

  const handleClone = async () => {
    if (!selectedDisciplineId) return;
    setCloning(true);
    setProgress(0);

    // Fetch all source cards
    let allCards: { front: string; back: string }[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data: batch } = await supabase
        .from('cards')
        .select('front, back')
        .eq('discipline_id', selectedDisciplineId)
        .order('order')
        .range(offset, offset + 999);
      if (!batch || batch.length === 0) break;
      allCards = allCards.concat(batch);
      if (batch.length < 1000) hasMore = false;
      offset += 1000;
    }

    // Fetch existing fronts in destination
    const { data: existing } = await supabase
      .from('cards')
      .select('front')
      .eq('discipline_id', disciplineId);

    const existingSet = new Set(
      existing?.map(c => c.front.toLowerCase().trim()) || []
    );

    // Filter new cards
    const seen = new Set<string>();
    const newCards = allCards.filter(c => {
      const key = c.front.toLowerCase().trim();
      if (existingSet.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (newCards.length === 0) {
      setResult({ cloned: 0, skipped: allCards.length });
      setCloning(false);
      return;
    }

    // Insert in batches of 500
    const BATCH_SIZE = 500;
    let inserted = 0;
    for (let i = 0; i < newCards.length; i += BATCH_SIZE) {
      const batch = newCards.slice(i, i + BATCH_SIZE);
      await supabase.from('cards').insert(
        batch.map((card, idx) => {
          const sanitized = sanitizeCardFields(card);

          return {
            product_id: productId,
            discipline_id: disciplineId,
            front: sanitized.front,
            back: sanitized.back,
            order: inserted + idx,
          };
        })
      );
      inserted += batch.length;
      setProgress(Math.round((inserted / newCards.length) * 100));
    }

    setResult({ cloned: inserted, skipped: allCards.length - inserted });
    setCloning(false);
    onComplete();
  };

  const discCardCount = (disc: any) => disc.cards?.[0]?.count || 0;
  const newCards = previewTotal !== null ? previewTotal - previewDups : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-foreground">Clonar cards de outra disciplina</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4 space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-secondary">
                <CheckCircle2 className="h-4 w-4" /> Clonagem concluída!
              </p>
              <p className="text-sm text-foreground">
                Cards clonados: <strong>{result.cloned}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Cards ignorados (duplicados): {result.skipped}
              </p>
              <p className="text-sm text-muted-foreground">
                Disciplina destino: <strong>{disciplineName}</strong>
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-primary py-3 font-medium text-primary-foreground hover:opacity-90 transition-all"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            {/* Product selector */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Produto de origem</label>
              <select
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
                disabled={cloning}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              >
                <option value="">Selecione um produto</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Discipline selector */}
            {selectedProductId && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Disciplina de origem</label>
                {loadingDiscs ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                  </div>
                ) : (
                  <select
                    value={selectedDisciplineId}
                    onChange={e => setSelectedDisciplineId(e.target.value)}
                    disabled={cloning}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  >
                    <option value="">Selecione uma disciplina</option>
                    {disciplines.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({discCardCount(d)} cards)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Preview */}
            {loadingPreview && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analisando cards...
              </div>
            )}

            {previewTotal !== null && !loadingPreview && !cloning && (
              <div className="rounded-xl border border-border bg-surface p-4 space-y-1.5">
                <p className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-secondary" />
                  <strong>{newCards}</strong> cards novos serão clonados para <strong>{disciplineName}</strong>
                </p>
                {previewDups > 0 && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    {previewDups} cards duplicados serão ignorados
                  </p>
                )}
              </div>
            )}

            {/* Progress */}
            {cloning && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-center text-sm text-muted-foreground">Clonando... {progress}%</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleClone}
                disabled={!selectedDisciplineId || cloning || loadingPreview || newCards === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {cloning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {cloning ? 'Clonando...' : `Clonar ${newCards > 0 ? newCards + ' cards' : ''}`}
              </button>
              <button
                onClick={onClose}
                disabled={cloning}
                className="rounded-xl border border-border px-6 py-3 font-medium text-foreground hover:bg-surface-hover transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CloneDisciplineModal;
