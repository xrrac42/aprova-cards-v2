import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { applyMentorTheme } from '@/lib/theme';
import { ArrowLeft, Search, CalendarDays, BookOpen, Target, AlertTriangle, RefreshCw, LockOpen, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StudentRow {
  email: string;
  productName: string;
  productId: string;
  lastAccess: string;
  totalCards: number;
  correct: number;
  incorrect: number;
  active: boolean;
  inactiveReason: string | null;
}

interface ModalData {
  totalCards: number;
  accuracy: number;
  lastAccess: string;
  disciplines: { name: string; reviewed: number; total: number; accuracy: number }[];
  sessions: { date: string; cards: number; accuracy: number }[];
  topErrors: { front: string; back: string; errors: number }[];
}

const formatDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr + 'T12:00:00');
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  } catch {
    return dateStr;
  }
};

const formatDateShort = (dateStr: string) => {
  try {
    const date = new Date(dateStr + 'T12:00:00');
    const day = date.getDate();
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${day} ${months[date.getMonth()]}`;
  } catch {
    return dateStr;
  }
};

const StatusBadge: React.FC<{ active: boolean; reason: string | null }> = ({ active, reason }) => {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-medium text-secondary">
        <LockOpen className="h-3 w-3" /> Ativo
      </span>
    );
  }
  const labels: Record<string, { text: string; cls: string }> = {
    refund: { text: 'Reembolso', cls: 'bg-destructive/10 text-destructive' },
    chargeback: { text: 'Chargeback', cls: 'bg-destructive/10 text-destructive' },
    manual: { text: 'Desativado', cls: 'bg-muted text-muted-foreground' },
  };
  const label = labels[reason || ''] || { text: 'Inativo', cls: 'bg-muted text-muted-foreground' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${label.cls}`}>
      <Lock className="h-3 w-3" /> {label.text}
    </span>
  );
};

const MentorStudents: React.FC = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingEmail, setTogglingEmail] = useState<string | null>(null);

  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [confirmStudent, setConfirmStudent] = useState<StudentRow | null>(null);

  useEffect(() => {
    if (!session || session.role !== 'mentor' || !session.mentor_id) { navigate('/login'); return; }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const mentorId = session!.mentor_id!;

      const { data: mentorData } = await supabase.from('mentors').select('*').eq('id', mentorId).maybeSingle();
      if (mentorData) applyMentorTheme(mentorData.primary_color, mentorData.secondary_color);

      const { data: prods } = await supabase.from('products').select('*').eq('mentor_id', mentorId);
      setProducts(prods || []);
      if (!prods || prods.length === 0) { setLoading(false); return; }

      const productIds = prods.map(p => p.id);
      const productMap = Object.fromEntries(prods.map(p => [p.id, p.name]));

      const [{ data: sessions }, { data: accessList }] = await Promise.all([
        supabase.from('student_sessions').select('*').in('product_id', productIds),
        supabase.from('student_access').select('email, product_id, active, inactive_reason').in('product_id', productIds),
      ]);

      // Build access map: email__product_id -> { active, inactive_reason }
      const accessMap = new Map<string, { active: boolean; inactiveReason: string | null }>();
      for (const a of (accessList || [])) {
        accessMap.set(`${a.email}__${a.product_id}`, { active: a.active, inactiveReason: (a as any).inactive_reason || null });
      }

      const map = new Map<string, StudentRow>();
      for (const s of (sessions || [])) {
        const key = `${s.student_email}__${s.product_id}`;
        const access = accessMap.get(key);
        const existing = map.get(key);
        if (!existing) {
          map.set(key, {
            email: s.student_email,
            productName: productMap[s.product_id] || '',
            productId: s.product_id,
            lastAccess: s.session_date,
            totalCards: s.cards_reviewed,
            correct: s.correct,
            incorrect: s.incorrect,
            active: access?.active ?? true,
            inactiveReason: access?.inactiveReason ?? null,
          });
        } else {
          existing.totalCards += s.cards_reviewed;
          existing.correct += s.correct;
          existing.incorrect += s.incorrect;
          if (s.session_date > existing.lastAccess) existing.lastAccess = s.session_date;
        }
      }

      // Also add students from student_access that have no sessions yet
      for (const a of (accessList || [])) {
        const key = `${a.email}__${a.product_id}`;
        if (!map.has(key)) {
          map.set(key, {
            email: a.email,
            productName: productMap[a.product_id] || '',
            productId: a.product_id,
            lastAccess: '',
            totalCards: 0,
            correct: 0,
            incorrect: 0,
            active: a.active,
            inactiveReason: (a as any).inactive_reason || null,
          });
        }
      }

      setStudents(Array.from(map.values()));
    } catch (err: any) {
      setError('Erro ao carregar alunos. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return students.filter(s => {
      if (search && !s.email.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterProduct && s.productId !== filterProduct) return false;
      if (filterStatus === 'active' && !s.active) return false;
      if (filterStatus === 'inactive' && s.active) return false;
      return true;
    });
  }, [students, search, filterProduct, filterStatus]);

  const handleToggleClick = (student: StudentRow, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (student.active) {
      // Desativar → pedir confirmação
      setConfirmStudent(student);
    } else {
      // Reativar → direto
      executeToggle(student);
    }
  };

  const executeToggle = async (student: StudentRow) => {
    const key = `${student.email}__${student.productId}`;
    setTogglingEmail(key);

    const newActive = !student.active;
    const newReason = newActive ? null : 'manual';

    // Optimistic update
    setStudents(prev => prev.map(s =>
      s.email === student.email && s.productId === student.productId
        ? { ...s, active: newActive, inactiveReason: newReason }
        : s
    ));

    const { error } = await supabase
      .from('student_access')
      .update({ active: newActive, inactive_reason: newReason } as any)
      .eq('email', student.email)
      .eq('product_id', student.productId);

    if (error) {
      // Revert on error
      setStudents(prev => prev.map(s =>
        s.email === student.email && s.productId === student.productId
          ? { ...s, active: student.active, inactiveReason: student.inactiveReason }
          : s
      ));
    }

    // Update selected student if modal is open
    if (selectedStudent?.email === student.email && selectedStudent?.productId === student.productId) {
      setSelectedStudent(prev => prev ? { ...prev, active: newActive, inactiveReason: newReason } : null);
    }

    setTogglingEmail(null);
  };

  const openStudentModal = async (student: StudentRow) => {
    setSelectedStudent(student);
    setModalData(null);

    try {
      const [
        { data: disciplines },
        { data: cards },
        { data: progress },
        { data: sessHistory },
        { data: progressFull },
      ] = await Promise.all([
        supabase.from('disciplines').select('id, name').eq('product_id', student.productId).order('order'),
        supabase.from('cards').select('id, discipline_id').eq('product_id', student.productId),
        supabase.from('student_progress')
          .select('card_id, correct_count, incorrect_count, rating')
          .eq('student_email', student.email)
          .eq('product_id', student.productId),
        supabase.from('student_sessions')
          .select('session_date, cards_reviewed, correct, incorrect')
          .eq('student_email', student.email)
          .eq('product_id', student.productId)
          .order('session_date', { ascending: false })
          .limit(20),
        supabase.from('student_progress')
          .select('card_id, incorrect_count')
          .eq('student_email', student.email)
          .eq('product_id', student.productId)
          .order('incorrect_count', { ascending: false })
          .limit(5),
      ]);

      const reviewedMap = new Map((progress || []).map(p => [p.card_id, p]));
      const discStats = (disciplines || []).map(d => {
        const discCards = (cards || []).filter(c => c.discipline_id === d.id);
        const reviewed = discCards.filter(c => reviewedMap.has(c.id));
        const totalCorrect = reviewed.reduce((sum, c) => sum + (reviewedMap.get(c.id)?.correct_count ?? 0), 0);
        const totalIncorrect = reviewed.reduce((sum, c) => sum + (reviewedMap.get(c.id)?.incorrect_count ?? 0), 0);
        const total_answers = totalCorrect + totalIncorrect;
        return {
          name: d.name,
          reviewed: reviewed.length,
          total: discCards.length,
          accuracy: total_answers > 0 ? Math.round((totalCorrect / total_answers) * 100) : 0,
        };
      });

      const totalCorrectAll = (progress || []).reduce((sum, p) => sum + p.correct_count, 0);
      const totalIncorrectAll = (progress || []).reduce((sum, p) => sum + p.incorrect_count, 0);
      const totalAnswers = totalCorrectAll + totalIncorrectAll;
      const overallAccuracy = totalAnswers > 0 ? Math.round((totalCorrectAll / totalAnswers) * 100) : 0;

      const sessionsFormatted = (sessHistory || []).map(s => ({
        date: s.session_date,
        cards: s.cards_reviewed,
        accuracy: s.cards_reviewed > 0 ? Math.round((s.correct / s.cards_reviewed) * 100) : 0,
      }));

      let topErrors: { front: string; back: string; errors: number }[] = [];
      const withErrors = (progressFull || []).filter(p => p.incorrect_count > 0);
      if (withErrors.length > 0) {
        const cardIds = withErrors.map(p => p.card_id);
        const { data: errorCards } = await supabase.from('cards').select('id, front, back').in('id', cardIds);
        const cardMap = Object.fromEntries((errorCards || []).map(c => [c.id, c]));
        topErrors = withErrors.map(p => ({
          front: cardMap[p.card_id]?.front || '',
          back: cardMap[p.card_id]?.back || '',
          errors: p.incorrect_count,
        }));
      }

      setModalData({
        totalCards: student.totalCards,
        accuracy: overallAccuracy,
        lastAccess: student.lastAccess,
        disciplines: discStats,
        sessions: sessionsFormatted,
        topErrors,
      });
    } catch (err) {
      console.error('Erro ao carregar detalhes do aluno:', err);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>;
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <p className="mb-4 text-center text-muted-foreground">{error}</p>
        <button onClick={loadData} className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 font-display font-semibold text-primary-foreground hover:opacity-90">
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 pb-safe pb-8 pt-6">
      <div className="mx-auto max-w-5xl">
        <Link to="/mentor" className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors touch-manipulation">
          <ArrowLeft className="h-4 w-4" /> Voltar ao painel
        </Link>

        <h1 className="mb-6 font-display text-2xl font-bold text-foreground">Alunos</h1>

        {/* Filters — side by side on md+ */}
        <div className="mb-6 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por e-mail..."
              className="w-full rounded-2xl border border-border bg-surface pl-10 pr-4 py-3 text-foreground text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
          <select
            value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
            className="rounded-2xl border border-border bg-surface px-4 py-3 text-foreground text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors md:w-48"
          >
            <option value="">Todos os produtos</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="rounded-2xl border border-border bg-surface px-4 py-3 text-foreground text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors md:w-40"
          >
            <option value="">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">Nenhum aluno encontrado</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {filtered.map((s, i) => {
                const accuracy = (s.correct + s.incorrect) > 0 ? Math.round((s.correct / (s.correct + s.incorrect)) * 100) : 0;
                return (
                  <button key={i} onClick={() => openStudentModal(s)} className="w-full text-left rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-surface-hover active:scale-[0.98] touch-manipulation">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{s.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.productName}</p>
                      </div>
                      <button
                        onClick={(e) => handleToggleClick(s, e)}
                        disabled={togglingEmail === `${s.email}__${s.productId}`}
                        className="shrink-0 transition-opacity hover:opacity-70 disabled:opacity-50"
                        title={s.active ? 'Clique para desativar' : 'Clique para reativar'}
                      >
                        <StatusBadge active={s.active} reason={s.inactiveReason} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Cards</p>
                        <p className="font-display font-bold text-foreground">{s.totalCards}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Acerto</p>
                        <p className={`font-display font-bold ${accuracy >= 70 ? 'text-secondary' : accuracy >= 50 ? 'text-primary' : 'text-destructive'}`}>{accuracy}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Acesso</p>
                        <p className="font-display font-bold text-foreground text-xs">{formatDateShort(s.lastAccess)}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último acesso</TableHead>
                    <TableHead className="text-right">Cards revisados</TableHead>
                    <TableHead className="text-right">Taxa de acerto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s, i) => {
                    const accuracy = (s.correct + s.incorrect) > 0 ? Math.round((s.correct / (s.correct + s.incorrect)) * 100) : 0;
                    return (
                      <TableRow key={i} className="cursor-pointer hover:bg-surface-hover transition-colors" onClick={() => openStudentModal(s)}>
                        <TableCell className="font-medium">{s.email}</TableCell>
                        <TableCell>{s.productName}</TableCell>
                        <TableCell>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleClick(s, e); }}
                            disabled={togglingEmail === `${s.email}__${s.productId}`}
                            className="transition-opacity hover:opacity-70 disabled:opacity-50"
                            title={s.active ? 'Clique para desativar' : 'Clique para reativar'}
                          >
                            <StatusBadge active={s.active} reason={s.inactiveReason} />
                          </button>
                        </TableCell>
                        <TableCell>{s.lastAccess ? formatDate(s.lastAccess) : '—'}</TableCell>
                        <TableCell className="text-right">{s.totalCards}</TableCell>
                        <TableCell className="text-right">{accuracy}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* Student Detail Modal */}
        <Dialog open={!!selectedStudent} onOpenChange={(open) => { if (!open) { setSelectedStudent(null); setModalData(null); } }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="font-display text-foreground break-all">{selectedStudent?.email}</DialogTitle>
                  <p className="text-sm text-muted-foreground">{selectedStudent?.productName}</p>
                </div>
                {selectedStudent && (
                  <button
                    onClick={() => handleToggleClick(selectedStudent)}
                    disabled={togglingEmail === `${selectedStudent.email}__${selectedStudent.productId}`}
                    className="shrink-0 transition-opacity hover:opacity-70 disabled:opacity-50 mt-1"
                    title={selectedStudent.active ? 'Clique para desativar' : 'Clique para reativar'}
                  >
                    <StatusBadge active={selectedStudent.active} reason={selectedStudent.inactiveReason} />
                  </button>
                )}
              </div>
            </DialogHeader>

            {!modalData ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-border bg-surface p-3 text-center">
                    <BookOpen className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                    <p className="font-display text-xl font-bold text-foreground">{modalData.totalCards}</p>
                    <p className="text-xs text-muted-foreground">Cards revisados</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-surface p-3 text-center">
                    <Target className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                    <p className="font-display text-xl font-bold text-primary">{modalData.accuracy}%</p>
                    <p className="text-xs text-muted-foreground">Taxa de acerto</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-surface p-3 text-center">
                    <CalendarDays className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                    <p className="font-display text-sm font-bold text-foreground">{modalData.lastAccess ? formatDateShort(modalData.lastAccess) : '—'}</p>
                    <p className="text-xs text-muted-foreground">Último acesso</p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 font-display text-sm font-semibold text-foreground">Progresso por Disciplina</h3>
                  <div className="space-y-3">
                    {modalData.disciplines.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhuma disciplina encontrada</p>
                    )}
                    {modalData.disciplines.map((d, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{d.name}</span>
                          <span className="flex gap-2">
                            <span>{d.reviewed}/{d.total} cards</span>
                            {d.reviewed > 0 && <span className="text-primary font-medium">{d.accuracy}% acerto</span>}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${d.total > 0 ? (d.reviewed / d.total) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {modalData.topErrors.length > 0 && (
                  <div>
                    <h3 className="mb-3 font-display text-sm font-semibold text-foreground flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Top 5 Cards com Mais Erros
                    </h3>
                    <div className="space-y-2">
                      {modalData.topErrors.map((c, i) => (
                        <div key={i} className="rounded-2xl bg-surface p-3 border border-border">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{c.front}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.back}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{c.errors} erros</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="mb-3 font-display text-sm font-semibold text-foreground">Histórico de Sessões</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {modalData.sessions.map((s, i) => (
                      <div key={i} className="flex items-center justify-between rounded-2xl bg-surface p-3 text-sm border border-border">
                        <span className="text-muted-foreground">{formatDateShort(s.date)}</span>
                        <div className="flex gap-3">
                          <span className="text-foreground">{s.cards} cards</span>
                          <span className={`font-medium ${s.accuracy >= 70 ? 'text-secondary' : s.accuracy >= 50 ? 'text-primary' : 'text-destructive'}`}>
                            {s.accuracy}%
                          </span>
                        </div>
                      </div>
                    ))}
                    {modalData.sessions.length === 0 && <p className="text-sm text-muted-foreground">Sem sessões registradas</p>}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Confirmation dialog for deactivation */}
        <AlertDialog open={!!confirmStudent} onOpenChange={(open) => { if (!open) setConfirmStudent(null); }}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display text-foreground">Desativar aluno?</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                O aluno <span className="font-medium text-foreground">{confirmStudent?.email}</span> perderá o acesso ao produto <span className="font-medium text-foreground">{confirmStudent?.productName}</span>. Você poderá reativá-lo depois.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { if (confirmStudent) executeToggle(confirmStudent); setConfirmStudent(null); }}
              >
                Desativar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default MentorStudents;
