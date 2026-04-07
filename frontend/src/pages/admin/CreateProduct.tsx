import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { ArrowLeft, Loader2, AlertTriangle, X, ImageIcon, Zap } from 'lucide-react';
import { toast } from 'sonner';

const CreateProduct: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const session = getSession();
  const isEditing = !!id;

  const [name, setName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [kiwifyProductId, setKiwifyProductId] = useState('');
  const [mentorId, setMentorId] = useState('');
  const [active, setActive] = useState(true);
  const [mentors, setMentors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session || session.role !== 'admin') { navigate('/login'); return; }
    loadMentors();
    if (isEditing) loadProduct();
  }, []);

  const loadMentors = async () => {
    const { data } = await supabase.from('mentors').select('id, name');
    if (data) setMentors(data);
  };

  const loadProduct = async () => {
    const { data } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
    if (data) {
      setName(data.name);
      setAccessCode(data.access_code);
      setKiwifyProductId((data as any).kiwify_product_id || '');
      setMentorId(data.mentor_id);
      setActive(data.active);
      setCoverImageUrl((data as any).cover_image_url || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!kiwifyProductId.trim()) {
      setError('O ID do Produto na Kiwify é obrigatório para ativar o produto.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name,
        access_code: accessCode,
        kiwify_product_id: kiwifyProductId.trim(),
        mentor_id: mentorId,
        active,
        cover_image_url: coverImageUrl || null,
      };

      if (isEditing) {
        const { error: err } = await supabase.from('products').update(payload).eq('id', id);
        if (err) {
          console.error('Erro ao atualizar produto:', err.code, err.message, err.details);
          throw err;
        }
        toast.success('Produto salvo com sucesso!');
      } else {
        const { data, error: err } = await supabase.from('products').insert(payload).select('id').single();
        if (err) {
          console.error('Erro ao criar produto:', err.code, err.message, err.details);
          throw err;
        }
        toast.success('Produto criado com sucesso!');
        navigate(`/admin/produtos/editar/${data.id}`, { replace: true });
      }
    } catch (err: any) {
      const msg = err?.message || 'Erro desconhecido';
      setError(`Erro ao salvar: ${msg}`);
      toast.error(`Erro: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-lg">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <h1 className="mb-6 font-display text-2xl font-bold text-foreground">
          {isEditing ? 'Editar Produto' : 'Novo Produto'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cover Image Upload */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Imagem de Capa do Produto</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploadingImage(true);
                try {
                  const ext = file.name.split('.').pop();
                  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                  const { error: uploadErr } = await supabase.storage.from('product-covers').upload(fileName, file, { upsert: true });
                  if (uploadErr) throw uploadErr;
                  const { data: urlData } = supabase.storage.from('product-covers').getPublicUrl(fileName);
                  setCoverImageUrl(urlData.publicUrl);
                } catch (err: any) {
                  setError('Erro ao fazer upload da imagem.');
                } finally {
                  setUploadingImage(false);
                }
              }}
            />
            {coverImageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-border">
                <img src={coverImageUrl} alt="Capa" className="w-full h-48 object-cover" />
                <button
                  type="button"
                  onClick={() => setCoverImageUrl('')}
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface py-8 text-muted-foreground hover:border-primary hover:text-foreground transition-colors disabled:opacity-50"
              >
                {uploadingImage ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <ImageIcon className="h-6 w-6" />
                )}
                <span className="text-sm">{uploadingImage ? 'Enviando...' : 'Clique para enviar imagem'}</span>
              </button>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Dimensão recomendada: 800×400px (banner horizontal)</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Nome do produto</label>
            <input
              required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              placeholder="Ex: PMGO Flashcards 2025"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Código de acesso</label>
            <input
              required value={accessCode} onChange={(e) => setAccessCode(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-mono"
              placeholder="Ex: PMGO2025"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              ID do Produto na Kiwify
              <span className="ml-1 text-destructive">*</span>
            </label>
            <input
              value={kiwifyProductId}
              onChange={(e) => setKiwifyProductId(e.target.value)}
              className={`w-full rounded-xl border px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-colors font-mono bg-surface ${
                !kiwifyProductId.trim()
                  ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-400'
                  : 'border-border focus:border-primary focus:ring-primary'
              }`}
              placeholder="Ex: prod_abc123xyz"
            />
            {!kiwifyProductId.trim() && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Obrigatório para o webhook funcionar.</span>
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Encontre na URL ao editar o produto na Kiwify: dashboard.kiwify.com/products/edit/<strong>[ESSE-É-O-ID]</strong>
            </p>

            {/* Webhook test button */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  setTestingWebhook(true);
                  setWebhookResult(null);
                  try {
                    const res = await supabase.functions.invoke('kiwify-webhook', {
                      body: {
                        webhook_event_type: 'order_approved',
                        Customer: { email: 'teste@webhook.com', name: 'Teste Admin' },
                        Product: { product_id: kiwifyProductId.trim() },
                        order_id: `teste_${Date.now()}`,
                        _teste: true,
                      },
                    });
                    if (res.error) throw res.error;
                    const data = res.data;
                    if (data?.sucesso) {
                      setWebhookResult({ success: true, message: `✅ Webhook OK! Produto "${data.produto}" encontrado.` });
                    } else {
                      setWebhookResult({ success: false, message: `❌ ${data?.erro || 'Erro desconhecido'}` });
                    }
                  } catch (err: any) {
                    setWebhookResult({ success: false, message: `❌ ${err?.message || 'Erro desconhecido'}` });
                  } finally {
                    setTestingWebhook(false);
                  }
                }}
                disabled={!kiwifyProductId.trim() || testingWebhook}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testingWebhook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                {testingWebhook ? 'Testando...' : 'Testar Webhook'}
              </button>
              {!kiwifyProductId.trim() && (
                <span className="text-xs text-muted-foreground">Preencha o ID para testar</span>
              )}
            </div>

            {webhookResult && (
              <div className={`mt-2 rounded-xl px-3 py-2 text-xs ${webhookResult.success ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive'}`}>
                {webhookResult.message}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Mentor</label>
            <select
              required value={mentorId} onChange={(e) => setMentorId(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            >
              <option value="">Selecione o mentor</option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            {mentors.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Cadastre um mentor na personalização visual primeiro</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={`relative h-6 w-11 rounded-full transition-colors ${active ? 'bg-secondary' : 'bg-muted'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-transform ${active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-foreground">{active ? 'Ativo' : 'Inativo'}</span>
          </div>

          {error && (
            <p className="text-sm text-destructive animate-fade-up">{error}</p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full rounded-xl bg-primary py-3.5 font-display font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? 'Salvar' : 'Criar Produto'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateProduct;
