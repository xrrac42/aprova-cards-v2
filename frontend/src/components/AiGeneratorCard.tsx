import React, { useState } from 'react';
import {
  Sparkles,
  FileText,
  Loader2,
  HelpCircle,
  TextCursorInput,
  Briefcase,
  Save,
  Zap,
} from 'lucide-react';

type Archetype = 'qa' | 'cloze' | 'case';
type Density = 'resumo' | 'padrao' | 'aprofundado';

interface FocusConfig {
  letraDaLei: boolean;
  doutrina: boolean;
  jurisprudencia: boolean;
}

export interface GenerationConfig {
  preset: string;
  archetype: Archetype;
  density: Density;
  focus: FocusConfig;
  regraDeOuro: string;
  limit: number;
}

interface AiGeneratorCardProps {
  selectedDiscipline: string;
  disciplines: { id: string; name: string }[];
  aiDocText: string;
  setAiDocText: (text: string) => void;
  generatingAI: boolean;
  extractingPdf: boolean;
  aiFileRef: React.RefObject<HTMLInputElement>;
  handleAiFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerate: (config: GenerationConfig) => void;
  onSample?: (config: GenerationConfig) => void;
  aiMsg: string;
}

const PRESETS = [
  { value: 'default', label: 'Padrão do Sistema' },
  { value: 'cespe-lei', label: 'CESPE - Lei Seca' },
  { value: 'oab-juris', label: 'OAB - Jurisprudência' },
  { value: 'magistratura', label: 'Magistratura Denso' },
];

const ARCHETYPES = [
  {
    value: 'qa' as Archetype,
    Icon: HelpCircle,
    title: 'Q&A Direto',
    desc: 'Pergunta direta e resposta objetiva no verso.',
  },
  {
    value: 'cloze' as Archetype,
    Icon: TextCursorInput,
    title: 'Lacuna / Cloze',
    desc: 'O prazo para agravo é de [ 15 ] dias.',
  },
  {
    value: 'case' as Archetype,
    Icon: Briefcase,
    title: 'Caso Prático',
    desc: 'Pequena historinha hipotética + resolução.',
  },
];

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: 'resumo', label: 'Resumo' },
  { value: 'padrao', label: 'Padrão' },
  { value: 'aprofundado', label: 'Aprofundado' },
];

const FOCUS_OPTIONS: { key: keyof FocusConfig; label: string }[] = [
  { key: 'letraDaLei', label: 'Letra da Lei' },
  { key: 'doutrina', label: 'Doutrina Dominante' },
  { key: 'jurisprudencia', label: 'Jurisprudência / Súmulas' },
];

function wordCount(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

const AiGeneratorCard: React.FC<AiGeneratorCardProps> = ({
  selectedDiscipline,
  disciplines,
  aiDocText,
  setAiDocText,
  generatingAI,
  extractingPdf,
  aiFileRef,
  handleAiFileUpload,
  onGenerate,
  onSample,
  aiMsg,
}) => {
  const [config, setConfig] = useState<GenerationConfig>({
    preset: 'default',
    archetype: 'qa',
    density: 'padrao',
    focus: { letraDaLei: true, doutrina: true, jurisprudencia: false },
    regraDeOuro: '',
    limit: 30,
  });

  const isLocked = !selectedDiscipline;
  const isReady = !isLocked && !generatingAI && aiDocText.trim().length >= 10;
  const words = wordCount(aiDocText);
  const tokens = Math.ceil(words * 1.35);
  const disciplineName = disciplines.find(d => d.id === selectedDiscipline)?.name;

  function set<K extends keyof GenerationConfig>(key: K, value: GenerationConfig[K]) {
    setConfig(prev => ({ ...prev, [key]: value }));
  }

  function toggleFocus(key: keyof FocusConfig) {
    setConfig(prev => ({ ...prev, focus: { ...prev.focus, [key]: !prev.focus[key] } }));
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-violet-500" />
        <h2 className="font-semibold text-foreground">Gerar cards com IA</h2>
      </div>

      {/* State banner */}
      {selectedDiscipline ? (
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-sm text-violet-300">
          Disciplina selecionada: <strong>{disciplineName}</strong>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
          ⚠️ Selecione mentor → produto → disciplina nos campos acima para habilitar a geração.
        </div>
      )}

      {/* ─── Zona 1: Fonte de Conhecimento ─── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            ref={aiFileRef}
            type="file"
            accept=".pdf,.txt"
            onChange={handleAiFileUpload}
            disabled={extractingPdf}
            className="hidden"
            id="ai-file-input"
          />
          <label
            htmlFor="ai-file-input"
            className={`flex cursor-pointer items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/5 ${extractingPdf ? 'pointer-events-none opacity-50' : ''}`}
          >
            {extractingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {extractingPdf ? 'Extraindo texto…' : 'Enviar PDF ou TXT'}
          </label>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Texto do documento</label>
          <div className="relative">
            <textarea
              value={aiDocText}
              onChange={e => setAiDocText(e.target.value)}
              rows={7}
              placeholder="Cole aqui o conteúdo do documento (ou use o botão acima para carregar um PDF/TXT)..."
              className="w-full resize-y rounded-xl border border-border bg-[#18181b] px-4 py-3 pb-7 text-sm text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:outline-none transition-colors"
            />
            <span className="pointer-events-none absolute bottom-2.5 right-3 text-[11px] text-muted-foreground/50">
              ~{words.toLocaleString()} palavras | Est. {tokens.toLocaleString()} tokens
            </span>
          </div>
        </div>
      </div>

      {/* ─── Zona 2: Mesa de Diretrizes ─── */}
      <div className="rounded-xl border border-violet-500/15 bg-white/[0.02] p-4 space-y-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-400/60">
          Personalizar Didática da IA
        </p>

        {/* V2 — Presets */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Meus Presets Salvos</label>
            <select
              value={config.preset}
              onChange={e => set('preset', e.target.value)}
              className="w-full rounded-lg border border-border bg-[#18181b] px-3 py-2 text-sm text-foreground focus:border-violet-500 focus:outline-none transition-colors"
            >
              {PRESETS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-violet-500/40 hover:text-foreground">
            <Save className="h-3.5 w-3.5" />
            + Salvar ajustes
          </button>
        </div>

        {/* V1 — Arquétipo de Card */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Arquétipo de Card</label>
          <div className="grid grid-cols-3 gap-2">
            {ARCHETYPES.map(({ value, Icon, title, desc }) => {
              const active = config.archetype === value;
              return (
                <button
                  key={value}
                  onClick={() => set('archetype', value)}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    active
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-border hover:border-violet-500/30 hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon className={`mb-1.5 h-4 w-4 ${active ? 'text-violet-400' : 'text-muted-foreground'}`} />
                  <p className={`text-xs font-semibold leading-tight ${active ? 'text-violet-200' : 'text-foreground'}`}>
                    {title}
                  </p>
                  <p className={`mt-1 text-[10px] leading-snug ${active ? 'text-violet-400/70' : 'text-muted-foreground/60'}`}>
                    {desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* V3 — Refinamento */}
        <div className="grid grid-cols-2 gap-4">
          {/* Densidade */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Densidade</label>
            <div className="flex overflow-hidden rounded-lg border border-border">
              {DENSITY_OPTIONS.map(({ value, label }) => {
                const active = config.density === value;
                return (
                  <button
                    key={value}
                    onClick={() => set('density', value)}
                    className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
                      active ? 'bg-violet-600 text-white' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Foco da Prova */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Foco da Prova</label>
            <div className="space-y-2">
              {FOCUS_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => toggleFocus(key)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      config.focus[key] ? 'border-violet-500 bg-violet-500' : 'border-border'
                    }`}
                  >
                    {config.focus[key] && (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-xs ${config.focus[key] ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* V1 — Regra de Ouro */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Regra de Ouro{' '}
              <span className="text-muted-foreground/40">(Opcional)</span>
            </label>
            <span className={`text-[10px] tabular-nums ${config.regraDeOuro.length > 130 ? 'text-amber-400' : 'text-muted-foreground/40'}`}>
              {config.regraDeOuro.length}/150
            </span>
          </div>
          <input
            type="text"
            maxLength={150}
            value={config.regraDeOuro}
            onChange={e => set('regraDeOuro', e.target.value)}
            placeholder="Ex: Ignore o sumário, prefira datas e prazos, não faça perguntas sobre histórico..."
            className="w-full rounded-lg border border-border bg-[#18181b] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-violet-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* ─── Zona 3: Configuração de Entrega ─── */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Limite de cards</label>
        <input
          type="number"
          min={1}
          max={100}
          value={config.limit}
          onChange={e => set('limit', Math.max(1, Math.min(100, Number(e.target.value))))}
          className="w-24 rounded-xl border border-border bg-[#18181b] px-3 py-2.5 text-sm text-foreground focus:border-violet-500 focus:outline-none transition-colors"
        />
      </div>

      {/* Feedback message */}
      {aiMsg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${aiMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-destructive/10 text-destructive'}`}>
          {aiMsg}
        </p>
      )}

      {/* ─── Zona 4: CTA Footer ─── */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => onSample?.(config)}
          disabled={!isReady}
          title="Gera rapidinho para você validar o tom da IA antes de gastar saldo"
          className="flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:border-violet-500/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkles className="h-4 w-4" />
          Testar Amostra (3 cards grátis)
        </button>

        <button
          onClick={() => onGenerate(config)}
          disabled={!isReady}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:from-violet-500 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {generatingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {generatingAI ? 'Gerando…' : 'Gerar Edital Completo'}
        </button>
      </div>
    </div>
  );
};

export default AiGeneratorCard;
