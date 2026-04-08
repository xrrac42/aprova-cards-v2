import { useState } from 'react';
import { validateToken, refreshToken } from '@/lib/auth';

interface ValidatedToken {
  email: string;
  uid: string;
  expiresAt: number;
}

interface TokenValidationError {
  status: number;
  message: string;
}

/**
 * Hook para validar e gerenciar tokens JWT do Supabase
 * Retorna dados do usuário se válido, error se inválido/expirado
 */
export function useTokenValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<TokenValidationError | null>(null);
  const [validatedToken, setValidatedToken] = useState<ValidatedToken | null>(null);

  const validate = async (token: string) => {
    setIsValidating(true);
    setError(null);
    try {
      const result = await validateToken(token);
      setValidatedToken(result);
      return result;
    } catch (err) {
      const tokenError = err as TokenValidationError;
      setError(tokenError);
      throw tokenError;
    } finally {
      setIsValidating(false);
    }
  };

  const refresh = async (refreshTokenValue: string) => {
    setIsValidating(true);
    setError(null);
    try {
      const result = await refreshToken(refreshTokenValue);
      return result;
    } catch (err) {
      const tokenError = err as TokenValidationError;
      setError(tokenError);
      throw tokenError;
    } finally {
      setIsValidating(false);
    }
  };

  return {
    validate,
    refresh,
    isValidating,
    error,
    validatedToken,
  };
}
