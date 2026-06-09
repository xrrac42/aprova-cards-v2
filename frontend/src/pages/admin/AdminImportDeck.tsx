import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { AdminLayout } from './AdminDashboard';
import { FileDown, Loader2, CheckCircle2, AlertCircle, Upload } from 'lucide-react';

type ImportResult = {
  product_id: string;
  product_name: string;
  disciplines_upserted: number;
  cards_inserted: number;
};

const AdminImportDeck: React.FC = () => {
  const navigate = useNavigate();
  const session = getSession();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mentors, setMentors] = useState<{ id: string; name: string }[]>([]);
  const [mentorId, setMentorId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session || session.role !== 'admin') { navigate('/login'); return; }
    supabase.from('mentors').select('id, name').order('name').then(({ data }) => setMentors(data || []));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentorId || !file) return;

    setLoading(true);
    setResult(null);
    setError('');

    try {
      const { data: { session: supaSession } } = await supabase.auth.getSession();
      const token = supaSession?.access_token;

      const baseUrl = import.meta.env.VITE_ANKI_IMPORTER_URL || 'http://localhost:9090';

      const form = new FormData();
      form.append('mentor_id', mentorId);
      form.append('file', file);

      const res = await fetch(`${baseUrl}/api/v1/import`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const data: ImportResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message ?? 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError('');
    setMentorId('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <FileDown className="h-6 w-6 text-primary" />
              <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">Importar Deck</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Importe um baralho Anki (.apkg) e associe a um mentor. As disciplinas e cards serão criados automaticamente.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            {result ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-secondary">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span className="font-semibold">Importação concluída com sucesso!</span>
                </div>
                <div className="rounded-xl bg-secondary/10 p-4 space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Produto:</span> <span className="font-medium text-foreground">{result.product_name}</span></p>
                  <p><span className="text-muted-foreground">ID do produto:</span> <span className="font-mono text-foreground">{result.product_id}</span></p>
                  <p><span className="text-muted-foreground">Disciplinas criadas/atualizadas:</span> <span className="font-medium text-foreground">{result.disciplines_upserted}</span></p>
                  <p><span className="text-muted-foreground">Cards inseridos:</span> <span className="font-medium text-foreground">{result.cards_inserted}</span></p>
                </div>
                <button
                  onClick={reset}
                  className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-surface-hover transition-colors"
                >
                  Importar outro deck
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Mentor select */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Mentor <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={mentorId}
                    onChange={e => setMentorId(e.target.value)}
                    required
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                  >
                    <option value="">Selecione um mentor...</option>
                    {mentors.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                {/* File input */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Arquivo .apkg <span className="text-destructive">*</span>
                  </label>
                  <div
                    className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background px-4 py-8 text-center transition-colors hover:border-primary/50 cursor-pointer"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    {file ? (
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Clique para selecionar ou arraste o arquivo</p>
                    )}
                    <p className="text-xs text-muted-foreground">Apenas arquivos .apkg</p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".apkg"
                      required
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !mentorId || !file}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <FileDown className="h-4 w-4" />
                      Importar Deck
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          <p className="mt-4 text-xs text-muted-foreground text-center">
            O serviço de importação ainda não está em produção. Configure <code className="font-mono">VITE_ANKI_IMPORTER_URL</code> quando o deploy estiver disponível.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminImportDeck;
