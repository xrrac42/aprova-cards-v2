export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cards: {
        Row: {
          back: string
          created_at: string
          discipline_id: string
          front: string
          id: string
          order: number
          product_id: string
          subject_id: string | null
        }
        Insert: {
          back: string
          created_at?: string
          discipline_id: string
          front: string
          id?: string
          order?: number
          product_id: string
          subject_id?: string | null
        }
        Update: {
          back?: string
          created_at?: string
          discipline_id?: string
          front?: string
          id?: string
          order?: number
          product_id?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplines: {
        Row: {
          created_at: string
          id: string
          name: string
          order: number
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order?: number
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      health_check_exceptions: {
        Row: {
          id: string
          note: string | null
          reference_key: string
          resolved_at: string | null
          resolved_by: string | null
          type: string
        }
        Insert: {
          id?: string
          note?: string | null
          reference_key: string
          resolved_at?: string | null
          resolved_by?: string | null
          type: string
        }
        Update: {
          id?: string
          note?: string | null
          reference_key?: string
          resolved_at?: string | null
          resolved_by?: string | null
          type?: string
        }
        Relationships: []
      }
      mentors: {
        Row: {
          accent_color: string | null
          created_at: string
          email: string | null
          id: string
          kiwify_webhook_token: string | null
          logo_url: string | null
          mentor_password: string
          name: string
          primary_color: string
          secondary_color: string
          slug: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          email?: string | null
          id?: string
          kiwify_webhook_token?: string | null
          logo_url?: string | null
          mentor_password: string
          name: string
          primary_color?: string
          secondary_color?: string
          slug: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          email?: string | null
          id?: string
          kiwify_webhook_token?: string | null
          logo_url?: string | null
          mentor_password?: string
          name?: string
          primary_color?: string
          secondary_color?: string
          slug?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          access_code: string
          active: boolean
          cover_image_url: string | null
          created_at: string
          id: string
          kiwify_product_id: string | null
          mentor_id: string
          name: string
        }
        Insert: {
          access_code: string
          active?: boolean
          cover_image_url?: string | null
          created_at?: string
          id?: string
          kiwify_product_id?: string | null
          mentor_id: string
          name: string
        }
        Update: {
          access_code?: string
          active?: boolean
          cover_image_url?: string | null
          created_at?: string
          id?: string
          kiwify_product_id?: string | null
          mentor_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      student_access: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          inactive_reason: string | null
          product_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id?: string
          inactive_reason?: string | null
          product_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          inactive_reason?: string | null
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_access_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      student_feedback: {
        Row: {
          criado_em: string
          id: string
          mensagem: string
          product_id: string
          student_email: string
          total_cards_epoca: number
        }
        Insert: {
          criado_em?: string
          id?: string
          mensagem: string
          product_id: string
          student_email: string
          total_cards_epoca?: number
        }
        Update: {
          criado_em?: string
          id?: string
          mensagem?: string
          product_id?: string
          student_email?: string
          total_cards_epoca?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_feedback_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      student_progress: {
        Row: {
          card_id: string
          correct_count: number
          id: string
          incorrect_count: number
          next_review: string
          product_id: string
          rating: string
          reviewed_at: string
          student_email: string
        }
        Insert: {
          card_id: string
          correct_count?: number
          id?: string
          incorrect_count?: number
          next_review?: string
          product_id: string
          rating: string
          reviewed_at?: string
          student_email: string
        }
        Update: {
          card_id?: string
          correct_count?: number
          id?: string
          incorrect_count?: number
          next_review?: string
          product_id?: string
          rating?: string
          reviewed_at?: string
          student_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      student_sessions: {
        Row: {
          cards_reviewed: number
          correct: number
          created_at: string
          discipline_id: string | null
          id: string
          incorrect: number
          product_id: string
          session_date: string
          student_email: string
          study_time_seconds: number
        }
        Insert: {
          cards_reviewed?: number
          correct?: number
          created_at?: string
          discipline_id?: string | null
          id?: string
          incorrect?: number
          product_id: string
          session_date?: string
          student_email: string
          study_time_seconds?: number
        }
        Update: {
          cards_reviewed?: number
          correct?: number
          created_at?: string
          discipline_id?: string | null
          id?: string
          incorrect?: number
          product_id?: string
          session_date?: string
          student_email?: string
          study_time_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_sessions_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_sessions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      system_incidents: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          resolved: boolean | null
          severity: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          resolved?: boolean | null
          severity: string
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          resolved?: boolean | null
          severity?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decode_html_entities: { Args: { input_text: string }; Returns: string }
      find_defective_cards: {
        Args: never
        Returns: {
          back: string
          defect_type: string
          discipline_id: string
          front: string
          id: string
          product_id: string
        }[]
      }
      find_duplicate_cards: {
        Args: never
        Returns: {
          discipline_id: string
          front: string
          ids_para_remover: string[]
          quantidade: number
        }[]
      }
      get_mentor_stats: {
        Args: { p_mentor_id: string }
        Returns: {
          cards_reviewed: number
          product_active: boolean
          product_id: string
          product_name: string
          students_today: number
          top_engaged_email: string
          total_students: number
          weekly_avg_cards_per_student: number
        }[]
      }
      get_student_discipline_stats: {
        Args: { p_email: string; p_product_id: string }
        Returns: {
          discipline_id: string
          discipline_name: string
          discipline_order: number
          mastered: number
          new_available: number
          reviews_due: number
          studied: number
          total_cards: number
        }[]
      }
      get_study_cards: {
        Args: {
          p_discipline_id: string
          p_email: string
          p_mode: string
          p_new_limit?: number
          p_product_id: string
        }
        Returns: {
          back: string
          discipline_id: string
          discipline_name: string
          existing_correct_count: number
          existing_incorrect_count: number
          front: string
          id: string
        }[]
      }
      remove_duplicate_cards: { Args: never; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
