import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, FileText, Upload, ChevronDown, HelpCircle,
  TextCursorInput, Briefcase, Loader2, CheckCircle2, X,
  CloudUpload, Zap, FlaskConical, type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Progress } from '@/components/ui/progress';
import { startGenerationJob } from '@/lib/generation-api';
import { useGenerationJobPolling } from '@/hooks/useGenerationJobPolling';
import type { GenerationJobStatus } from '@/types/ai-generation';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab        = 'upload' | 'text';
type Archetype  = 'qa' | 'cloze' | 'case';
type ModalState = 'closed' | 'loading' | 'review';

interface DataItem { id: string; name: string; }

interface GeneratedCard { id: string; front: string; back: string; }

const STATUS_LABELS: Record<GenerationJobStatus, { label: string; sub: string }> = {
  pending:    { label: 'Preparando documento…',       sub: 'Dividindo o conteúdo em partes' },
  processing: { label: 'Processando partes…',         sub: 'Gerando cards em paralelo' },
  reducing:   { label: 'Combinando resultados…',      sub: 'Removendo cards duplicados' },
  reviewing:  { label: 'Revisão final de qualidade…', sub: 'A IA está validando os flashcards' },
  completed:  { label: 'Concluído',                   sub: '' },
  failed:     { label: 'Falhou',                      sub: '' },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

interface PremiumSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: DataItem[];
  placeholder: string;
  disabled?: boolean;
}

const PremiumSelect: React.FC<PremiumSelectProps> = ({
  label, value, onChange, options, placeholder, disabled,
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
      {label}
    </label>
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-2.5 pr-9 text-sm text-zinc-100 outline-none transition-all focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
    </div>
  </div>
);

interface SectionHeaderProps {
  step: number;
  title: string;
  right?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ step, title, right }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
        {step}
      </span>
      <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
    </div>
    {right}
  </div>
);

interface AutoResizeTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
}

const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
  value, onChange, placeholder, className,
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  return (
    <textarea
      ref={ref}
      value={value}
      rows={2}
      placeholder={placeholder}
      onChange={onChange}
      onInput={resize}
      className={className}
      style={{ resize: 'none', overflow: 'hidden', minHeight: '52px' }}
    />
  );
};

// ─── Archetype config ─────────────────────────────────────────────────────────

interface ArchetypeOption {
  value: Archetype;
  Icon: LucideIcon;
  title: string;
  desc: string;
}

const ARCHETYPES: ArchetypeOption[] = [
  {
    value: 'qa',
    Icon: HelpCircle,
    title: 'Q&A Direto',
    desc: 'Pergunta objetiva com resposta no verso',
  },
  {
    value: 'cloze',
    Icon: TextCursorInput,
    title: 'Preencher Lacuna',
    desc: 'Completar [ __ ] com o termo correto',
  },
  {
    value: 'case',
    Icon: Briefcase,
    title: 'Caso Hipotético',
    desc: 'Situação prática + análise jurídica',
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

const AiGenerationPanel: React.FC = () => {
  // Destination
  const [mentors, setMentors]               = useState<DataItem[]>([]);
  const [products, setProducts]             = useState<DataItem[]>([]);
  const [disciplines, setDisciplines]       = useState<DataItem[]>([]);
  const [selectedMentor, setSelectedMentor]         = useState('');
  const [selectedProduct, setSelectedProduct]       = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState('');

  // Source
  const [activeTab, setActiveTab]     = useState<Tab>('upload');
  const [isDragging, setIsDragging]   = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [aiDocText, setAiDocText]     = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Guidelines
  const [archetype, setArchetype]     = useState<Archetype>('qa');
  const [preset, setPreset]           = useState('default');
  const [regraDeOuro, setRegraDeOuro] = useState('');

  // Generation / Modal
  const [limit, setLimit]               = useState(30);
  const [modalState, setModalState]     = useState<ModalState>('closed');
  const [editedCards, setEditedCards]   = useState<GeneratedCard[]>([]);
  const [saving, setSaving]             = useState(false);
  const [apiMsg, setApiMsg]             = useState('');
  const [jobId, setJobId]               = useState<string | null>(null);

  const { status: jobStatus } = useGenerationJobPolling(selectedDiscipline || null, jobId);

  // ── React to job progress ─────────────────────────────────────────────────

  useEffect(() => {
    if (!jobStatus) return;
    if (jobStatus.status === 'completed') {
      const rawCards = jobStatus.result?.cards ?? [];
      const cards = rawCards.map((c, i) => ({ id: String(i + 1), front: c.front, back: c.back }));
      if (cards.length === 0) {
        setApiMsg('❌ A IA não gerou nenhum card. Tente fornecer mais contexto ou ajustar as diretrizes.');
        setModalState('closed');
      } else {
        setEditedCards(cards);
        setModalState('review');
      }
      setJobId(null);
    } else if (jobStatus.status === 'failed') {
      setApiMsg(`❌ ${jobStatus.error || 'Erro ao gerar cards'}`);
      setModalState('closed');
      setJobId(null);
    }
  }, [jobStatus]);

  // ── Data fetching ─────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.from('mentors').select('id, name').order('name')
      .then(({ data }) => setMentors(data || []));
  }, []);

  useEffect(() => {
    if (!selectedMentor) { setProducts([]); setSelectedProduct(''); return; }
    supabase.from('products').select('id, name')
      .eq('mentor_id', selectedMentor).eq('active', true).order('name')
      .then(({ data }) => { setProducts(data || []); setSelectedProduct(''); });
  }, [selectedMentor]);

  useEffect(() => {
    if (!selectedProduct) { setDisciplines([]); setSelectedDiscipline(''); return; }
    const backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
    fetch(`${backendURL}/api/v1/admin/products/${selectedProduct}/disciplines`)
      .then(r => r.json())
      .then(data => { setDisciplines(data?.data || []); setSelectedDiscipline(''); })
      .catch(() => { setDisciplines([]); setSelectedDiscipline(''); });
  }, [selectedProduct]);

  // ── File handling ─────────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    setUploadedFile(file);
    setAiDocText('');
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setExtractingPdf(true);
      try {
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          // Page marker gives the backend chunker (pkg/chunker) a real
          // page-aligned cut point when splitting large documents.
          text += content.items.map((item: { str: string }) => item.str).join(' ') + `\n\n[[PAGE ${i}]]\n\n`;
        }
        setAiDocText(text.trim());
      } finally {
        setExtractingPdf(false);
      }
    } else {
      const text = await file.text();
      setAiDocText(text.trim());
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  // ── Generation ────────────────────────────────────────────────────────────

  const handleGenerate = async (isSample: boolean) => {
    if (!selectedDiscipline || !aiDocText.trim()) return;
    setApiMsg('');
    setModalState('loading');
    setEditedCards([]);

    try {
      const res = await startGenerationJob(selectedDiscipline, {
        context: aiDocText,
        limit: isSample ? 1 : limit,
        archetype,
        preset,
        regra_de_ouro: regraDeOuro,
      });
      setJobId(res.job_id);
    } catch (err) {
      setApiMsg(`❌ ${err instanceof Error ? err.message : 'Erro ao gerar cards'}`);
      setModalState('closed');
    }
  };

  const handleSave = async () => {
    if (!selectedDiscipline) return;
    setSaving(true);
    const backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
    try {
      const res = await fetch(
        `${backendURL}/api/v1/admin/disciplines/${selectedDiscipline}/cards/batch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: editedCards.map(c => ({ front: c.front, back: c.back })) }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setApiMsg(`❌ ${data.error || 'Erro ao salvar cards'}`);
      } else {
        setApiMsg(`✅ ${editedCards.length} card(s) salvos na disciplina.`);
        setModalState('closed');
        setAiDocText('');
        setUploadedFile(null);
      }
    } catch {
      setApiMsg('❌ Erro de conexão com o servidor');
    } finally {
      setSaving(false);
    }
  };

  const updateCard = (id: string, field: 'front' | 'back', value: string) =>
    setEditedCards(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));

  // ── Derived ───────────────────────────────────────────────────────────────

  const hasSource  = aiDocText.trim().length >= 10 || !!uploadedFile;
  const isReady    = !!selectedDiscipline && hasSource && !extractingPdf;
  const cardCount  = editedCards.length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ═══════════════════ MAIN PANEL ═══════════════════ */}
      <div className="rounded-2xl border border-zinc-800 bg-[#121214] overflow-hidden">

        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4.5 w-4.5 text-violet-400" />
            <h2 className="font-semibold text-zinc-100">Console de Geração IA (Homologacao)</h2>
          </div>
          <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-400">
            Beta V0.1
          </span>
        </div>

        <div className="divide-y divide-zinc-800/50">

          {/* ── Step 1: Destination ───────────────────────────────────────── */}
          <section className="space-y-4 px-6 py-5">
            <SectionHeader step={1} title="Destino dos Cards" />
            <div className="grid grid-cols-3 gap-3">
              <PremiumSelect
                label="Mentor"
                value={selectedMentor}
                onChange={setSelectedMentor}
                options={mentors}
                placeholder="Selecione o mentor"
              />
              <PremiumSelect
                label="Produto (Curso)"
                value={selectedProduct}
                onChange={setSelectedProduct}
                options={products}
                placeholder="Selecione o produto"
                disabled={!selectedMentor}
              />
              <PremiumSelect
                label="Disciplina"
                value={selectedDiscipline}
                onChange={setSelectedDiscipline}
                options={disciplines}
                placeholder="Selecione a disciplina"
                disabled={!selectedProduct}
              />
            </div>
            {!selectedDiscipline && (
              <p className="rounded-lg border border-amber-500/15 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-400">
                ⚠️ Selecione mentor → produto → disciplina para habilitar a geração.
              </p>
            )}
          </section>

          {/* ── Step 2: Source ────────────────────────────────────────────── */}
          <section className="space-y-4 px-6 py-5">
            <SectionHeader step={2} title="Fonte do Conhecimento" />

            {/* Tab toggle */}
            <div className="flex w-fit gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
              {([
                { value: 'upload' as Tab, label: 'Enviar Arquivo', Icon: Upload },
                { value: 'text'   as Tab, label: 'Colar Texto',    Icon: FileText },
              ] as { value: Tab; label: string; Icon: LucideIcon }[]).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setActiveTab(value)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    activeTab === value
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Upload tab */}
            {activeTab === 'upload' && (
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => !extractingPdf && fileInputRef.current?.click()}
                className={`group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 px-6 transition-all ${
                  isDragging
                    ? 'border-violet-500 bg-violet-500/5'
                    : uploadedFile
                    ? 'border-violet-500/40 bg-violet-500/[0.04]'
                    : 'border-zinc-700 hover:border-violet-500/50 hover:bg-violet-500/[0.03]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {extractingPdf ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                    <p className="text-sm font-medium text-zinc-300">Extraindo texto do PDF…</p>
                  </>
                ) : uploadedFile ? (
                  <>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10">
                      <FileText className="h-5 w-5 text-violet-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-zinc-200">{uploadedFile.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {(uploadedFile.size / 1024).toFixed(1)} KB
                        {aiDocText ? ` · ${aiDocText.split(/\s+/).filter(Boolean).length.toLocaleString()} palavras extraídas` : ''}
                        {' · '}
                        <span className="text-violet-400/70">Clique para substituir</span>
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setUploadedFile(null); setAiDocText(''); }}
                      className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 transition-all group-hover:border-violet-500/30 group-hover:bg-violet-500/5 ${isDragging ? 'border-violet-500 bg-violet-500/10' : ''}`}>
                      <CloudUpload className={`h-5 w-5 transition-colors group-hover:text-violet-400 ${isDragging ? 'text-violet-400' : 'text-zinc-500'}`} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-zinc-300">Clique para enviar um PDF ou TXT</p>
                      <p className="mt-0.5 text-xs text-zinc-600">ou arraste e solte aqui · Máx 50 MB</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Text tab */}
            {activeTab === 'text' && (
              <textarea
                value={aiDocText}
                onChange={e => setAiDocText(e.target.value)}
                rows={8}
                placeholder="Cole aqui o conteúdo do documento, edital, apostila ou anotações..."
                className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
              />
            )}
          </section>

          {/* ── Step 3: Guidelines ───────────────────────────────────────── */}
          <section className="space-y-4 px-6 py-5">
            <SectionHeader
              step={3}
              title="Diretrizes Didáticas"
              right={
                <div className="relative">
                  <select
                    value={preset}
                    onChange={e => setPreset(e.target.value)}
                    className="appearance-none rounded-lg border border-zinc-800 bg-zinc-900 py-1.5 pl-3 pr-7 text-xs text-zinc-400 outline-none transition-colors focus:border-violet-500"
                  >
                    <option value="default">Configuração Padrão</option>
                    <option value="cespe">Estilo CESPE</option>
                    <option value="oab">OAB Jurisprudência</option>
                    <option value="magistratura">Magistratura Denso</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-600" />
                </div>
              }
            />

            {/* Archetype cards */}
            <div className="grid grid-cols-3 gap-2.5">
              {ARCHETYPES.map(({ value, Icon, title, desc }) => {
                const active = archetype === value;
                return (
                  <button
                    key={value}
                    onClick={() => setArchetype(value)}
                    className={`group flex flex-col gap-2.5 rounded-xl border p-4 text-left transition-all ${
                      active
                        ? 'border-violet-500 bg-violet-500/[0.07] shadow-[0_0_0_1px_rgba(139,92,246,0.12)]'
                        : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/70'
                    }`}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                      active ? 'bg-violet-500/15' : 'bg-zinc-800 group-hover:bg-zinc-700'
                    }`}>
                      <Icon className={`h-4 w-4 transition-colors ${active ? 'text-violet-400' : 'text-zinc-400'}`} />
                    </div>
                    <div>
                      <p className={`text-xs font-semibold leading-snug transition-colors ${active ? 'text-violet-200' : 'text-zinc-200'}`}>
                        {title}
                      </p>
                      <p className={`mt-0.5 text-[10px] leading-snug transition-colors ${active ? 'text-violet-400/60' : 'text-zinc-500'}`}>
                        {desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Golden rule */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500">
                Instrução Específica{' '}
                <span className="text-zinc-600">(Opcional)</span>
              </label>
              <input
                type="text"
                value={regraDeOuro}
                onChange={e => setRegraDeOuro(e.target.value.slice(0, 200))}
                placeholder="Ex: Foque em prazos processuais, ignore histórico doutrinário..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
              />
            </div>
          </section>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-zinc-800 bg-[#0a0a0c] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-zinc-500 whitespace-nowrap">Limite de cards</span>
            <input
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={e => setLimit(Math.max(1, Math.min(100, Number(e.target.value))))}
              className="w-20 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-center text-sm text-zinc-100 outline-none transition-colors focus:border-violet-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleGenerate(true)}
              disabled={!isReady}
              title="Gera uma amostra para você validar o tom da IA antes de gastar saldo"
              className="flex items-center gap-2 rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-400 transition-all hover:border-violet-500/40 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FlaskConical className="h-4 w-4" />
              Testar Amostra
            </button>
            <button
              onClick={() => handleGenerate(false)}
              disabled={!isReady}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all hover:bg-violet-500 hover:shadow-[0_0_22px_rgba(139,92,246,0.45)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <Zap className="h-4 w-4" />
              Gerar e Revisar
            </button>
          </div>
        </div>

        {/* API message strip */}
        {apiMsg && (
          <div className={`border-t border-zinc-800 px-6 py-3 text-sm ${apiMsg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>
            {apiMsg}
          </div>
        )}
      </div>

      {/* ═══════════════════ REVIEW MODAL ════════════════════ */}
      {modalState !== 'closed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => !saving && modalState === 'review' && setModalState('closed')}
          />

          {/* Modal card */}
          <div className={`relative z-10 w-full max-w-2xl rounded-2xl border border-zinc-800 bg-[#121214] shadow-2xl transition-all duration-300 ${
            modalState !== 'closed' ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}>

            {/* ── Loading state ── */}
            {modalState === 'loading' && (
              <div className="flex flex-col items-center gap-6 px-8 py-14">
                {/* Spinner ring + icon */}
                <div className="relative h-16 w-16">
                  <div className="absolute inset-0 rounded-full border-2 border-violet-500/15" />
                  <div className="absolute inset-0 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 animate-pulse text-violet-400" />
                  </div>
                </div>

                {/* Phase label — driven by the job's real status, not a timer */}
                <div className="text-center">
                  <p key={`label-${jobStatus?.status ?? 'pending'}`} className="font-semibold text-zinc-100 transition-opacity duration-500">
                    {STATUS_LABELS[jobStatus?.status ?? 'pending'].label}
                  </p>
                  <p key={`sub-${jobStatus?.status ?? 'pending'}`} className="mt-1 text-sm text-zinc-500 transition-opacity duration-500">
                    {jobStatus?.status === 'processing'
                      ? `${jobStatus.completed_chunks} de ${jobStatus.total_chunks} partes concluídas`
                      : STATUS_LABELS[jobStatus?.status ?? 'pending'].sub}
                  </p>
                </div>

                {/* Progress bar — real completed_chunks / total_chunks from polling */}
                <div className="w-full max-w-xs space-y-2">
                  <Progress value={jobStatus?.progress_pct ?? 0} className="h-1.5 bg-zinc-800 [&>div]:bg-violet-500" />
                  <div className="flex items-center justify-end">
                    <span className="text-[10px] text-zinc-600">
                      {jobStatus?.progress_pct ?? 0}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Review state ── */}
            {modalState === 'review' && (
              <>
                {/* Modal header */}
                <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4.5 w-4.5 text-violet-400" />
                    <div>
                      <h3 className="font-semibold text-zinc-100">Revisar Cards Gerados</h3>
                      <p className="text-xs text-zinc-500">
                        {cardCount} card{cardCount !== 1 ? 's' : ''} · Edite diretamente antes de salvar
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setModalState('closed')}
                    className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Cards */}
                <div className="max-h-[55vh] space-y-3 overflow-y-auto px-6 py-4">
                  {editedCards.map((card, idx) => (
                    <div key={card.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
                      {/* Card number badge */}
                      <div className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                          Card {idx + 1}
                        </span>
                      </div>

                      {/* Front */}
                      <div className="border-b border-zinc-800/40 px-4 py-3">
                        <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-violet-400">
                          Frente (Pergunta)
                        </p>
                        <AutoResizeTextarea
                          value={card.front}
                          onChange={e => updateCard(card.id, 'front', e.target.value)}
                          placeholder="Frente do card..."
                          className="w-full bg-transparent text-sm leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600"
                        />
                      </div>

                      {/* Back */}
                      <div className="px-4 py-3">
                        <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-emerald-500">
                          Verso (Resposta)
                        </p>
                        <AutoResizeTextarea
                          value={card.back}
                          onChange={e => updateCard(card.id, 'back', e.target.value)}
                          placeholder="Verso do card..."
                          className="w-full bg-transparent text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Modal footer */}
                <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
                  <button
                    onClick={() => setModalState('closed')}
                    disabled={saving}
                    className="rounded-xl border border-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-400 transition-all hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-50"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || editedCards.length === 0}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Salvando…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Aprovar e Salvar
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AiGenerationPanel;
