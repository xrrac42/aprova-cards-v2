import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { AdminLayout } from './AdminDashboard';
import { Loader2, CheckCircle2, AlertTriangle, Trash2, Search, ArrowLeft, Bug, Eye, Brain, Filter } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ---- Types ----
interface DuplicateGroup {
  discipline_id: string;
  front: string;
  quantidade: number;
  ids_para_remover: string[];
}

interface DefectiveCard {
  id: string;
  front: string;
  back: string;
  discipline_id: string;
  product_id: string;
  defect_type: string;
}

// ---- Duplicates Tab (unchanged logic) ----
const DuplicatesTab: React.FC = () => {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [totalCards, setTotalCards] = useState(0);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [disciplines, setDisciplines] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [removeResult, setRemoveResult] = useState<number | null>(null);

  const runScan = async () => {
    setScanning(true);
    setScanned(false);
    setRemoveResult(null);
    try {
      const { count } = await supabase.from('cards').select('*', { count: 'exact', head: true });
      setTotalCards(count || 0);
      const { data, error } = await supabase.rpc('find_duplicate_cards');
      if (error) throw error;
      setDuplicates((data as DuplicateGroup[]) || []);
      if (data && data.length > 0) {
        const discIds = [...new Set(data.map((d: any) => d.discipline_id))];
        const { data: discs } = await supabase.from('disciplines').select('id, name').in('id', discIds);
        const map: Record<string, string> = {};
        discs?.forEach(d => { map[d.id] = d.name; });
        setDisciplines(map);
      }
      setScanned(true);
    } catch (err) {
      console.error('Erro na varredura:', err);
    } finally {
      setScanning(false);
    }
  };

  const removeDuplicates = async () => {
    setRemoving(true);
    try {
      const { data, error } = await supabase.rpc('remove_duplicate_cards');
      if (error) throw error;
      setRemoveResult(data as number);
      setDuplicates([]);
    } catch (err) {
      console.error('Erro ao remover duplicados:', err);
    } finally {
      setRemoving(false);
    }
  };

  const totalDuplicateCards = duplicates.reduce((acc, d) => acc + (d.ids_para_remover?.length || 0), 0);
  const affectedDisciplines = new Set(duplicates.map(d => d.discipline_id)).size;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
      {!scanning && !scanned && (
        <button onClick={runScan} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-display font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]">
          <Search className="h-5 w-5" /> Iniciar Varredura
        </button>
      )}
      {scanning && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analisando cards...</p>
        </div>
      )}
      {scanned && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Resultado da Varredura</h2>
          <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
            <p className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 className="h-4 w-4 text-secondary" />
              <span className="font-medium">{totalCards.toLocaleString('pt-BR')}</span> cards verificados
            </p>
            {totalDuplicateCards > 0 ? (
              <>
                <p className="flex items-center gap-2 text-sm text-foreground">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="font-medium">{totalDuplicateCards}</span> cards duplicados encontrados
                </p>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  📋 <span className="font-medium">{affectedDisciplines}</span> disciplina(s) afetada(s)
                </p>
              </>
            ) : (
              <p className="flex items-center gap-2 text-sm text-secondary">
                <CheckCircle2 className="h-4 w-4" /> Nenhum duplicado encontrado!
              </p>
            )}
          </div>
          {removeResult !== null && (
            <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4">
              <p className="text-sm font-medium text-secondary">✅ {removeResult} card(s) duplicado(s) removido(s) com sucesso!</p>
            </div>
          )}
          {totalDuplicateCards > 0 && (
            <div className="flex gap-3">
              <button onClick={removeDuplicates} disabled={removing} className="flex items-center gap-2 rounded-xl bg-destructive px-6 py-2.5 font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50 transition-all">
                {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Remover todos os duplicados
              </button>
              <button onClick={() => setShowDetails(!showDetails)} className="rounded-xl border border-border px-6 py-2.5 font-medium text-foreground hover:bg-accent transition-colors">
                {showDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
              </button>
            </div>
          )}
          {showDetails && duplicates.length > 0 && (
            <div className="space-y-2 rounded-xl border border-border bg-muted p-3 max-h-96 overflow-y-auto">
              {duplicates.slice(0, 50).map((d, i) => (
                <div key={i} className="rounded-lg bg-card p-3 text-sm">
                  <p className="text-xs text-muted-foreground mb-1">{disciplines[d.discipline_id] || 'Disciplina desconhecida'} · {d.quantidade}x</p>
                  <p className="text-foreground truncate">{d.front}</p>
                </div>
              ))}
              {duplicates.length > 50 && <p className="text-center text-xs text-muted-foreground">... e mais {duplicates.length - 50} grupos</p>}
            </div>
          )}
          <button onClick={runScan} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors">
            <Search className="h-4 w-4" /> Executar nova varredura
          </button>
        </div>
      )}
    </div>
  );
};

// ---- Defective Cards Tab ----
const DEFECT_LABELS: Record<string, string> = {
  'Formato corrompido': '⚠ Formato corrompido',
  'Conteúdo vazio': '∅ Conteúdo vazio',
  'Entidades HTML': '🔣 Entidades HTML',
  'Conteúdo truncado': '✂ Conteúdo truncado',
};

const DefectiveTab: React.FC = () => {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [cards, setCards] = useState<DefectiveCard[]>([]);
  const [disciplines, setDisciplines] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);
  const [removeResult, setRemoveResult] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [sampleCards, setSampleCards] = useState<DefectiveCard[]>([]);
  const [sampleDefectType, setSampleDefectType] = useState('');
  const [sampleOpen, setSampleOpen] = useState(false);
  const [fixingEntities, setFixingEntities] = useState(false);
  const [fixProgress, setFixProgress] = useState<{ current: number; total: number } | null>(null);

  const decodeEntities = (text: string): string => {
    let r = text;
    r = r.replace(/&amp;/g, '&');
    r = r.replace(/&lt;/g, '<');
    r = r.replace(/&gt;/g, '>');
    r = r.replace(/&quot;/g, '"');
    r = r.replace(/&#x22;/g, '"');
    r = r.replace(/&#x27;/g, "'");
    r = r.replace(/&#039;/g, "'");
    r = r.replace(/&#39;/g, "'");
    r = r.replace(/&#x3A;/g, ':');
    r = r.replace(/&colon;/g, ':');
    r = r.replace(/&#x2F;/g, '/');
    return r;
  };

  const fixHtmlEntities = async () => {
    const entityCards = grouped['Entidades HTML'] || [];
    if (entityCards.length === 0) return;
    setFixingEntities(true);
    setFixProgress({ current: 0, total: entityCards.length });

    const BATCH = 50;
    let fixed = 0;
    try {
      for (let i = 0; i < entityCards.length; i += BATCH) {
        const batch = entityCards.slice(i, i + BATCH);
        for (const card of batch) {
          await supabase.from('cards').update({
            front: decodeEntities(card.front),
            back: decodeEntities(card.back),
          }).eq('id', card.id);
        }
        fixed += batch.length;
        setFixProgress({ current: fixed, total: entityCards.length });
      }
      setCards(prev => prev.filter(c => c.defect_type !== 'Entidades HTML'));
      setSuccessMsg(`${fixed} cards corrigidos com sucesso`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Erro ao corrigir entidades:', err);
    } finally {
      setFixingEntities(false);
      setFixProgress(null);
    }
  };

  const runScan = async () => {
    setScanning(true);
    setScanned(false);
    setRemoveResult(null);
    setSelected(new Set());
    try {
      const { data, error } = await supabase.rpc('find_defective_cards');
      if (error) throw error;
      const defective = (data as DefectiveCard[]) || [];
      setCards(defective);

      if (defective.length > 0) {
        const discIds = [...new Set(defective.map(c => c.discipline_id))];
        const prodIds = [...new Set(defective.map(c => c.product_id))];

        const [discRes, prodRes] = await Promise.all([
          supabase.from('disciplines').select('id, name').in('id', discIds),
          supabase.from('products').select('id, name').in('id', prodIds),
        ]);

        const dMap: Record<string, string> = {};
        discRes.data?.forEach(d => { dMap[d.id] = d.name; });
        setDisciplines(dMap);

        const pMap: Record<string, string> = {};
        prodRes.data?.forEach(p => { pMap[p.id] = p.name; });
        setProducts(pMap);
      }
      setScanned(true);
    } catch (err) {
      console.error('Erro na varredura de defeitos:', err);
    } finally {
      setScanning(false);
    }
  };

  const toggleCard = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === cards.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(cards.map(c => c.id)));
    }
  };

  const removeSelected = async () => {
    setRemoving(true);
    setConfirmOpen(false);
    setSuccessMsg(null);
    const ids = Array.from(selected);
    const total = ids.length;
    const BATCH_SIZE = 50;
    setProgress({ current: 0, total });

    try {
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        await supabase.from('student_progress').delete().in('card_id', batch);
        const { error } = await supabase.from('cards').delete().in('id', batch);
        if (error) throw error;
        setProgress({ current: Math.min(i + BATCH_SIZE, total), total });
      }

      const count = total;
      setCards(prev => prev.filter(c => !selected.has(c.id)));
      setSelected(new Set());
      setProgress(null);
      setSuccessMsg(`${count} cards removidos com sucesso`);
      setTimeout(() => {
        setSuccessMsg(null);
      }, 2000);
    } catch (err) {
      console.error('Erro ao remover cards defeituosos:', err);
      setProgress(null);
    } finally {
      setRemoving(false);
    }
  };

  // Group cards by defect type
  const grouped = cards.reduce<Record<string, DefectiveCard[]>>((acc, card) => {
    if (!acc[card.defect_type]) acc[card.defect_type] = [];
    acc[card.defect_type].push(card);
    return acc;
  }, {});

  const viewSample = (defectType: string) => {
    const group = grouped[defectType] || [];
    const shuffled = [...group].sort(() => Math.random() - 0.5);
    setSampleCards(shuffled.slice(0, 20));
    setSampleDefectType(DEFECT_LABELS[defectType] || defectType);
    setSampleOpen(true);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
      {/* Sample modal */}
      <Dialog open={sampleOpen} onOpenChange={setSampleOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Amostra — {sampleDefectType} ({sampleCards.length} cards)</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-4">
              {sampleCards.map((card, i) => (
                <div key={card.id} className="rounded-xl border border-border bg-muted p-4 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    #{i + 1} · {disciplines[card.discipline_id] || '—'} · {products[card.product_id] || '—'}
                  </p>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-0.5">Frente:</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{card.front || '(vazio)'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-0.5">Verso:</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{card.back || '(vazio)'}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSampleOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scan / Re-scan */}
      {!scanning && !scanned && (
        <button onClick={runScan} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-display font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]">
          <Bug className="h-5 w-5" /> Verificar agora
        </button>
      )}

      {scanning && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analisando cards...</p>
        </div>
      )}

      {scanned && (
        <div className="space-y-4">
          {/* Counter */}
          <div className="rounded-xl border border-border bg-muted/50 p-4">
            {cards.length > 0 ? (
              <p className="flex items-center gap-2 text-sm text-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="font-medium">{cards.length}</span> cards defeituosos encontrados
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-secondary">
                <CheckCircle2 className="h-4 w-4" /> Nenhum card defeituoso encontrado
              </p>
            )}
          </div>

          {removeResult !== null && !successMsg && (
            <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4">
              <p className="text-sm font-medium text-secondary">✅ {removeResult} card(s) defeituoso(s) removido(s) com sucesso!</p>
            </div>
          )}

          {/* Select all + Remove */}
          {cards.length > 0 && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox
                  checked={selected.size === cards.length && cards.length > 0}
                  onCheckedChange={toggleAll}
                />
                Selecionar todos ({selected.size}/{cards.length})
              </label>
              <Button
                variant="destructive"
                size="sm"
                disabled={selected.size === 0 || removing}
                onClick={() => setConfirmOpen(true)}
              >
                {removing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Removendo...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Remover selecionados
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Confirmation */}
          {confirmOpen && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">
                Tem certeza que deseja remover <span className="font-bold">{selected.size}</span> card(s)? Esta ação é permanente e também removerá o progresso dos alunos associado.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={removeSelected} disabled={removing}>
                  {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Confirmar remoção
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {progress && (
            <div className="space-y-2">
              <Progress value={(progress.current / progress.total) * 100} className="h-3" />
              <p className="text-xs text-muted-foreground text-center">
                Removendo {progress.current} de {progress.total} cards...
              </p>
            </div>
          )}

          {/* Success message */}
          {successMsg && (
            <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4">
              <p className="text-sm font-medium text-secondary">✅ {successMsg}</p>
            </div>
          )}

          {/* Fix entities progress */}
          {fixProgress && (
            <div className="space-y-2">
              <Progress value={(fixProgress.current / fixProgress.total) * 100} className="h-3" />
              <p className="text-xs text-muted-foreground text-center">
                Corrigindo {fixProgress.current} de {fixProgress.total} cards...
              </p>
            </div>
          )}

          {Object.entries(grouped).map(([defectType, groupCards]) => (
            <div key={defectType} className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                {DEFECT_LABELS[defectType] || defectType}
                <span className="text-xs font-normal text-muted-foreground">({groupCards.length})</span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => viewSample(defectType)}>
                  <Eye className="h-3 w-3 mr-1" /> Ver amostra
                </Button>
                {defectType === 'Entidades HTML' && (
                  <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={fixHtmlEntities} disabled={fixingEntities}>
                    {fixingEntities ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Corrigir entidades
                  </Button>
                )}
              </h3>
              <div className="space-y-1.5 rounded-xl border border-border bg-muted p-3 max-h-72 overflow-y-auto">
                {groupCards.map(card => (
                  <label key={card.id} className="flex items-start gap-3 rounded-lg bg-card p-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors">
                    <Checkbox
                      checked={selected.has(card.id)}
                      onCheckedChange={() => toggleCard(card.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground mb-1">
                        {disciplines[card.discipline_id] || '—'} · {products[card.product_id] || '—'}
                      </p>
                      <p className="text-foreground truncate">{card.front?.substring(0, 60) || '(vazio)'}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Re-scan */}
          <button onClick={runScan} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors">
            <Bug className="h-4 w-4" /> Verificar novamente
          </button>
        </div>
      )}
    </div>
  );
};

// ---- AI Analysis Tab ----
interface AIResult {
  id: string;
  defeituoso: boolean;
  motivo: string | null;
}

interface AIDefectiveCard {
  id: string;
  front: string;
  back: string;
  discipline_id: string;
  product_id: string;
  motivo: string;
}

const AIAnalysisTab: React.FC = () => {
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [disciplines, setDisciplines] = useState<{ id: string; name: string; product_id: string }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('all');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [progressInfo, setProgressInfo] = useState<{ current: number; total: number } | null>(null);
  const [defectiveCards, setDefectiveCards] = useState<AIDefectiveCard[]>([]);
  const [totalAnalyzed, setTotalAnalyzed] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);
  const [removeProgress, setRemoveProgress] = useState<{ current: number; total: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [skippedBatches, setSkippedBatches] = useState(0);

  // Product/discipline name maps
  const [discMap, setDiscMap] = useState<Record<string, string>>({});
  const [prodMap, setProdMap] = useState<Record<string, string>>({});
  const backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

  useEffect(() => {
    const loadFilters = async () => {
      const [prodRes, discRes] = await Promise.all([
        supabase.from('products').select('id, name').order('name'),
        supabase.from('disciplines').select('id, name, product_id').order('name'),
      ]);
      setProducts(prodRes.data || []);
      setDisciplines(discRes.data || []);
      const pm: Record<string, string> = {};
      prodRes.data?.forEach(p => { pm[p.id] = p.name; });
      setProdMap(pm);
      const dm: Record<string, string> = {};
      discRes.data?.forEach(d => { dm[d.id] = d.name; });
      setDiscMap(dm);
    };
    loadFilters();
  }, []);

  const filteredDisciplines = selectedProduct === 'all'
    ? disciplines
    : disciplines.filter(d => d.product_id === selectedProduct);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalyzed(false);
    setDefectiveCards([]);
    setSelected(new Set());
    setSuccessMsg(null);
    setErrorMsg(null);
    setSkippedBatches(0);

    try {
      // Build query
      let query = supabase.from('cards').select('id, front, back, discipline_id, product_id');
      if (selectedProduct !== 'all') {
        query = query.eq('product_id', selectedProduct);
      }
      if (selectedDiscipline !== 'all') {
        query = query.eq('discipline_id', selectedDiscipline);
      }

      // Fetch all cards (paginated)
      const allCards: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await query.range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allCards.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      if (allCards.length === 0) {
        setAnalyzed(true);
        setTotalAnalyzed(0);
        setAnalyzing(false);
        return;
      }

      setTotalAnalyzed(allCards.length);
      const BATCH = 20;
      const results: AIDefectiveCard[] = [];
      let skipped = 0;

      for (let i = 0; i < allCards.length; i += BATCH) {
        const batch = allCards.slice(i, i + BATCH);
        setProgressInfo({ current: Math.min(i + BATCH, allCards.length), total: allCards.length });

        try {
          const resp = await fetch(`${backendURL}/api/v1/admin/cards/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cards: batch.map(c => ({ id: c.id, front: c.front, back: c.back })),
            }),
          });

          if (!resp.ok) {
            console.error('Batch error:', resp.status);
            skipped++;
            continue;
          }

          const jsonResp = await resp.json();
          const data = jsonResp?.data;
          if (data?.parse_error || !data?.resultados) {
            skipped++;
            continue;
          }

          const defects = (data.resultados as AIResult[]).filter(r => r.defeituoso);
          for (const defect of defects) {
            const card = batch.find(c => c.id === defect.id);
            if (card) {
              results.push({
                id: card.id,
                front: card.front,
                back: card.back,
                discipline_id: card.discipline_id,
                product_id: card.product_id,
                motivo: defect.motivo || 'Defeito não especificado',
              });
            }
          }
        } catch (err: any) {
          console.error('Batch exception:', err);
          if (err?.message?.includes('429') || err?.status === 429) {
            // Wait and retry
            await new Promise(r => setTimeout(r, 5000));
            i -= BATCH; // retry this batch
            continue;
          }
          skipped++;
        }
      }

      setDefectiveCards(results);
      setSkippedBatches(skipped);
      setAnalyzed(true);
      setProgressInfo(null);
    } catch (err) {
      console.error('Erro na análise por IA:', err);
      setErrorMsg('Erro ao executar a análise. Tente novamente.');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleCard = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleGroup = (groupCards: AIDefectiveCard[]) => {
    const groupIds = groupCards.map(c => c.id);
    const allSelected = groupIds.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) {
        groupIds.forEach(id => next.delete(id));
      } else {
        groupIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const removeSelected = async () => {
    setRemoving(true);
    setConfirmOpen(false);
    setSuccessMsg(null);
    const ids = Array.from(selected);
    const total = ids.length;
    const BATCH = 50;
    setRemoveProgress({ current: 0, total });

    try {
      for (let i = 0; i < total; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        await supabase.from('student_progress').delete().in('card_id', batch);
        const { error } = await supabase.from('cards').delete().in('id', batch);
        if (error) throw error;
        setRemoveProgress({ current: Math.min(i + BATCH, total), total });
      }
      setDefectiveCards(prev => prev.filter(c => !selected.has(c.id)));
      setSelected(new Set());
      setRemoveProgress(null);
      setSuccessMsg(`${total} cards removidos com sucesso`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Erro ao remover cards:', err);
      setRemoveProgress(null);
    } finally {
      setRemoving(false);
    }
  };

  // Group by motivo
  const grouped = defectiveCards.reduce<Record<string, AIDefectiveCard[]>>((acc, card) => {
    if (!acc[card.motivo]) acc[card.motivo] = [];
    acc[card.motivo].push(card);
    return acc;
  }, {});

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
      {!analyzing && !analyzed && (
        <div className="space-y-4">
          {/* Scope selection */}
          <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Filter className="h-4 w-4" /> Escopo da análise
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Produto</label>
                <Select value={selectedProduct} onValueChange={(v) => { setSelectedProduct(v); setSelectedDiscipline('all'); }}>
                  <SelectTrigger><SelectValue placeholder="Todos os produtos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Disciplina</label>
                <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline}>
                  <SelectTrigger><SelectValue placeholder="Todas as disciplinas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as disciplinas</SelectItem>
                    {filteredDisciplines.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-amber-500/5 p-4">
            <p className="text-xs text-muted-foreground">⚠ Esta análise processa os cards em lotes e pode levar alguns minutos.</p>
          </div>

          <button onClick={runAnalysis} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-display font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]">
            <Brain className="h-5 w-5" /> Analisar cards por IA
          </button>
        </div>
      )}

      {analyzing && (
        <div className="space-y-4 py-4">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Analisando com IA...</p>
          </div>
          {progressInfo && (
            <div className="space-y-2">
              <Progress value={(progressInfo.current / progressInfo.total) * 100} className="h-3" />
              <p className="text-xs text-muted-foreground text-center">
                Analisando {progressInfo.current} de {progressInfo.total} cards...
              </p>
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{errorMsg}</p>
        </div>
      )}

      {analyzed && (
        <div className="space-y-4">
          {/* Counter */}
          <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-1">
            {defectiveCards.length > 0 ? (
              <p className="flex items-center gap-2 text-sm text-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="font-medium">{defectiveCards.length}</span> cards defeituosos encontrados de <span className="font-medium">{totalAnalyzed}</span> analisados
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-secondary">
                <CheckCircle2 className="h-4 w-4" /> Nenhum card defeituoso encontrado ({totalAnalyzed} analisados)
              </p>
            )}
            {skippedBatches > 0 && (
              <p className="text-xs text-muted-foreground">⚠ {skippedBatches} lote(s) pulado(s) por erro de processamento</p>
            )}
          </div>

          {successMsg && (
            <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4">
              <p className="text-sm font-medium text-secondary">✅ {successMsg}</p>
            </div>
          )}

          {/* Select all + Remove */}
          {defectiveCards.length > 0 && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox
                  checked={selected.size === defectiveCards.length && defectiveCards.length > 0}
                  onCheckedChange={() => {
                    if (selected.size === defectiveCards.length) setSelected(new Set());
                    else setSelected(new Set(defectiveCards.map(c => c.id)));
                  }}
                />
                Selecionar todos ({selected.size}/{defectiveCards.length})
              </label>
              <Button variant="destructive" size="sm" disabled={selected.size === 0 || removing} onClick={() => setConfirmOpen(true)}>
                {removing ? <><Loader2 className="h-4 w-4 animate-spin" /> Removendo...</> : <><Trash2 className="h-4 w-4" /> Remover selecionados</>}
              </Button>
            </div>
          )}

          {/* Confirmation */}
          {confirmOpen && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">
                Tem certeza que deseja remover <span className="font-bold">{selected.size}</span> card(s)? Esta ação é permanente.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={removeSelected} disabled={removing}>Confirmar remoção</Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          {removeProgress && (
            <div className="space-y-2">
              <Progress value={(removeProgress.current / removeProgress.total) * 100} className="h-3" />
              <p className="text-xs text-muted-foreground text-center">Removendo {removeProgress.current} de {removeProgress.total} cards...</p>
            </div>
          )}

          {/* Groups by motivo */}
          {Object.entries(grouped).map(([motivo, groupCards]) => (
            <div key={motivo} className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                🤖 {motivo}
                <span className="text-xs font-normal text-muted-foreground">({groupCards.length})</span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs ml-auto" onClick={() => toggleGroup(groupCards)}>
                  {groupCards.every(c => selected.has(c.id)) ? 'Desmarcar grupo' : 'Selecionar grupo'}
                </Button>
              </h3>
              <div className="space-y-1.5 rounded-xl border border-border bg-muted p-3 max-h-80 overflow-y-auto">
                {groupCards.map(card => (
                  <label key={card.id} className="flex items-start gap-3 rounded-lg bg-card p-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors">
                    <Checkbox checked={selected.has(card.id)} onCheckedChange={() => toggleCard(card.id)} className="mt-0.5" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {discMap[card.discipline_id] || '—'} · {prodMap[card.product_id] || '—'}
                      </p>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">Frente:</p>
                        <p className="text-foreground whitespace-pre-wrap text-xs">{card.front || '(vazio)'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">Verso:</p>
                        <p className="text-foreground whitespace-pre-wrap text-xs">{card.back || '(vazio)'}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Re-run */}
          <button onClick={() => { setAnalyzed(false); setDefectiveCards([]); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors">
            <Brain className="h-4 w-4" /> Nova análise
          </button>
        </div>
      )}
    </div>
  );
};

// ---- Main Page ----
const CardQuality: React.FC = () => {
  const navigate = useNavigate();
  const session = getSession();

  if (!session || session.role !== 'admin') {
    navigate('/login');
    return null;
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-3xl">
          <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold text-foreground">Varredura de Qualidade</h1>
            <p className="text-sm text-muted-foreground">Encontre e remova cards duplicados ou defeituosos</p>
          </div>

          <Tabs defaultValue="duplicados" className="space-y-4">
            <TabsList className="w-full">
              <TabsTrigger value="duplicados" className="flex-1">Duplicados</TabsTrigger>
              <TabsTrigger value="defeituosos" className="flex-1">Cards com Defeito</TabsTrigger>
              <TabsTrigger value="ia" className="flex-1">Análise por IA</TabsTrigger>
            </TabsList>
            <TabsContent value="duplicados">
              <DuplicatesTab />
            </TabsContent>
            <TabsContent value="defeituosos">
              <DefectiveTab />
            </TabsContent>
            <TabsContent value="ia">
              <AIAnalysisTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AdminLayout>
  );
};

export default CardQuality;
