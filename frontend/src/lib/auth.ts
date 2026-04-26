// REGRA DE NEGÓCIO: O acesso do aluno é controlado pela tabela student_access.
// Um aluno SÓ pode entrar se:
// 1. O access_code existir e estiver ativo na tabela products
// 2. O e-mail estiver cadastrado em student_access com active = true
// Alunos com reembolso ou chargeback têm active = false e não conseguem entrar.
// NUNCA remover essa verificação dupla.

import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@/types";

const SESSION_KEY = "flashcard_session";
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";

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
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ ...session, expires_at: Date.now() + SESSION_TTL_MS }),
  );
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Valida um JWT token do Supabase
 * Retorna os dados do usuário se o token for válido
 * Rejeita com erro 401 se inválido/expirado
 */
export async function validateToken(
  token: string,
): Promise<{ email: string; uid: string; expiresAt: number }> {
  try {
    // Usar a sessão do Supabase para validar o token
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new Error("Token inválido ou expirado");
    }

    return {
      email: data.user.email || "",
      uid: data.user.id,
      expiresAt: data.user.user_metadata?.expires_at || Date.now(),
    };
  } catch (error) {
    throw {
      status: 401,
      message:
        error instanceof Error ? error.message : "Token inválido ou expirado",
    };
  }
}

/**
 * Refresh do token JWT usando a sessão do Supabase
 */
export async function refreshToken(refreshToken: string) {
  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      throw new Error("Não foi possível renovar o token");
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    };
  } catch (error) {
    throw {
      status: 401,
      message: error instanceof Error ? error.message : "Erro ao renovar token",
    };
  }
}

export type LoginProgress = (message: string) => void;

/**
 * Autentica usuário com Supabase Auth
 * Valida credenciais reais contra base de dados do Supabase
 */
export async function login(
  email: string,
  password: string,
  onProgress?: LoginProgress,
): Promise<{
  session: Session;
  redirect: string;
  accessToken: string;
  refreshToken: string;
}> {
  onProgress?.("Autenticando com Supabase...");

  const normalizedEmail = email.toLowerCase().trim();
  const trimmedPassword = password.trim();
  const normalizedCode = trimmedPassword.toUpperCase();

  // 1. Tentar autenticação real com Supabase Auth
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: trimmedPassword,
    });

  // Se falhou, poderia ser mentor ou aluno (verificar lógica antiga)
  if (authError) {
    onProgress?.("Verificando acesso alternativo...");

    // 2. Verificar se é admin via backend Go
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/auth/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password: trimmedPassword,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.data?.token) {
          const session: Session = { email: normalizedEmail, role: "admin" };
          setSession(session);
          return {
            session,
            redirect: "/admin",
            accessToken: data.data.token,
            refreshToken: "",
          };
        }
      }
    } catch {
      // Ignore backend unreachable error
    }

    throw new Error("Email ou senha inválidos.");
  }

  if (!authData.session) {
    throw new Error("Falha ao criar sessão. Tente novamente.");
  }

  const user = authData.session.user;
  const accessToken = authData.session.access_token;
  const refreshTokenValue = authData.session.refresh_token || "";

  // 3.5 Verificar se é admin via API Go (quando Supabase Auth funciona)
  try {
    const adminRes = await fetch(`${BACKEND_URL}/api/v1/auth/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalizedEmail,
        password: trimmedPassword,
      }),
    });
    if (adminRes.ok) {
      const adminData = await adminRes.json();
      if (adminData?.success) {
        const session: Session = {
          email: user.email || normalizedEmail,
          role: "admin",
        };
        setSession(session);
        return {
          session,
          redirect: "/admin",
          accessToken,
          refreshToken: refreshTokenValue,
        };
      }
    }
  } catch {
    // Backend unreachable, continue normal flow
  }

  onProgress?.("Verificando seu perfil...");

  // 4. Verificar role do usuário: verifica se é produto/aluno
  const { data: productResult } = await supabase
    .from("products")
    .select("id, name, mentor_id, access_code")
    .eq("access_code", normalizedCode)
    .eq("active", true)
    .maybeSingle();

  // Check user_roles table to get the correct role
  onProgress?.("Verificando seu perfil...");

  const { data: userRoleResult } = await supabase
    .from("user_roles")
    .select("role, mentor_id, product_id, active")
    .eq("email", user.email)
    .maybeSingle();

  if (!userRoleResult || !userRoleResult.active) {
    throw new Error(
      "Seu acesso foi desativado. Entre em contato com o administrador.",
    );
  }

  const userRole =
    (userRoleResult.role as "aluno" | "mentor" | "admin") || "aluno";
  let redirectPath = "/aluno";
  let sessionMentorId: string | undefined;
  let sessionProductId: string | undefined;

  if (userRole === "admin") {
    redirectPath = "/admin";
  } else if (userRole === "mentor") {
    redirectPath = "/mentor";
    sessionMentorId = userRoleResult.mentor_id || undefined;
  } else if (userRole === "aluno" && productResult) {
    redirectPath = "/aluno";
    sessionProductId = productResult.id;
    sessionMentorId = productResult.mentor_id;
  }

  // Obter dados do mentor se necessário
  let mentorData = null;
  if (sessionMentorId) {
    const { data } = await supabase
      .from("mentors")
      .select("id, name, primary_color, secondary_color, logo_url")
      .eq("id", sessionMentorId)
      .maybeSingle();
    mentorData = data;
  }

  onProgress?.("Carregando seu material...");

  const session: Session = {
    email: user.email || normalizedEmail,
    role: userRole,
    product_id: sessionProductId,
    mentor_id: mentorData?.id,
    mentor_name: mentorData?.name,
  };

  setSession(session);
  return {
    session,
    redirect: redirectPath,
    accessToken,
    refreshToken: refreshTokenValue,
  };
}

/**
 * Registra novo usuário com Supabase Auth
 * Cria user real na base de dados
 */
export async function signup(
  email: string,
  password: string,
  onProgress?: LoginProgress,
): Promise<{ user: any; session: Session }> {
  onProgress?.("Criando conta...");

  const normalizedEmail = email.toLowerCase().trim();

  const { data: signupData, error: signupError } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
  });

  if (signupError) {
    throw new Error(signupError.message);
  }

  if (!signupData.user) {
    throw new Error("Falha ao criar usuário.");
  }

  onProgress?.("Conta criada com sucesso!");

  const session: Session = {
    email: normalizedEmail,
    role: "aluno",
  };

  setSession(session);

  return {
    user: signupData.user,
    session,
  };
}

/**
 * Faz logout do usuário
 * Limpa sessão local e do Supabase
 */
export async function logout(): Promise<void> {
  await supabase.auth.signOut();
  clearSession();
}

/**
 * Obtém sessão atual do Supabase
 */
export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    return null;
  }

  return data.session;
}
