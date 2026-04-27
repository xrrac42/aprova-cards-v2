import React, { useEffect, useState, useCallback, useRef, memo, TouchEvent as ReactTouchEvent } from 'react';
import CardContent from '@/components/CardContent';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession } from '@/lib/auth';
import { calculateNextReview, isCorrectRating } from '@/lib/spaced-repetition';
import type { Rating } from '@/types';
import { X, RefreshCw } from 'lucide-react';
import FeedbackPopup from '@/components/FeedbackPopup';

type StudyMode = 'review' | 'new' | 'mixed';

function normalizeStudyMode(mode: string | null): StudyMode {
  return mode === 'review' || mode === 'new' || mode === 'mixed' ? mode : 'mixed';
}

interface StudyCard {
  id: string;
  front: string;
  back: string;
  discipline_id: string;
  discipline_name?: string;
  existing_correct_count?: number;
  existing_incorrect_count?: number;
}

// ─── Module-level state (survives React unmount/remount) ───
let activeSessionKey: string | null = null;
let activeCards: StudyCard[] = [];
let activeIndex = 0;
let activeRatedIds = new Set<string>();
let activeStats = { reviewed: 0, correct: 0, incorrect: 0 };
let activeStartTime: number | null = null;
let activeTimerRunning = true;
let activeDisciplineName = '';
let activeTotalCount = 0;
let activeProgressCache = new Map<string, { correct_count: number; incorrect_count: number }>();
let activeLoaded = false;

function resetModuleState(key: string) {
  activeSessionKey = key;
  activeCards = [];
  activeIndex = 0;
  activeRatedIds = new Set<string>();
  activeStats = { reviewed: 0, correct: 0, incorrect: 0 };
  activeStartTime = Date.now();
  activeTimerRunning = true;
  activeDisciplineName = '';
  activeTotalCount = 0;
  activeProgressCache = new Map();
  activeLoaded = false;
}

// ─── Swipeable card component ───
const SWIPE_THRESHOLD = 80;

const CardDisplay = memo(({ card, flipped, onFlip, onSwipe }: {
  card: StudyCard;
  flipped: boolean;
  onFlip: () => void;
  onSwipe?: (direction: 'left' | 'right') => void;
}) => {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  const handleTouchStart = useCallback((e: ReactTouchEvent) => {
    if (!flipped || !onSwipe) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    setSwipeOffset(0);
    setSwipeDirection(null);
  }, [flipped, onSwipe]);

  const handleTouchMove = useCallback((e: ReactTouchEvent) => {
    if (!touchStartRef.current || !flipped || !onSwipe) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 20) return;
    e.preventDefault();
    setSwipeOffset(dx);
    setSwipeDirection(dx > 30 ? 'right' : dx < -30 ? 'left' : null);
  }, [flipped, onSwipe]);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !flipped || !onSwipe) {
      touchStartRef.current = null;
      return;
    }
    if (Math.abs(swipeOffset) >= SWIPE_THRESHOLD) {
      onSwipe(swipeOffset > 0 ? 'right' : 'left');
    }
    setSwipeOffset(0);
    setSwipeDirection(null);
    touchStartRef.current = null;
  }, [swipeOffset, flipped, onSwipe]);

  const opacity = Math.min(Math.abs(swipeOffset) / SWIPE_THRESHOLD, 1);
  const rotate = swipeOffset * 0.08;

  return (
    <div className="card-container w-full max-w-md mx-auto flex-1 flex items-center relative px-4">
      {flipped && onSwipe && (
        <>
          <div
            className="absolute left-6 bottom-8 z-10 pointer-events-none transition-opacity text-destructive text-[13px] font-semibold"
            style={{ opacity: swipeDirection === 'left' ? opacity : 0 }}
          >
            ✕ Errei
          </div>
          <div
            className="absolute right-6 bottom-8 z-10 pointer-events-none transition-opacity text-rating-easy text-[13px] font-semibold"
            style={{ opacity: swipeDirection === 'right' ? opacity : 0 }}
          >
            Fácil ★
          </div>
        </>
      )}
      <div
        className={`card-inner ${flipped ? 'flipped' : ''} w-full`}
        onClick={!flipped ? onFlip : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          minHeight: 'min(55vh, 400px)',
          cursor: flipped ? 'grab' : 'pointer',
          transform: flipped && swipeOffset !== 0
            ? `rotateY(180deg) translateX(${-swipeOffset}px) rotate(${-rotate}deg)`
            : flipped ? 'rotateY(180deg)' : undefined,
          transition: swipeOffset !== 0 ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Front */}
        <div
          className="card-front flex flex-col items-center justify-center relative overflow-hidden rounded-2xl border border-border bg-card"
          style={{ padding: '32px 24px' }}
        >
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl bg-primary" />
          {card.discipline_name && (
            <span className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-widest uppercase text-primary opacity-80 whitespace-nowrap">
              {card.discipline_name}
            </span>
          )}
          <p className="text-[clamp(15px,4vw,18px)] font-medium leading-relaxed text-foreground/90 text-center whitespace-pre-line break-words max-w-full">
            <CardContent text={card.front} />
          </p>
          <div className="mt-6 flex items-center gap-2 text-muted-foreground/30">
            <span className="text-[11px]">Toque para virar</span>
          </div>
        </div>
        {/* Back */}
        <div
          className="card-back flex flex-col items-center justify-center relative overflow-hidden rounded-2xl border border-border bg-card"
          style={{ padding: '32px 24px' }}
        >
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl bg-primary" />
          {card.discipline_name && (
            <span className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-widest uppercase text-primary opacity-80 whitespace-nowrap">
              {card.discipline_name}
            </span>
          )}
          <p className="text-[clamp(14px,3.5vw,16px)] font-normal leading-relaxed text-foreground/75 text-center break-words max-w-full overflow-auto max-h-[50vh]">
            <CardContent text={card.back} />
          </p>
          {onSwipe && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-between px-5 pointer-events-none text-[10px] text-muted-foreground/20 tracking-wide">
              <span>← Errei</span>
              <span>Fácil →</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
CardDisplay.displayName = 'CardDisplay';

// Memoized rating buttons
const RATING_CONFIG = [
  { rating: 'errei' as Rating, label: 'Errei', colorClass: 'bg-destructive/15 text-destructive' },
  { rating: 'dificil' as Rating, label: 'Difícil', colorClass: 'bg-rating-hard/15 text-rating-hard' },
  { rating: 'medio' as Rating, label: 'Médio', colorClass: 'bg-secondary/15 text-secondary' },
  { rating: 'facil' as Rating, label: 'Fácil', colorClass: 'bg-rating-easy/15 text-rating-easy' },
];

const RatingButtons = memo(({ onRate, disabled }: {
  onRate: (rating: Rating) => void;
  disabled: boolean;
}) => (
  <div className="fixed bottom-0 left-0 right-0 z-20 px-4 shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 32px)' }}>
    <div className="grid grid-cols-4 gap-2.5 max-w-md mx-auto">
      {RATING_CONFIG.map(({ rating, label, colorClass }) => (
        <button
          key={rating}
          onClick={() => onRate(rating)}
          disabled={disabled}
          className={`select-none touch-manipulation disabled:opacity-50 transition-transform duration-100 active:scale-[0.96] active:opacity-85 py-4 rounded-2xl text-[13px] sm:text-[15px] font-semibold tracking-tight ${colorClass}`}
        >
          {label}
        </button>
      ))}
    </div>
  </div>
));
RatingButtons.displayName = 'RatingButtons';

const StudySession: React.FC = () => {
  const { disciplineId } = useParams<{ disciplineId: string }>();
  const [searchParams] = useSearchParams();
  const studyMode = normalizeStudyMode(searchParams.get('mode'));
  const newLimit = parseInt(searchParams.get('newLimit') || '0', 10) || 50;
  const navigate = useNavigate();

  const sessionRef = useRef(getSession());
  const session = sessionRef.current;

  // Derive session key to detect new vs restored session
  const sessionKey = `${session?.email ?? 'anon'}_${session?.product_id ?? 'no-product'}_${disciplineId}_${studyMode}_${newLimit}`;

  // Local state — synced from module-level on mount
  const [cards, setCardsLocal] = useState<StudyCard[]>([]);
  const [currentIndex, setCurrentIndexLocal] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0, incorrect: 0 });
  const [transitioning, setTransitioning] = useState(false);
  const [totalCardsCount, setTotalCardsCount] = useState(0);
  const [disciplineName, setDisciplineName] = useState('');
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(true);
  const [slideOut, setSlideOut] = useState<'left' | 'right' | null>(null);
  const [slideIn, setSlideIn] = useState(false);

  const transitioningRef = useRef(false);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideInTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopwatchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync helpers — update both module-level and React state
  const setCards = useCallback((next: StudyCard[]) => {
    activeCards = next;
    setCardsLocal(next);
  }, []);

  const setCurrentIndex = useCallback((next: number) => {
    activeIndex = next;
    setCurrentIndexLocal(next);
  }, []);

  const updateStats = useCallback((next: { reviewed: number; correct: number; incorrect: number }) => {
    activeStats = next;
    setSessionStats(next);
  }, []);

  const clearTransitionTimers = useCallback(() => {
    if (advanceTimeoutRef.current) { clearTimeout(advanceTimeoutRef.current); advanceTimeoutRef.current = null; }
    if (slideInTimeoutRef.current) { clearTimeout(slideInTimeoutRef.current); slideInTimeoutRef.current = null; }
  }, []);

  // ─── Mount: restore or initialize ───
  useEffect(() => {
    if (!session || session.role !== 'aluno' || !session.product_id) {
      navigate('/login');
      return;
    }

    const isRestoredSession = activeSessionKey === sessionKey && activeCards.length > 0 && activeLoaded;

    if (isRestoredSession) {
      // Restore from module-level state — no DB call
      setCardsLocal(activeCards);
      setCurrentIndexLocal(activeIndex);
      setSessionStats(activeStats);
      setTotalCardsCount(activeTotalCount);
      setDisciplineName(activeDisciplineName);
      setStopwatchRunning(activeTimerRunning);
      setLoading(false);
    } else {
      // Fresh session
      resetModuleState(sessionKey);
      loadCards();
    }

    // Elapsed-time stopwatch: reads Date.now() each tick
    if (!stopwatchIntervalRef.current) {
      stopwatchIntervalRef.current = setInterval(() => {
        if (activeStartTime && activeTimerRunning) {
          setStopwatchSeconds(Math.floor((Date.now() - activeStartTime) / 1000));
        }
      }, 1000);
    }

    return () => {
      clearTransitionTimers();
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
        stopwatchIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── End-of-session: navigate only from effect, never from render ───
  useEffect(() => {
    if (loading) return;
    if (cards.length === 0 || currentIndex < cards.length) return;
    if (activeStats.reviewed === 0) return;

    const studyTimeSecs = activeStartTime ? Math.floor((Date.now() - activeStartTime) / 1000) : 0;
    activeSessionKey = null;
    activeCards = [];
    activeLoaded = false;
    navigate('/aluno/fim-de-sessao', {
      state: { stats: activeStats, disciplineName: activeDisciplineName, studyTimeSeconds: studyTimeSecs },
    });
  }, [loading, cards, currentIndex, navigate]);

  const loadCards = async () => {
    try {
      setLoading(true);
      setError(null);
      const isAll = disciplineId === 'all';

      const url = `/api/v1/student/study-cards?product_id=${session!.product_id}${isAll ? '' : `&discipline_id=${disciplineId}`}&mode=${studyMode}&new_limit=${newLimit}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Falha ao buscar cards');

      const rawCards: any[] = json.data || [];

      // Deduplicate
      const seen = new Set<string>();
      const studyCards: StudyCard[] = [];
      for (const c of rawCards) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        studyCards.push({
          id: c.id,
          front: c.front,
          back: c.back,
          discipline_id: c.discipline_id,
          discipline_name: c.discipline_name,
          existing_correct_count: c.existing_correct_count || 0,
          existing_incorrect_count: c.existing_incorrect_count || 0,
        });
      }

      // Discipline name: derive from cards (backend already returns discipline_name per card)
      const discName = isAll
        ? 'Todas as disciplinas'
        : studyCards[0]?.discipline_name || '';
      activeDisciplineName = discName;
      setDisciplineName(discName);

      // Fisher-Yates shuffle
      for (let i = studyCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [studyCards[i], studyCards[j]] = [studyCards[j], studyCards[i]];
      }

      for (const c of studyCards) {
        activeProgressCache.set(c.id, {
          correct_count: c.existing_correct_count || 0,
          incorrect_count: c.existing_incorrect_count || 0,
        });
      }

      activeTotalCount = studyCards.length;
      activeLoaded = true;
      setCurrentIndex(0);
      setTotalCardsCount(studyCards.length);
      setCards(studyCards);
    } catch (err: any) {
      setError('Erro ao carregar cards. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveSession = async (stats: typeof sessionStats) => {
    if (stats.reviewed === 0) return;
    const studyTimeSecs = activeStartTime ? Math.floor((Date.now() - activeStartTime) / 1000) : 0;

    try {
      await supabase.from('student_sessions').insert({
        student_email: sessionRef.current!.email,
        product_id: sessionRef.current!.product_id!,
        discipline_id: disciplineId !== 'all' ? disciplineId! : null,
        cards_reviewed: stats.reviewed,
        correct: stats.correct,
        incorrect: stats.incorrect,
        study_time_seconds: studyTimeSecs,
      });
    } catch (err) {
      console.error('Erro ao salvar sessão:', err);
    }
  };

  const saveProgressBackground = useCallback(async (card: StudyCard, rating: Rating, correct: boolean, existingCounts: { correct_count: number; incorrect_count: number }) => {
    const s = sessionRef.current;
    if (!s) return;
    const correctStreak = correct ? existingCounts.correct_count : 0;
    const nextReview = calculateNextReview(rating, correctStreak);
    const progressData = {
      card_id: card.id,
      rating,
      reviewed_at: new Date().toISOString(),
      product_id: s.product_id!,
      next_review: nextReview,
      correct_count: correct ? existingCounts.correct_count + 1 : 0,
      incorrect_count: !correct ? existingCounts.incorrect_count + 1 : existingCounts.incorrect_count,
    };

    try {
      await supabase.from('student_progress').upsert({
        student_email: s.email,
        ...progressData,
      }, { onConflict: 'student_email,card_id' });
    } catch (err) {
      console.error('Background save failed:', err);
    }
  }, []);

  const handleRating = useCallback((rating: Rating) => {
    if (transitioningRef.current) return;

    const card = activeCards[activeIndex];
    if (!card || activeRatedIds.has(card.id)) return;

    // Mark as rated immediately
    activeRatedIds.add(card.id);

    transitioningRef.current = true;
    setTransitioning(true);

    const correct = isCorrectRating(rating);
    const cached = activeProgressCache.get(card.id) || { correct_count: 0, incorrect_count: 0 };

    activeProgressCache.set(card.id, {
      correct_count: correct ? cached.correct_count + 1 : 0,
      incorrect_count: !correct ? cached.incorrect_count + 1 : cached.incorrect_count,
    });

    saveProgressBackground(card, rating, correct, cached).catch(err =>
      console.error('Background save error (non-blocking):', err)
    );

    const newStats = {
      reviewed: activeStats.reviewed + 1,
      correct: correct ? activeStats.correct + 1 : activeStats.correct,
      incorrect: !correct ? activeStats.incorrect + 1 : activeStats.incorrect,
    };
    updateStats(newStats);

    const nextIndex = activeIndex + 1;
    const isLastCard = nextIndex >= activeCards.length;

    // Shuffle already applied at session start — no mid-session re-shuffle
    // to avoid React DOM reconciliation errors (removeChild NotFoundError)

    if (isLastCard) {
      saveSession(newStats);
    }

    const direction = correct ? 'right' : 'left';
    setSlideOut(direction);

    advanceTimeoutRef.current = setTimeout(() => {
      setFlipped(false);
      setSlideOut(null);
      setSlideIn(true);
      setCurrentIndex(nextIndex);

      slideInTimeoutRef.current = setTimeout(() => {
        setSlideIn(false);
        transitioningRef.current = false;
        setTransitioning(false);
      }, 50);
    }, 250);
  }, [saveProgressBackground, setCurrentIndex, updateStats]);

  const handleFlip = useCallback(() => {
    if (!flipped) setFlipped(true);
  }, [flipped]);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (direction === 'right') {
      handleRating('facil');
    } else {
      handleRating('errei');
    }
  }, [handleRating]);

  const handleExit = async () => {
    await saveSession(activeStats);
    // Clear module state on intentional exit
    activeSessionKey = null;
    activeCards = [];
    activeLoaded = false;
    navigate('/aluno');
  };

  const handleToggleTimer = useCallback(() => {
    activeTimerRunning = !activeTimerRunning;
    setStopwatchRunning(activeTimerRunning);
    if (navigator.vibrate) navigator.vibrate(10);
  }, []);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <p className="mb-4 text-center text-muted-foreground">{error}</p>
        <button onClick={loadCards} className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 font-display font-semibold text-primary-foreground hover:opacity-90">
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  if (!loading && (cards.length === 0 || currentIndex >= cards.length)) {
    if (sessionStats.reviewed > 0) {
      // Navigation is handled by the end-of-session useEffect above
      return null;
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="text-center">
          <CheckCircle2Icon className="mx-auto mb-4 h-16 w-16 text-secondary" />
          <h1 className="mb-2 font-display text-2xl font-bold text-foreground">Tudo em dia!</h1>
          <p className="mb-6 text-muted-foreground">Não há cards pendentes para revisar agora.</p>
          <button onClick={() => navigate('/aluno')}
            className="rounded-2xl bg-primary px-8 py-3 font-display font-semibold text-primary-foreground transition-all hover:opacity-90">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const progressPercent = totalCardsCount > 0 ? (sessionStats.reviewed / totalCardsCount) * 100 : 0;
  const currentCardNumber = totalCardsCount > 0 ? Math.min(sessionStats.reviewed + 1, totalCardsCount) : 0;

  return (
    <div className="flex h-[100dvh] flex-col bg-background overflow-hidden">
      {/* Progress line */}
      <div className="w-full shrink-0 h-[1px] bg-border">
        <div className="h-full transition-all duration-300 ease-out bg-muted-foreground/30" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* Header */}
      <div className="grid shrink-0 pt-safe items-center px-5 pt-4 pb-2" style={{ gridTemplateColumns: '40px 1fr 40px' }}>
        <button onClick={handleExit} className="justify-self-start p-1 transition-colors active:scale-95 touch-manipulation text-muted-foreground/40">
          <X className="h-5 w-5" />
        </button>

        {/* Timer */}
        <div
          className="justify-self-center flex items-center gap-1.5 select-none cursor-pointer"
          onPointerDown={(e) => {
            const timer = setTimeout(() => {
              handleToggleTimer();
            }, 400);
            const up = () => { clearTimeout(timer); window.removeEventListener('pointerup', up); };
            window.addEventListener('pointerup', up);
          }}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-300 ${stopwatchRunning ? 'bg-secondary study-timer-dot-active' : 'bg-muted-foreground/25'}`}
          />
          <span className={`font-mono text-[15px] font-normal tracking-wide transition-colors duration-300 ${stopwatchRunning ? 'text-foreground/85' : 'text-muted-foreground/40'}`}>
            {formatTime(stopwatchSeconds)}
          </span>
        </div>

        <span className="justify-self-end text-[13px] font-normal text-muted-foreground/35 tracking-tight">
          {currentCardNumber}/{totalCardsCount}
        </span>
      </div>

      {/* Card area */}
      <div className="flex flex-1 items-center justify-center py-2 sm:py-4 min-h-0" style={{ paddingBottom: flipped ? 120 : 0 }}>
        <div
          className="w-full max-w-md mx-auto flex-1 flex items-center relative px-4"
          style={{
            transform: slideOut
              ? `translateX(${slideOut === 'left' ? '-110%' : '110%'})`
              : slideIn
              ? 'translateX(60%)'
              : 'translateX(0)',
            opacity: slideOut ? 0 : slideIn ? 0 : 1,
            transition: slideOut
              ? 'transform 250ms ease-in, opacity 200ms ease-in'
              : slideIn
              ? 'none'
              : 'transform 300ms ease-out, opacity 250ms ease-out',
          }}
        >
          <CardDisplay card={currentCard} flipped={flipped} onFlip={handleFlip} onSwipe={flipped ? handleSwipe : undefined} />
        </div>
      </div>

      {/* Rating buttons */}
      {flipped && <RatingButtons onRate={handleRating} disabled={transitioning} />}

      {/* Feedback popup */}
      {session?.email && session?.product_id && (
        <FeedbackPopup email={session.email} productId={session.product_id} />
      )}
    </div>
  );
};

const CheckCircle2Icon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export default memo(StudySession);
