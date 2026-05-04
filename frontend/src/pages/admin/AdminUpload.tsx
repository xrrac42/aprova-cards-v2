import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { sanitizeCardFields } from '@/lib/html-entities';
import { AdminLayout } from './AdminDashboard';
import { parseFileWithFormat, validateCards, type ParsedCard } from '@/lib/csv-parser';
import CardContent from '@/components/CardContent';
import { Upload, Check, X, Loader2, AlertTriangle, Sparkles, FileText } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const BATCH_SIZE = 500;

const CORRUPT_START_CHARS = /^[\\\/\[\]\{\}@\^~`]{2,}/;

function isCorruptedCard(card: ParsedCard): boolean {
  return CORRUPT_START_CHARS.test(card.front.trim()) || CORRUPT_START_CHARS.test(card.back.trim());
}

const AdminUpload: React.FC = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [mentors, setMentors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [disciplines, setDisciplines] = useState<any[]>([]);
  const [selectedMentor, setSelectedMentor] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState('');
  const [parsedCards, setParsedCards] = useState<ParsedCard[]>([]);
  const [invalidCards, setInvalidCards] = useState<ParsedCard[]>([]);
  const [duplicateCards, setDuplicateCards] = useState<ParsedCard[]>([]);
  const [corruptedCards, setCorruptedCards] = useState<ParsedCard[]>([]);
  const [totalParsed, setTotalParsed] = useState(0);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadLog, setUploadLog] = useState('');
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [showInvalid, setShowInvalid] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showCorrupted, setShowCorrupted] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // AI generation state
  const [aiDocText, setAiDocText] = useState('');
  const [aiLimit, setAiLimit] = useState(20);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiMsg, setAiMsg] = useState('');
  const [extractingPdf, setExtractingPdf] = useState(false);
  const aiFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session || session.role !== 'admin') { navigate('/login'); return; }
    supabase.from('mentors').select('id, name').order('name').then(({ data }) => setMentors(data || []));
  }, []);

  useEffect(() => {
    if (!selectedMentor) { setProducts([]); setSelectedProduct(''); return; }
    supabase.from('products').select('id, name').eq('mentor_id', selectedMentor).eq('active', true).order('name')
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

  const handleAiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtractingPdf(true);
    setAiMsg('');
    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item: any) => item.str).join(' ') + '\n';
        }
        setAiDocText(text.trim());
        setAiMsg(`✅ PDF extraído: ${pdf.numPages} página(s), ${text.trim().length} caracteres.`);
      } else {
        const text = await file.text();
        setAiDocText(text.trim());
        setAiMsg(`✅ Arquivo carregado: ${text.trim().length} caracteres.`);
      }
    } catch (err: any) {
      setAiMsg(`❌ Erro ao ler arquivo: ${err.message}`);
    } finally {
      setExtractingPdf(false);
      if (aiFileRef.current) aiFileRef.current.value = '';
    }
  };

  const generateCardsWithAI = async () => {
    if (!selectedDiscipline) { setAiMsg('❌ Selecione uma disciplina primeiro.'); return; }
    if (aiDocText.trim().length < 10) { setAiMsg('❌ Cole o texto do documento (mínimo 10 caracteres).'); return; }
    setGeneratingAI(true);
    setAiMsg('');
    const backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
    try {
      const resp = await fetch(`${backendURL}/api/v1/admin/disciplines/${selectedDiscipline}/generate-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: aiDocText.trim(), limit: aiLimit }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setAiMsg(`❌ ${data.error || 'Erro ao gerar cards com IA'}`);
        return;
      }
      setAiMsg(`✅ ${data.data.generated} cards gerados com IA e salvos na disciplina!`);
      setAiDocText('');
    } catch (err: any) {
      setAiMsg(`❌ Erro: ${err.message}`);
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    setProcessingMsg('Lendo arquivo...');
    setUploadMsg('');
    setUploadLog('');
    setParsedCards([]);
    setInvalidCards([]);
    setDuplicateCards([]);
    setCorruptedCards([]);
    setTotalParsed(0);
    setShowInvalid(false);
    setShowDuplicates(false);
    setShowCorrupted(false);

    try {
      await new Promise(resolve => setTimeout(resolve, 50));
      setProcessingMsg('Identificando formato...');
      await new Promise(resolve => setTimeout(resolve, 50));

      const { cards: parsed, format } = await parseFileWithFormat(file);
      const { valid, invalidCount, invalidCards: inv } = validateCards(parsed);
      setTotalParsed(parsed.length);
      setInvalidCards(inv);

      // Filter corrupted cards
      const corrupted = valid.filter(isCorruptedCard);
      const clean = valid.filter(c => !isCorruptedCard(c));
      setCorruptedCards(corrupted);

      if (clean.length === 0) {
        setUploadMsg(`⚠️ Nenhum card válido encontrado. ${invalidCount > 0 ? `${invalidCount} card(s) ignorado(s) por estarem incompletos.` : ''}${corrupted.length > 0 ? ` ${corrupted.length} corrompido(s).` : ''} Verifique o formato do arquivo.`);
      } else if (selectedDiscipline) {
        // Check for duplicates against existing cards in the discipline
        setProcessingMsg('Verificando duplicados...');
        await new Promise(resolve => setTimeout(resolve, 50));

        const { data: existing } = await supabase
          .from('cards')
          .select('front')
          .eq('discipline_id', selectedDiscipline);

        const existingFronts = new Set(
          existing?.map(c => c.front.toLowerCase().trim()) || []
        );

        const novos: ParsedCard[] = [];
        const dupes: ParsedCard[] = [];
        const seenFronts = new Set<string>();

        clean.forEach(card => {
          const key = card.front.toLowerCase().trim();
          if (existingFronts.has(key) || seenFronts.has(key)) {
            dupes.push(card);
          } else {
            novos.push(card);
            seenFronts.add(key);
          }
        });

        setDuplicateCards(dupes);
        setParsedCards(novos);

        const parts: string[] = [`Formato: ${format}`];
        parts.push(`✅ ${novos.length} cards novos para importar`);
        if (corrupted.length > 0) parts.push(`🚫 ${corrupted.length} corrompido(s) ignorado(s)`);
        if (dupes.length > 0) parts.push(`⚠️ ${dupes.length} duplicado(s) ignorado(s)`);
        if (invalidCount > 0) parts.push(`${invalidCount} incompleto(s) ignorado(s)`);
        setUploadMsg(parts.join(' · '));
      } else {
        // Filter corrupted from clean when no discipline selected
        setParsedCards(clean);
        const parts = [`Formato detectado: ${format} — ${clean.length} card(s) válido(s)`];
        if (corrupted.length > 0) parts.push(`🚫 ${corrupted.length} corrompido(s) ignorado(s)`);
        if (invalidCount > 0) parts.push(`${invalidCount} ignorado(s) (incompletos)`);
        setUploadMsg(parts.join(' · '));
      }
    } catch (err: any) {
      setUploadMsg(`❌ Erro ao processar: ${err.message}`);
      setParsedCards([]);
    } finally {
      setProcessing(false);
      setProcessingMsg('');
    }
  };

  const confirmUpload = async () => {
    if (!parsedCards.length || !selectedDiscipline || !selectedProduct) return;
    setUploading(true);
    setImportProgress(0);

    const cardsToInsert = parsedCards.map((c, i) => {
      const sanitized = sanitizeCardFields(c);

      return {
        discipline_id: selectedDiscipline,
        product_id: selectedProduct,
        front: sanitized.front,
        back: sanitized.back,
        order: i,
      };
    });

    const total = cardsToInsert.length;
    let imported = 0;

    try {
      // Split into batches
      const batches: typeof cardsToInsert[] = [];
      for (let i = 0; i < total; i += BATCH_SIZE) {
        batches.push(cardsToInsert.slice(i, i + BATCH_SIZE));
      }

      // Process 2 batches in parallel
      for (let i = 0; i < batches.length; i += 2) {
        const pair = batches.slice(i, i + 2);
        await Promise.all(pair.map(async (batch) => {
          const { error } = await supabase.from('cards').insert(batch);
          if (error) throw error;
          imported += batch.length;
          setImportProgress(Math.round((imported / total) * 100));
        }));
      }

      const discName = disciplines.find(d => d.id === selectedDiscipline)?.name || 'Desconhecida';
      const now = new Date().toLocaleString('pt-BR');

      setUploadLog(
        `✅ Upload concluído — ${now}\n` +
        `Disciplina: ${discName}\n` +
        `Total no arquivo: ${totalParsed} cards\n` +
        `Válidos importados: ${total} cards\n` +
        (corruptedCards.length > 0 ? `Corrompidos ignorados: ${corruptedCards.length} cards\n` : '') +
        `Ignorados (incompletos): ${invalidCards.length} cards`
      );

      setParsedCards([]);
      setInvalidCards([]);
      setCorruptedCards([]);
      setUploadMsg('');
    } catch (err: any) {
      setUploadMsg(`❌ Erro na importação: ${err.message || 'Tente novamente.'}`);
    } finally {
      setUploading(false);
      setImportProgress(0);
    }
  };

  const previewCards = parsedCards.slice(0, 5);

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold text-foreground">Upload de Cards</h1>
            <p className="text-sm text-muted-foreground">Importe cards via CSV, TXT, JSON ou APKG</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            {/* Mentor */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Mentor</label>
              <select value={selectedMentor} onChange={e => setSelectedMentor(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-primary focus:outline-none transition-colors">
                <option value="">Selecione o mentor</option>
                {mentors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            {/* Product */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Produto</label>
              <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} disabled={!selectedMentor}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-primary focus:outline-none transition-colors disabled:opacity-50">
                <option value="">Selecione o produto</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Discipline */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Disciplina</label>
              <select value={selectedDiscipline} onChange={e => setSelectedDiscipline(e.target.value)} disabled={!selectedProduct}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-primary focus:outline-none transition-colors disabled:opacity-50">
                <option value="">Selecione a disciplina</option>
                {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {/* File */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Arquivo</label>
              <input type="file" accept=".csv,.json,.txt,.apkg" onChange={handleFileUpload} disabled={processing}
                className="w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground file:cursor-pointer disabled:opacity-50" />
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                <p>• <strong>CSV/TXT:</strong> frente;verso ou frente / verso (separados por linha em branco)</p>
                <p>• <strong>GPT:</strong> frente ||| verso ||| tags (tags são ignoradas)</p>
                <p>• <strong>JSON:</strong> {`[{"frente":"...","verso":"..."}]`}</p>
                <p>• <strong>APKG:</strong> exportação direta do Anki</p>
              </div>
            </div>

            {processing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {processingMsg || 'Processando...'}
              </div>
            )}

            {uploadMsg && (
              <p className={`rounded-lg px-3 py-2 text-sm ${
                uploadMsg.startsWith('✅') ? 'bg-secondary/10 text-secondary' :
                uploadMsg.startsWith('❌') ? 'bg-destructive/10 text-destructive' :
                uploadMsg.startsWith('⚠️') ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' :
                'text-muted-foreground'
              }`}>{uploadMsg}</p>
            )}

            {/* Import progress bar */}
            {uploading && (
              <div className="space-y-2">
                <Progress value={importProgress} className="h-3" />
                <p className="text-center text-sm text-muted-foreground">
                  {importProgress}% — {Math.round(parsedCards.length * importProgress / 100)} de {parsedCards.length} cards
                </p>
              </div>
            )}

            {previewCards.length > 0 && !uploading && (
              <>
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">
                    Pré-visualização (primeiros {previewCards.length} de {parsedCards.length} cards válidos):
                  </p>
                  <div className="space-y-2 rounded-xl border border-border bg-surface-secondary p-3">
                    {previewCards.map((c, i) => (
                      <div key={i} className="rounded-lg bg-surface p-3 text-sm">
                        <p className="font-medium text-foreground">
                          <span className="mr-2 text-xs text-muted-foreground">Frente:</span><CardContent text={c.front} />
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          <span className="mr-2 text-xs">Verso:</span><CardContent text={c.back} />
                        </p>
                      </div>
                    ))}
                    {parsedCards.length > 5 && (
                      <p className="text-center text-xs text-muted-foreground">+ {parsedCards.length - 5} cards não exibidos no preview</p>
                    )}
                  </div>
                </div>

                {corruptedCards.length > 0 && (
                  <div>
                    <button onClick={() => setShowCorrupted(!showCorrupted)}
                      className="flex items-center gap-2 text-sm text-destructive hover:underline">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      🚫 {corruptedCards.length} card(s) corrompido(s) — serão ignorados na importação — {showCorrupted ? 'ocultar' : 'ver detalhes'}
                    </button>
                    {showCorrupted && (
                      <div className="mt-2 space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                        {corruptedCards.slice(0, 10).map((c, i) => (
                          <div key={i} className="rounded-lg border border-destructive/30 bg-surface p-3 text-sm">
                            <span className="mb-1 inline-block rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Corrompido</span>
                            <p className="text-foreground"><span className="mr-2 text-xs text-muted-foreground">Frente:</span>{c.front}</p>
                            <p className="mt-1 text-muted-foreground"><span className="mr-2 text-xs">Verso:</span>{c.back}</p>
                          </div>
                        ))}
                        {corruptedCards.length > 10 && <p className="text-center text-xs text-muted-foreground">... e mais {corruptedCards.length - 10}</p>}
                      </div>
                    )}
                  </div>
                )}

                {duplicateCards.length > 0 && (
                  <div>
                    <button onClick={() => setShowDuplicates(!showDuplicates)}
                      className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 hover:underline">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {duplicateCards.length} card(s) duplicado(s) ignorado(s) — {showDuplicates ? 'ocultar' : 'ver detalhes'}
                    </button>
                    {showDuplicates && (
                      <div className="mt-2 space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                        {duplicateCards.slice(0, 10).map((c, i) => (
                          <div key={i} className="rounded-lg bg-surface p-3 text-sm">
                            <p className="text-foreground"><span className="mr-2 text-xs text-muted-foreground">Frente:</span>{c.front}</p>
                          </div>
                        ))}
                        {duplicateCards.length > 10 && <p className="text-center text-xs text-muted-foreground">... e mais {duplicateCards.length - 10}</p>}
                      </div>
                    )}
                  </div>
                )}

                {invalidCards.length > 0 && (
                  <div>
                    <button onClick={() => setShowInvalid(!showInvalid)}
                      className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400 hover:underline">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {invalidCards.length} card(s) incompleto(s) ignorado(s) — {showInvalid ? 'ocultar' : 'ver detalhes'}
                    </button>
                    {showInvalid && (
                      <div className="mt-2 space-y-2 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3">
                        {invalidCards.slice(0, 10).map((c, i) => (
                          <div key={i} className="rounded-lg bg-surface p-3 text-sm">
                            <p className="text-foreground"><span className="mr-2 text-xs text-muted-foreground">Frente:</span>{c.front || <span className="italic text-muted-foreground">(vazio)</span>}</p>
                            <p className="mt-1 text-muted-foreground"><span className="mr-2 text-xs">Verso:</span>{c.back || <span className="italic text-muted-foreground">(vazio)</span>}</p>
                          </div>
                        ))}
                        {invalidCards.length > 10 && <p className="text-center text-xs text-muted-foreground">... e mais {invalidCards.length - 10}</p>}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={confirmUpload} disabled={uploading || !selectedDiscipline}
                    className="flex items-center gap-2 rounded-xl bg-secondary px-6 py-2.5 font-medium text-secondary-foreground hover:opacity-90 disabled:opacity-50 transition-all">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Confirmar importação ({parsedCards.length} cards)
                  </button>
                  <button onClick={() => { setParsedCards([]); setInvalidCards([]); setCorruptedCards([]); setUploadMsg(''); setUploadLog(''); }}
                    className="flex items-center gap-2 rounded-xl border border-border px-6 py-2.5 font-medium text-foreground hover:bg-surface-hover transition-colors">
                    <X className="h-4 w-4" /> Cancelar
                  </button>
                </div>
              </>
            )}

            {uploadLog && (
              <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4">
                <pre className="whitespace-pre-wrap text-sm text-foreground">{uploadLog}</pre>
              </div>
            )}
          </div>

          {/* AI Generation */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-600" />
              <h2 className="font-display font-semibold text-foreground">Gerar cards com IA</h2>
            </div>
            {selectedDiscipline ? (
              <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 px-3 py-2 text-sm text-violet-700 dark:text-violet-300">
                Disciplina selecionada: <strong>{disciplines.find(d => d.id === selectedDiscipline)?.name}</strong>
              </div>
            ) : (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                ⚠️ Selecione mentor → produto → disciplina nos campos acima para habilitar a geração.
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Envie um PDF ou TXT, ou cole o texto diretamente.
            </p>

            {/* File picker */}
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
                className={`flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground cursor-pointer hover:bg-surface-hover transition-colors ${extractingPdf ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {extractingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {extractingPdf ? 'Extraindo texto…' : 'Enviar PDF ou TXT'}
              </label>
              {aiDocText && (
                <span className="text-xs text-muted-foreground">{aiDocText.length.toLocaleString()} caracteres carregados</span>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Texto do documento</label>
              <textarea
                value={aiDocText}
                onChange={e => setAiDocText(e.target.value)}
                rows={8}
                placeholder="Cole aqui o conteúdo do documento (ou use o botão acima para carregar um PDF/TXT)..."
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:outline-none resize-y transition-colors"
              />
            </div>

            <div className="flex items-center gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Limite de cards</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={aiLimit}
                  onChange={e => setAiLimit(Number(e.target.value))}
                  className="w-24 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:border-violet-500 focus:outline-none transition-colors"
                />
              </div>
              <div className="pt-6">
                <button
                  onClick={generateCardsWithAI}
                  disabled={generatingAI || !selectedDiscipline || aiDocText.trim().length < 10}
                  className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 font-medium text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generatingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {generatingAI ? 'Gerando…' : 'Gerar com IA'}
                </button>
              </div>
            </div>

            {aiMsg && (
              <p className={`rounded-lg px-3 py-2 text-sm ${
                aiMsg.startsWith('✅') ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive'
              }`}>{aiMsg}</p>
            )}
          </div>

        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminUpload;
