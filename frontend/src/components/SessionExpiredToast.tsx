import { useEffect } from 'react';
import { toast } from 'sonner';

export function SessionExpiredToast() {
  useEffect(() => {
    const handler = (e: Event) => {
      const { loginUrl } = (e as CustomEvent).detail;
      toast.error('Sua sessão expirou', {
        description: (
          <span>
            Faça{' '}
            <a 
              href={loginUrl} 
              className="underline font-semibold text-white"
            >
              login novamente
            </a>
            {' '}para continuar.
          </span>
        ),
        duration: 3000,
      });
    };
    window.addEventListener('session-expired', handler);
    return () => window.removeEventListener('session-expired', handler);
  }, []);

  return null;
}