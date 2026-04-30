import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, MessageCircle, Send } from 'lucide-react';

interface FeedbackPopupProps {
  email: string;
  productId: string;
}

const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const POPUP_DELAY_MS = 3000;

const FeedbackPopup: React.FC<FeedbackPopupProps> = ({ email, productId }) => {
  const [show, setShow] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [sending, setSending] = useState(false);
  const [thankYou, setThankYou] = useState(false);
  const [totalCards, setTotalCards] = useState(0);

  const STORAGE_KEY = `feedback_popup_last_seen_${productId}_${email}`;

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const markLastSeen = () => {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    };

    const checkEligibility = async () => {
      try {
        const lastSeen = localStorage.getItem(STORAGE_KEY);
        if (lastSeen && Date.now() - Number(lastSeen) < COOLDOWN_MS) {
          return;
        }

        const { data: progressData } = await supabase
          .from('student_progress')
          .select('correct_count, incorrect_count')
          .eq('student_email', email)
          .eq('product_id', productId);

        const total = (progressData ?? []).reduce(
          (sum, row) => sum + (row.correct_count || 0) + (row.incorrect_count || 0),
          0
        );

        if (total < 100) return;
        if (!cancelled) {
          setTotalCards(total);
        }

        const { data: latestFeedback, error } = await supabase
          .from('student_feedback')
          .select('criado_em')
          .eq('student_email', email)
          .eq('product_id', productId)
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.warn('Feedback query failed, suppressing popup:', error.message);
          return;
        }

        if (latestFeedback?.criado_em) {
          const feedbackAge = Date.now() - new Date(latestFeedback.criado_em).getTime();
          if (feedbackAge < COOLDOWN_MS) {
            markLastSeen();
            return;
          }
        }

        timeout = setTimeout(() => {
          if (cancelled) return;
          markLastSeen();
          setShow(true);
        }, POPUP_DELAY_MS);
      } catch (err) {
        console.warn('Feedback eligibility check failed (non-blocking):', err);
      }
    };

    checkEligibility();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [email, productId, STORAGE_KEY]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setShow(false);
  };

  const handleSubmit = async () => {
    if (!mensagem.trim() || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.from('student_feedback').insert({
        student_email: email,
        product_id: productId,
        mensagem: mensagem.trim(),
        total_cards_epoca: totalCards,
      });

      if (error) {
        throw error;
      }

      localStorage.setItem(STORAGE_KEY, Date.now().toString());
      setThankYou(true);
      setTimeout(() => setShow(false), 2000);
    } catch (err) {
      console.error('Failed to send feedback:', err);
    } finally {
      setSending(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pointer-events-none">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md pointer-events-auto animate-in slide-in-from-bottom-4 duration-300">
        {thankYou ? (
          <div className="p-6 text-center">
            <div className="text-3xl mb-2">🎉</div>
            <p className="text-foreground font-semibold">Obrigado pelo seu feedback!</p>
            <p className="text-muted-foreground text-sm mt-1">Sua opinião é muito importante para nós.</p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between p-4 pb-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Queremos te ouvir! 💬</h3>
              </div>
              <button
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 pb-2">
              <p className="text-sm text-muted-foreground">
                Sua opinião ajuda a melhorar a plataforma. Como está sendo sua experiência?
              </p>
            </div>
            <div className="px-4 pb-3">
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Conte o que está achando..."
                rows={3}
                className="w-full rounded-xl border border-border bg-background text-foreground text-sm p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex gap-2 px-4 pb-4">
              <button
                onClick={handleDismiss}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Agora não
              </button>
              <button
                onClick={handleSubmit}
                disabled={!mensagem.trim() || sending}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sending ? 'Enviando...' : 'Enviar feedback'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FeedbackPopup;
