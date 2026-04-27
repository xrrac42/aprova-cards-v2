export type UserRole = 'admin' | 'mentor' | 'aluno';

export interface Session {
  email: string;
  role: UserRole;
  product_id?: string;
  mentor_id?: string;
  mentor_name?: string;
  access_token?: string; // JWT token for API requests
}

export interface Mentor {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  mentor_password: string;
  created_at: string;
}

export interface Product {
  id: string;
  mentor_id: string;
  name: string;
  access_code: string;
  active: boolean;
  created_at: string;
}

export interface Discipline {
  id: string;
  product_id: string;
  name: string;
  order: number;
  created_at: string;
}

export interface Subject {
  id: string;
  discipline_id: string;
  name: string;
  order: number;
  created_at: string;
}

export interface Card {
  id: string;
  subject_id: string;
  discipline_id: string;
  product_id: string;
  front: string;
  back: string;
  order: number;
  created_at: string;
}

export interface StudentProgress {
  id: string;
  student_email: string;
  card_id: string;
  product_id: string;
  rating: 'errei' | 'dificil' | 'medio' | 'facil';
  next_review: string;
  reviewed_at: string;
  correct_count: number;
  incorrect_count: number;
}

export interface StudentSession {
  id: string;
  student_email: string;
  product_id: string;
  discipline_id: string;
  cards_reviewed: number;
  correct: number;
  incorrect: number;
  session_date: string;
  created_at: string;
}

export type Rating = 'errei' | 'dificil' | 'medio' | 'facil';
