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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      user_games: {
        Row: {
          completed_at: string | null
          completed_date_unknown: boolean
          hours_played: number | null
          cover_url: string | null
          created_at: string
          genres: string[]
          id: string
          name: string
          notes: string | null
          platforms: string[]
          played_on: string | null
          rating: number | null
          rawg_id: number
          release_year: number | null
          status: Database["public"]["Enums"]["game_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_date_unknown?: boolean
          hours_played?: number | null
          cover_url?: string | null
          created_at?: string
          genres?: string[]
          id?: string
          name: string
          notes?: string | null
          platforms?: string[]
          played_on?: string | null
          rating?: number | null
          rawg_id: number
          release_year?: number | null
          status?: Database["public"]["Enums"]["game_status"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          completed_date_unknown?: boolean
          hours_played?: number | null
          cover_url?: string | null
          created_at?: string
          genres?: string[]
          id?: string
          name?: string
          notes?: string | null
          platforms?: string[]
          played_on?: string | null
          rating?: number | null
          rawg_id?: number
          release_year?: number | null
          status?: Database["public"]["Enums"]["game_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          avatar_updated_at: string | null
          created_at: string
          nickname: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_path?: string | null
          avatar_updated_at?: string | null
          created_at?: string
          nickname: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          avatar_path?: string | null
          avatar_updated_at?: string | null
          created_at?: string
          nickname?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_badges: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          name: string
          description: string
          icon: string
          tier: string
          threshold: number
          progress: number
          earned_at: string | null
        }[]
      }
      get_profile: {
        Args: { p_nickname: string }
        Returns: {
          nickname: string
          avatar_path: string | null
          avatar_updated_at: string | null
          member_since: string
          completed_total: number
          hours_total: number
          library_total: number
          badges_total: number
          is_me: boolean
        }[]
      }
      get_profile_badges: {
        Args: { p_nickname: string }
        Returns: {
          id: string
          name: string
          description: string
          icon: string
          tier: string
          earned_at: string
        }[]
      }
      get_profile_recent: {
        Args: { p_nickname: string }
        Returns: {
          rawg_id: number
          name: string
          cover_url: string | null
          completed_at: string | null
        }[]
      }
      get_ranking: {
        Args: { p_year: number }
        Returns: {
          nickname: string
          avatar_path: string | null
          avatar_updated_at: string | null
          completed_total: number
          completed_year: number
          library_total: number
          is_me: boolean
        }[]
      }
      nickname_available: {
        Args: { p_nickname: string }
        Returns: boolean
      }
    }
    Enums: {
      game_status: "concluido" | "jogando" | "quero_jogar" | "abandonado"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      game_status: ["concluido", "jogando", "quero_jogar", "abandonado"],
    },
  },
} as const
