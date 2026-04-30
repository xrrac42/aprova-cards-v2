import React, { useEffect, useState, useMemo } from 'react';
import { AdminLayout } from './AdminDashboard';
import { supabase } from '@/integrations/supabase/client';
import { Download, MessageSquare, Filter } from 'lucide-react';

interface Feedback {
  id: string;
  student_email: string;
  product_id: string;
  mensagem: string;
  total_cards_epoca: number;
  criado_em: string;
  product_name?: string;
}

interface Product {
  id: string;
  name: string;
}

export default function AdminFeedbacks() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [fbResult, prodResult] = await Promise.all([
          supabase
            .from('student_feedback' as any)
            .select('*')
            .order('criado_em', { ascending: false }) as any,
          supabase.from('products').select('id, name').order('name'),
        ]);

        const prods: Product[] = prodResult.data || [];
        setProducts(prods);

        const prodMap = new Map(prods.map(p => [p.id, p.name]));
        const fbs = (fbResult.data || []).map((f: any) => ({
          ...f,
          product_name: prodMap.get(f.product_id) || 'Produto desconhecido',
        }));
        setFeedbacks(fbs);
      } catch (err) {
        console.error('Failed to load feedbacks:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    if (selectedProduct === 'all') return feedbacks;
    return feedbacks.filter(f => f.product_id === selectedProduct);
  }, [feedbacks, selectedProduct]);

  const exportCSV = () => {
    const header = 'Email,Produto,Mensagem,Total Cards,Data\n';
    const rows = filtered.map(f => {
      const msg = f.mensagem.replace(/"/g, '""');
      const date = new Date(f.criado_em).toLocaleDateString('pt-BR');
      return `"${f.student_email}","${f.product_name}","${msg}",${f.total_cards_epoca},"${date}"`;
    }).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedbacks_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Feedbacks</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length} feedback{filtered.length !== 1 ? 's' : ''} recebido{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                value={selectedProduct}
                onChange={e => setSelectedProduct(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-xl border border-border bg-card text-foreground text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">Todos os produtos</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhum feedback recebido ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(f => (
              <div key={f.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{f.student_email}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {f.product_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{f.total_cards_epoca} cards estudados</span>
                    <span>{new Date(f.criado_em).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}</span>
                  </div>
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{f.mensagem}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
