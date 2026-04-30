/**
 * 🧪 Teste de Login com Toast
 * 
 * Execute no console do navegador para testar o login com a senha teste@teste.com
 */

console.log(`
╔════════════════════════════════════════════════════════════════╗
║         🧪 TESTE DE LOGIN COM SUPABASE                        ║
║                                                                ║
║ Para testar o login com popup de sucesso, execute:           ║
║                                                                ║
║ import('./test/auth-test').then(m =>                          ║
║   m.quickAuthTest('teste@teste.com', 'SUA_SENHA_AQUI')       ║
║ )                                                              ║
║                                                                ║
║ Ou se você criou a conta manualmente:                         ║
║                                                                ║
║ import('./lib/auth').then(m =>                                ║
║   m.login('teste@teste.com', 'sua_senha', (msg) => {         ║
║     console.log('⏳', msg)                                    ║
║   }).then(result => {                                         ║
║     console.log('✅ LOGIN BEM-SUCEDIDO!')                    ║
║     console.log('Session:', result.session)                   ║
║     console.log('Token:', result.accessToken.substring(0,50)) ║
║   }).catch(err => {                                           ║
║     console.error('❌ ERRO:', err.message)                   ║
║   })                                                           ║
║ )                                                              ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`);
