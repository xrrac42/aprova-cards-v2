import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { sanitizeCardFields } from '@/lib/html-entities';
import { AdminLayout } from './AdminDashboard';
import { parseFileWithFormat, validateCards, type ParsedCard } from '@/lib/csv-parser';
import CardContent from '@/components/CardContent';
import { Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import AiGenerationPanel from '@/components/AiGenerationPanel';

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

       

          <AiGenerationPanel />

        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminUpload;
