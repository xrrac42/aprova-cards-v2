import { useState } from 'react';
import { login, signup, logout } from '@/lib/auth';
import type { Session } from '@/types';

interface LoginError {
  message: string;
}

/**
 * Hook para gerenciar autenticação com Supabase
 * Mantém estado de loading, erro e progresso
 */
export function useAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [progress, setProgress] = useState<string>('');

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    setProgress('');

    try {
      const result = await login(email, password, (message) => {
        setProgress(message);
      });
      setProgress('Login realizado com sucesso!');
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao fazer login';
      setError({ message: errorMsg });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    setProgress('');

    try {
      const result = await signup(email, password, (message) => {
        setProgress(message);
      });
      setProgress('Conta criada com sucesso!');
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao criar conta';
      setError({ message: errorMsg });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await logout();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao fazer logout';
      setError({ message: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    login: handleLogin,
    signup: handleSignup,
    logout: handleLogout,
    isLoading,
    error,
    progress,
  };
}
