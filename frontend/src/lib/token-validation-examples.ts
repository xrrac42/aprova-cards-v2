/**
 * Exemplo de integração da validação de token JWT no frontend
 * Este arquivo mostra como usar o sistema de validação implementado
 */

import { validateToken, refreshToken } from '@/lib/auth';
import { useTokenValidation } from '@/hooks/useTokenValidation';

/**
 * Validação de token de forma síncrona/direta
 * Use quando precisar validar um token imediatamente
 */
export async function validateTokenExample(token: string) {
  try {
    const userData = await validateToken(token);
    console.log('✅ Token válido!');
    console.log('Email:', userData.email);
    console.log('UID:', userData.uid);
    console.log('Expira em:', new Date(userData.expiresAt * 1000).toLocaleString());
    return userData;
  } catch (error) {
    console.error('❌ Token inválido/expirado', error);
    throw error;
  }
}

/**
 * Hook para uso em componentes React
 * Retorna função validate, estado de carregamento e erros
 */
export function TokenValidationComponent() {
  const { validate, refresh, isValidating, error, validatedToken } = useTokenValidation();

  const handleValidateClick = async () => {
    try {
      // Obter token do localStorage ou de onde você armazena
      const token = localStorage.getItem('supabase_token');
      if (!token) {
        console.error('Token não encontrado');
        return;
      }

      const result = await validate(token);
      console.log('Token validado:', result);
    } catch (err) {
      console.error('Erro na validação:', err);
    }
  };

  const handleRefreshClick = async () => {
    try {
      // Obter refresh token
      const refreshTokenValue = localStorage.getItem('supabase_refresh_token');
      if (!refreshTokenValue) {
        console.error('Refresh token não encontrado');
        return;
      }

      const result = await refresh(refreshTokenValue);
      console.log('Token renovado:', result);
      // Armazenar novo token
      localStorage.setItem('supabase_token', result.accessToken);
    } catch (err) {
      console.error('Erro ao renovar:', err);
    }
  };

  return {
    isValidating,
    error,
    validatedToken,
    handleValidateClick,
    handleRefreshClick,
  };
}

/**
 * Interceptor de requisições HTTP para adicionar token automaticamente
 * Use em um cliente HTTP (fetch/axios) para injetar o token em todas as requisições
 */
export function setupTokenInterceptor() {
  return async (config: any) => {
    const token = localStorage.getItem('supabase_token');

    if (token) {
      // Validar token antes de usar
      try {
        await validateToken(token);
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        // Se inválido, tentar renovar
        const refreshTokenValue = localStorage.getItem('supabase_refresh_token');
        if (refreshTokenValue) {
          try {
            const newToken = await refreshToken(refreshTokenValue);
            localStorage.setItem('supabase_token', newToken.accessToken);
            config.headers.Authorization = `Bearer ${newToken.accessToken}`;
          } catch {
            // Redirecionar para login se refresh falhar
            window.location.href = '/login';
          }
        }
      }
    }

    return config;
  };
}

// Re-exportar para facilitar imports
export { validateToken, refreshToken } from '@/lib/auth';
