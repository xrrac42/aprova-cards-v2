export type GenerationJobStatus =
  | 'pending'
  | 'processing'
  | 'reducing'
  | 'reviewing'
  | 'completed'
  | 'failed';

export interface GenerationJobStartResponse {
  job_id: string;
  status: GenerationJobStatus;
  total_chunks: number;
}

export interface GeneratedCardResult {
  id: string;
  front: string;
  back: string;
  topic_tags: string[];
  difficulty: string;
}

export interface GenerationJobStatusResponse {
  job_id: string;
  status: GenerationJobStatus;
  total_chunks: number;
  completed_chunks: number;
  progress_pct: number;
  error?: string;
  result?: {
    cards: GeneratedCardResult[];
    generated: number;
  };
}
