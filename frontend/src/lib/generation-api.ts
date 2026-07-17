import type {
  GenerationJobStartResponse,
  GenerationJobStatusResponse,
} from '@/types/ai-generation';

// Plain fetch, no auth header — deliberately not using `httpClient`
// (lib/http-client.ts), which redirects to /login when there's no valid
// Supabase JWT. These admin AI-generation routes are unauthenticated today,
// same as the rest of /admin/... on the backend.
const backendURL = () => import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${backendURL()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data: APIResponse<T> = await res.json();
  if (!res.ok || !data.success || !data.data) {
    throw new Error(data.error || 'Erro na requisição');
  }
  return data.data;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${backendURL()}${path}`);
  const data: APIResponse<T> = await res.json();
  if (!res.ok || !data.success || !data.data) {
    throw new Error(data.error || 'Erro na requisição');
  }
  return data.data;
}

export interface StartGenerationJobPayload {
  context: string;
  limit: number;
  archetype: string;
  preset: string;
  regra_de_ouro: string;
}

export function startGenerationJob(
  disciplineId: string,
  payload: StartGenerationJobPayload
): Promise<GenerationJobStartResponse> {
  return postJSON(`/api/v1/admin/disciplines/${disciplineId}/generation-jobs`, payload);
}

export function fetchGenerationJobStatus(
  disciplineId: string,
  jobId: string
): Promise<GenerationJobStatusResponse> {
  return getJSON(`/api/v1/admin/disciplines/${disciplineId}/generation-jobs/${jobId}`);
}
