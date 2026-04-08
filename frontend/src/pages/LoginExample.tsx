/**
 * Exemplo de implementação de página de Login com Supabase Auth Real
 * 
 * Este arquivo mostra como usar o novo sistema de autenticação
 * que cria usuários reais na base de dados do Supabase
 */

import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

/**
 * Página de Login - Exemplo
 * Autentica usuário contra Supabase Auth
 */
export function LoginPageExample() {
  const navigate = useNavigate();
  const { login, isLoading, error, progress } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await login(email, password);
      // Redirecionar baseado no role
      navigate(result.redirect);
    } catch (err) {
      // Erro já é capturado pelo hook
      console.error('Erro no login:', err);
    }
  };

  return (
    <div className="login-container">
      <h1>Entrar</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            disabled={isLoading}
            required
          />
        </div>

        <div>
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Sua senha"
            disabled={isLoading}
            required
          />
        </div>

        {/* Mostrar progresso durante o login */}
        {progress && <p className="progress">{progress}</p>}

        {/* Mostrar erros */}
        {error && <p className="error">{error.message}</p>}

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Autenticando...' : 'Entrar'}
        </button>
      </form>

      <p>
        Não tem conta? <a href="/signup">Crie uma aqui</a>
      </p>
    </div>
  );
}

/**
 * Página de Signup - Exemplo
 * Cria novo usuário no Supabase Auth
 */
export function SignupPageExample() {
  const navigate = useNavigate();
  const { signup, isLoading, error, progress } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert('As senhas não coincidem');
      return;
    }

    try {
      const result = await signup(email, password);
      // Após criar conta, redirecionar para login ou dashboard
      navigate('/login');
    } catch (err) {
      console.error('Erro ao criar conta:', err);
    }
  };

  return (
    <div className="signup-container">
      <h1>Criar Conta</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            disabled={isLoading}
            required
          />
        </div>

        <div>
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Sua senha"
            disabled={isLoading}
            required
          />
        </div>

        <div>
          <label htmlFor="confirmPassword">Confirmar Senha</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirme sua senha"
            disabled={isLoading}
            required
          />
        </div>

        {progress && <p className="progress">{progress}</p>}
        {error && <p className="error">{error.message}</p>}

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Criando conta...' : 'Criar Conta'}
        </button>
      </form>

      <p>
        Já tem conta? <a href="/login">Faça login aqui</a>
      </p>
    </div>
  );
}

/**
 * Exemplo de uso do hook useAuth em um componente customizado
 */
export function CustomLoginComponent() {
  const { login, logout, isLoading, error, progress } = useAuth();

  return (
    <div>
      <button 
        onClick={() => login('user@example.com', 'password123')}
        disabled={isLoading}
      >
        {isLoading ? 'Carregando...' : 'Login Rápido'}
      </button>

      <button onClick={logout} disabled={isLoading}>
        Logout
      </button>

      {progress && <div>{progress}</div>}
      {error && <div style={{ color: 'red' }}>{error.message}</div>}
    </div>
  );
}
