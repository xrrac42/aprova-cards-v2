import { useEffect, useState } from 'react';
import { fetchGenerationJobStatus } from '@/lib/generation-api';
import type { GenerationJobStatusResponse } from '@/types/ai-generation';

const TERMINAL_STATUSES = new Set(['completed', 'failed']);

// Self-scheduling setTimeout loop (not setInterval) so a slow response never
// causes overlapping in-flight requests. Stops once the job reaches a
// terminal status, or when jobId becomes null.
export function useGenerationJobPolling(
  disciplineId: string | null,
  jobId: string | null,
  intervalMs = 2000
) {
  const [status, setStatus] = useState<GenerationJobStatusResponse | null>(null);

  useEffect(() => {
    setStatus(null);
    if (!disciplineId || !jobId) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const result = await fetchGenerationJobStatus(disciplineId, jobId);
        if (cancelled) return;
        setStatus(result);
        if (!TERMINAL_STATUSES.has(result.status)) {
          timeoutId = setTimeout(poll, intervalMs);
        }
      } catch {
        if (cancelled) return;
        // Transient network/status-check failure — keep polling rather than
        // giving up on the whole job over one flaky request.
        timeoutId = setTimeout(poll, intervalMs);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [disciplineId, jobId, intervalMs]);

  return { status };
}
