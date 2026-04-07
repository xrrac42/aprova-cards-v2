import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession, clearSession } from '@/lib/auth';
import {
  LayoutDashboard, Users, Package, BookOpen, CreditCard, Upload,
  GraduationCap, BarChart3, Palette, LogOut, ChevronRight, Plus, Menu, X, Activity, ShieldCheck, MessageSquare
} from 'lucide-react';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/mentores', label: 'Mentores', icon: Users },
  { to: '/admin/produtos', label: 'Produtos', icon: Package },
  
  { to: '/admin/alunos', label: 'Alunos', icon: GraduationCap },
  { to: '/admin/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/admin/feedbacks', label: 'Feedbacks', icon: MessageSquare },
  { to: '/admin/saude', label: 'Saúde', icon: Activity },
  { to: '/admin/qualidade', label: 'Qualidade', icon: ShieldCheck },
  { to: '/admin/personalizacao', label: 'Personalização', icon: Palette },
];

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-card transition-transform duration-300 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between px-6 border-b border-border">
          <span className="font-display text-lg font-bold text-foreground">Admin</span>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile header */}
        <header className="flex h-16 items-center gap-4 border-b border-border bg-card px-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display font-semibold text-foreground">Admin</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

// ─── Dashboard Page ───────────────────────────────────────────────────────────
const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [products, setProducts] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalProducts: 0, totalCards: 0, totalDisciplines: 0, totalMentors: 0 });

  useEffect(() => {
    if (!session || session.role !== 'admin') { navigate('/login'); return; }
    loadData();
  }, []);

  const loadData = async () => {
    const [{ data: prods }, { data: mnts }, { count: cardCount }, { count: discCount }] = await Promise.all([
      supabase.from('products').select('*, mentors(name)'),
      supabase.from('mentors').select('*'),
      supabase.from('cards').select('*', { count: 'exact', head: true }),
      supabase.from('disciplines').select('*', { count: 'exact', head: true }),
    ]);

    setProducts(prods || []);
    setMentors(mnts || []);
    setStats({
      totalProducts: prods?.length || 0,
      totalCards: cardCount || 0,
      totalDisciplines: discCount || 0,
      totalMentors: mnts?.length || 0,
    });
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Visão geral da plataforma</p>
            </div>
            <Link
              to="/admin/produtos/novo"
              className="flex items-center gap-2 rounded-xl bg-primary px-3 sm:px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Produto</span>
              <span className="sm:hidden">Novo</span>
            </Link>
          </div>

          {/* Stats */}
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Mentores', value: stats.totalMentors, icon: Users },
              { label: 'Produtos', value: stats.totalProducts, icon: Package },
              { label: 'Disciplinas', value: stats.totalDisciplines, icon: BookOpen },
              { label: 'Cards', value: stats.totalCards, icon: CreditCard },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-border bg-card p-4">
                <Icon className="mb-2 h-5 w-5 text-muted-foreground" />
                <p className="font-display text-2xl font-bold text-foreground">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* Products list */}
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-foreground">Produtos recentes</h2>
            {products.slice(0, 5).map((product) => (
              <Link
                key={product.id}
                to={`/admin/produto/${product.id}`}
                className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-surface-hover active:scale-[0.99] touch-manipulation"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-display font-semibold text-foreground truncate">{product.name}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    <span className="hidden sm:inline">Código: </span>{product.access_code} · {(product.mentors as any)?.name || 'N/A'}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${product.active ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive'}`}>
                    {product.active ? 'Ativo' : 'Inativo'}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
