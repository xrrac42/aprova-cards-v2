/**
 * Cliente HTTP com autenticação automática via tokens JWT
 * Injeta token em todas as requisições e faz refresh automático se expirado
 */

import { validateToken, refreshToken as refreshTokenFn } from '@/lib/auth';

interface RequestConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
}

interface HttpResponse<T = any> {
  status: number;
  data: T;
  error?: string;
}

/**
 * Cliente HTTP singleton com gerenciamento de tokens
 */
class AuthenticatedHttpClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    this.loadTokens();
  }

  /**
   * Carrega tokens do localStorage
   */
  private loadTokens() {
    this.accessToken = localStorage.getItem('supabase_access_token');
    this.refreshToken = localStorage.getItem('supabase_refresh_token');
  }

  /**
   * Armazena tokens no localStorage
   */
  private saveTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('supabase_access_token', accessToken);
    localStorage.setItem('supabase_refresh_token', refreshToken);
  }

  /**
   * Limpa tokens (logout)
   */
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('supabase_access_token');
    localStorage.removeItem('supabase_refresh_token');
  }

  /**
   * Renova token usando refresh token
   * Evita múltiplas requisições simultâneas de refresh
   */
  private async refreshAccessToken(): Promise<string | null> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    if (!this.refreshToken) {
      this.redirectToLogin('Sessão expirada');
      return null;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const result = await refreshTokenFn(this.refreshToken!);
        this.saveTokens(result.accessToken, result.refreshToken);
        return result.accessToken;
      } catch (error) {
        this.redirectToLogin('Não foi possível renovar a sessão');
        return null;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Valida token e o renova se necessário
   */
  private async ensureValidToken(): Promise<string | null> {
    if (!this.accessToken) {
      this.redirectToLogin('Não há sessão ativa');
      return null;
    }

    try {
      // Tenta validar o token atual
      await validateToken(this.accessToken);
      return this.accessToken;
    } catch (error) {
      // Token inválido/expirado, tentar renovar
      const newToken = await this.refreshAccessToken();
      return newToken;
    }
  }

  /**
   * Redireciona para login
   */
  private redirectToLogin(reason: string) {
    console.warn(`Redirecionando para login: ${reason}`);
    this.clearTokens();
    window.location.href = '/login';
  }

  /**
   * Faz requisição HTTP com token automático
   */
  async request<T = any>(config: RequestConfig): Promise<HttpResponse<T>> {
    const { url, method = 'GET', body, headers = {} } = config;

    // Garantir token válido
    const token = await this.ensureValidToken();
    if (!token) {
      return {
        status: 401,
        data: null as any,
        error: 'Não autorizado',
      };
    }

    // Preparar headers com token
    const finalHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...headers,
    };

    try {
      const response = await fetch(url, {
        method,
        headers: finalHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        // Se 401, pode ser token inválido
        if (response.status === 401) {
          const newToken = await this.refreshAccessToken();
          if (newToken) {
            // Retry com novo token
            return this.request(config);
          }
        }

        return {
          status: response.status,
          data: null as any,
          error: data.error || response.statusText,
        };
      }

      return {
        status: response.status,
        data,
      };
    } catch (error) {
      return {
        status: 0,
        data: null as any,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  // Métodos convenientes
  async get<T = any>(url: string, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'GET', headers });
  }

  async post<T = any>(url: string, body?: any, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'POST', body, headers });
  }

  async put<T = any>(url: string, body?: any, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'PUT', body, headers });
  }

  async patch<T = any>(url: string, body?: any, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'PATCH', body, headers });
  }

  async delete<T = any>(url: string, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'DELETE', headers });
  }
}

// Exportar singleton
export const httpClient = new AuthenticatedHttpClient();

/**
 * Exemplo de uso em um arquivo de API
 */
export class SampleAPI {
  private base = 'http://localhost:8000/api/v1';

  async getSamples(page = 1, pageSize = 10) {
    return httpClient.get(`${this.base}/samples?page=${page}&page_size=${pageSize}`);
  }

  async getSample(id: string) {
    return httpClient.get(`${this.base}/samples/${id}`);
  }

  async createSample(name: string, email: string) {
    return httpClient.post(`${this.base}/samples`, { name, email });
  }

  async updateSample(id: string, data: any) {
    return httpClient.put(`${this.base}/samples/${id}`, data);
  }

  async deleteSample(id: string) {
    return httpClient.delete(`${this.base}/samples/${id}`);
  }
}

/**
 * Exemplo de uso em componente
 */
export async function exampleUsage() {
  const api = new SampleAPI();

  // GET com autenticação automática
  const { status, data, error } = await api.getSamples();
  if (status === 200) {
    console.log('Samples:', data);
  } else {
    console.error('Erro:', error);
  }

  // POST com autenticação automática
  const createResult = await api.createSample('John Doe', 'john@example.com');
  if (createResult.status === 200) {
    console.log('Amostra criada:', createResult.data);
  }

  // Se o token expirar durante a requisição, será renovado automaticamente
  // Se o refresh token expirar, usuário será redirecionado para /login
}
