import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { ArrowLeft, Loader2, X, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

const CreateProduct: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const session = getSession();
  const isEditing = !!id;

  const [name, setName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [mentorId, setMentorId] = useState('');
  const [active, setActive] = useState(true);
  const [mentors, setMentors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session || session.role !== 'admin') { navigate('/login'); return; }
    loadMentors();
    if (isEditing) loadProduct();
  }, []);

  useEffect(() => {
    const created = (location.state as { created?: boolean } | null)?.created;
    if (created) {
      toast.success('Produto criado com sucesso! Primeira disciplina "Geral" criada automaticamente.');
      navigate(location.pathname, { replace: true });
    }
  }, [location.pathname, location.state, navigate]);

  const loadMentors = async () => {
    const { data } = await supabase.from('mentors').select('id, name');
    if (data) setMentors(data);
  };

  const loadProduct = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setError('Sessao expirada. Faca login novamente.');
      return;
    }

    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
    const response = await fetch(`${apiBase}/admin/products/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success || !result?.data) {
      setError(result?.error || 'Nao foi possivel carregar o produto.');
      return;
    }

    const data = result.data;
    setName(data.name);
    setAccessCode(data.access_code);
    setMentorId(data.mentor_id);
    setActive(data.active);
    setCoverImageUrl(data.cover_image_url || '');
    setPaymentLink(data.payment_link || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Sessao expirada. Faca login novamente.');
      }

      const payload = {
        name,
        access_code: accessCode,
        mentor_id: mentorId,
        active,
        cover_image_url: coverImageUrl || null,
        payment_link: paymentLink || null,
      };

      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

      if (isEditing) {
        const response = await fetch(`${apiBase}/admin/products/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) {
          throw new Error(result?.error || 'Erro ao atualizar produto');
        }
        toast.success('Produto salvo com sucesso!');
      } else {
        const response = await fetch(`${apiBase}/admin/products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success || !result?.data?.id) {
          throw new Error(result?.error || 'Erro ao criar produto');
        }
        navigate(`/admin/produtos/editar/${result.data.id}`, { replace: true, state: { created: true } });
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
                  setError('Erro ao fazer upload da imagem: ' + (err?.message || ''));
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
                {uploadingImage ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImageIcon className="h-6 w-6" />}
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
            <label className="mb-1.5 block text-sm font-medium text-foreground">Link de pagamento (Kiwify)</label>
            <input
              type="url"
              value={paymentLink}
              onChange={(e) => setPaymentLink(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              placeholder="https://pay.kiwify.com.br/..."
            />
            <p className="mt-1 text-xs text-muted-foreground">URL da página de checkout na Kiwify para este produto</p>
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
              <p className="mt-1 text-xs text-muted-foreground">Cadastre um mentor primeiro</p>
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
