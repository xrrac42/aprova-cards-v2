/**
 * 🧪 Teste de Autenticação
 * 
 * Copie e cole este código no console do navegador ou execute via npm test
 * Para testar o login com Supabase
 */

import { supabase } from '@/integrations/supabase/client';
import { login, validateToken } from '@/lib/auth';

/**
 * Teste 1: Verificar se Supabase está conectado
 */
export async function testSupabaseConnection() {
  console.log('🔍 Teste 1: Verificando conexão com Supabase...');
  
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Erro ao conectar:', error.message);
      return false;
    }
    
    console.log('✅ Supabase conectado com sucesso!');
    console.log('📊 Sessão atual:', data);
    return true;
  } catch (err) {
    console.error('❌ Erro inesperado:', err);
    return false;
  }
}

/**
 * Teste 2: Criar novo usuário de teste
 */
export async function testSignup() {
  console.log('\n🔍 Teste 2: Criando novo usuário...');
  
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });
    
    if (error) {
      console.error('❌ Erro ao criar usuário:', error.message);
      return null;
    }
    
    console.log('✅ Usuário criado com sucesso!');
    console.log('📧 Email:', testEmail);
    console.log('🔑 Senha:', testPassword);
    console.log('👤 User ID:', data.user?.id);
    console.log('📊 Dados:', data);
    
    return { email: testEmail, password: testPassword, user: data.user };
  } catch (err) {
    console.error('❌ Erro inesperado:', err);
    return null;
  }
}

/**
 * Teste 3: Fazer login
 */
export async function testLogin(email: string, password: string) {
  console.log('\n🔍 Teste 3: Fazendo login...');
  console.log(`📧 Email: ${email}`);
  
  try {
    const result = await login(email, password, (progress) => {
      console.log(`⏳ ${progress}`);
    });
    
    console.log('✅ Login bem-sucedido!');
    console.log('🔑 Session:', result.session);
    console.log('🚀 Redirect:', result.redirect);
    console.log('🎫 Access Token:', result.accessToken.substring(0, 50) + '...');
    console.log('🔄 Refresh Token:', result.refreshToken.substring(0, 50) + '...');
    
    return result;
  } catch (err) {
    console.error('❌ Erro no login:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Teste 4: Validar token
 */
export async function testValidateToken(token: string) {
  console.log('\n🔍 Teste 4: Validando token...');
  
  try {
    const userData = await validateToken(token);
    
    console.log('✅ Token válido!');
    console.log('📧 Email:', userData.email);
    console.log('🆔 UID:', userData.uid);
    console.log('⏱️ Expira em:', new Date(userData.expiresAt * 1000).toLocaleString());
    
    return userData;
  } catch (err) {
    console.error('❌ Erro ao validar token:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Teste completo: Signup → Login → Validate
 */
export async function runFullAuthTest() {
  console.clear();
  console.log('========================================');
  console.log('   🔐 TESTE COMPLETO DE AUTENTICAÇÃO');
  console.log('========================================\n');
  
  // Teste 1: Conexão
  const connected = await testSupabaseConnection();
  if (!connected) {
    console.error('❌ Falha na conexão com Supabase. Verifique .env.local');
    return;
  }
  
  // Teste 2: Signup
  const newUser = await testSignup();
  if (!newUser) {
    console.error('❌ Falha ao criar usuário');
    return;
  }
  
  // Teste 3: Login
  const loginResult = await testLogin(newUser.email, newUser.password);
  if (!loginResult) {
    console.error('❌ Falha no login');
    return;
  }
  
  // Teste 4: Validar token
  await testValidateToken(loginResult.accessToken);
  
  console.log('\n========================================');
  console.log('   ✅ TODOS OS TESTES PASSARAM!');
  console.log('========================================\n');
  
  return {
    user: newUser,
    loginResult,
  };
}

/**
 * Teste rápido com credenciais existentes
 */
export async function quickAuthTest(email: string, password: string) {
  console.clear();
  console.log('⚡ TESTE RÁPIDO DE LOGIN\n');
  
  const result = await testLogin(email, password);
  
  if (result) {
    console.log('\n✅ Login bem-sucedido!');
    console.log('📋 Resumo:');
    console.log(`  - Email: ${result.session.email}`);
    console.log(`  - Role: ${result.session.role}`);
    console.log(`  - Redirect: ${result.redirect}`);
    console.log(`  - Token válido por: ~1 hora`);
  }
  
  return result;
}

// ============================================
// INSTRUÇÕES DE USO
// ============================================
/**
 * 
 * No console do navegador (F12 → Console), execute:
 * 
 * 1️⃣ Teste completo (cria usuário, loga e valida):
 *    import('./test/auth-test').then(m => m.runFullAuthTest())
 * 
 * 2️⃣ Teste rápido com email/senha existentes:
 *    import('./test/auth-test').then(m => m.quickAuthTest('seu@email.com', 'senha'))
 * 
 * 3️⃣ Verificar conexão Supabase:
 *    import('./test/auth-test').then(m => m.testSupabaseConnection())
 * 
 * 4️⃣ Criar novo usuário:
 *    import('./test/auth-test').then(m => m.testSignup())
 * 
 * 5️⃣ Fazer login:
 *    import('./test/auth-test').then(m => m.testLogin('email@test.com', 'senha'))
 * 
 * 6️⃣ Validar token:
 *    import('./test/auth-test').then(m => m.testValidateToken('seu-token-aqui'))
 * 
 */
