import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession, clearSession } from '@/lib/auth';

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useAccessGuard() {
  const navigate = useNavigate();

  useEffect(() => {
    const verificarAcesso = async () => {
      const session = getSession();
      if (!session || session.role !== 'aluno' || !session.email || !session.product_id) return;

      const { data: access, error } = await supabase
        .from('student_access')
        .select('active')
        .eq('email', session.email)
        .eq('product_id', session.product_id)
        .maybeSingle();

      if (!error && (!access || !access.active)) {
        clearSession();
        navigate('/login', { replace: true });
      }
    };

    setTimeout(verificarAcesso, 100);
    const interval = setInterval(verificarAcesso, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);
}
