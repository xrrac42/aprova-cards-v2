// REGRA DE NEGÓCIO: O acesso do aluno é controlado pela tabela student_access.
// Um aluno SÓ pode entrar se:
// 1. O access_code existir e estiver ativo na tabela products
// 2. O e-mail estiver cadastrado em student_access com active = true
// Alunos com reembolso ou chargeback têm active = false e não conseguem entrar.
// NUNCA remover essa verificação dupla.

import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@/types';

const SESSION_KEY = 'flashcard_session';
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export function getSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.expires_at && Date.now() > parsed.expires_at) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed as Session;
  } catch {
    return null;
  }
}

export function setSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, expires_at: Date.now() + SESSION_TTL_MS }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export type LoginProgress = (message: string) => void;

export async function login(
  email: string,
  password: string,
  onProgress?: LoginProgress
): Promise<{ session: Session; redirect: string }> {
  onProgress?.('Verificando acesso...');

  // 1. Check admin via edge function (kept for security — password not in client)
  //    but run in PARALLEL with mentor + product queries
  const normalizedEmail = email.toLowerCase().trim();
  const trimmedPassword = password.trim();
  const normalizedCode = trimmedPassword.toUpperCase();

  // 1. Admin — verificação via edge function (usa secrets do servidor)
  const { data: adminCheck } = await supabase.functions.invoke('check-admin', {
    body: { email: normalizedEmail, password: trimmedPassword },
  });

  if (adminCheck?.isAdmin) {
    const session: Session = { email: normalizedEmail, role: 'admin' };
    setSession(session);
    return { session, redirect: '/admin' };
  }

  // 2. Mentor + Produto em paralelo (apenas 2 queries)
  const [mentorResult, productResult] = await Promise.all([
    supabase
      .from('mentors')
      .select('id, name')
      .eq('email', normalizedEmail)
      .eq('mentor_password', trimmedPassword)
      .maybeSingle(),
    supabase
      .from('products')
      .select('id, name, mentor_id')
      .eq('access_code', normalizedCode)
      .eq('active', true)
      .maybeSingle(),
  ]);

  // 3. Mentor?
  if (mentorResult.data) {
    const mentor = mentorResult.data;
    const session: Session = { email: normalizedEmail, role: 'mentor', mentor_id: mentor.id, mentor_name: mentor.name };
    setSession(session);
    return { session, redirect: '/mentor' };
  }

  // 4. Product found? → verify student access
  const product = productResult.data;
  if (!product) {
    throw new Error('Código de acesso inválido.');
  }

  onProgress?.('Verificando seu acesso...');

  // Run student access check + mentor visual data in parallel
  const [accessResult, mentorDataResult] = await Promise.all([
    supabase
      .from('student_access')
      .select('id, active')
      .eq('email', normalizedEmail)
      .eq('product_id', product.id)
      .maybeSingle(),
    supabase
      .from('mentors')
      .select('id, name, primary_color, secondary_color, logo_url')
      .eq('id', product.mentor_id)
      .maybeSingle(),
  ]);

  const access = accessResult.data;
  if (!access) {
    throw new Error('E-mail não encontrado. Verifique se usou o e-mail da compra.');
  }
  if (!access.active) {
    throw new Error('Seu acesso foi cancelado. Entre em contato com o mentor.');
  }

  onProgress?.('Carregando seu material...');

  const mentorData = mentorDataResult.data;
  const session: Session = {
    email: normalizedEmail,
    role: 'aluno',
    product_id: product.id,
    mentor_id: mentorData?.id,
    mentor_name: mentorData?.name,
  };
  setSession(session);
  return { session, redirect: '/aluno' };
}
