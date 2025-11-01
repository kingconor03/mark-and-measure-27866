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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      annotations: {
        Row: {
          created_at: string
          created_by: string
          data: Json
          id: string
          page_index: number
          project_id: string
          type: Database["public"]["Enums"]["annotation_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          data?: Json
          id?: string
          page_index: number
          project_id: string
          type: Database["public"]["Enums"]["annotation_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          data?: Json
          id?: string
          page_index?: number
          project_id?: string
          type?: Database["public"]["Enums"]["annotation_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      certification_files: {
        Row: {
          certification_request_id: string
          created_at: string
          folder: Database["public"]["Enums"]["cert_folder"]
          id: string
          meta: Json | null
          path: string
        }
        Insert: {
          certification_request_id: string
          created_at?: string
          folder: Database["public"]["Enums"]["cert_folder"]
          id?: string
          meta?: Json | null
          path: string
        }
        Update: {
          certification_request_id?: string
          created_at?: string
          folder?: Database["public"]["Enums"]["cert_folder"]
          id?: string
          meta?: Json | null
          path?: string
        }
        Relationships: [
          {
            foreignKeyName: "certification_files_certification_request_id_fkey"
            columns: ["certification_request_id"]
            isOneToOne: false
            referencedRelation: "certification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      certification_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          organisation_id: string
          project_id: string
          result_files: Json | null
          status: Database["public"]["Enums"]["certification_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          organisation_id: string
          project_id: string
          result_files?: Json | null
          status?: Database["public"]["Enums"]["certification_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          organisation_id?: string
          project_id?: string
          result_files?: Json | null
          status?: Database["public"]["Enums"]["certification_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certification_requests_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certification_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      floating_summary_preferences: {
        Row: {
          created_at: string
          heading_size: number
          id: string
          key_size: number
          scale: number
          text_size: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          heading_size?: number
          id?: string
          key_size?: number
          scale?: number
          text_size?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          heading_size?: number
          id?: string
          key_size?: number
          scale?: number
          text_size?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      footings: {
        Row: {
          color: string | null
          coordinates: Json
          created_at: string | null
          depth: string | null
          footing_type: string
          id: string
          page_id: string
          shape: string
          width: string | null
        }
        Insert: {
          color?: string | null
          coordinates: Json
          created_at?: string | null
          depth?: string | null
          footing_type: string
          id?: string
          page_id: string
          shape: string
          width?: string | null
        }
        Update: {
          color?: string | null
          coordinates?: Json
          created_at?: string | null
          depth?: string | null
          footing_type?: string
          id?: string
          page_id?: string
          shape?: string
          width?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "footings_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          organisation_id: string
          payload: Json
          read_at: string | null
          to_user_id: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          organisation_id: string
          payload?: Json
          read_at?: string | null
          to_user_id?: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          created_at?: string
          id?: string
          organisation_id?: string
          payload?: Json
          read_at?: string | null
          to_user_id?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_members: {
        Row: {
          created_at: string
          id: string
          organisation_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organisation_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organisation_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          domains: string[]
          id: string
          name: string
          primary_domain: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domains?: string[]
          id?: string
          name: string
          primary_domain: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domains?: string[]
          id?: string
          name?: string
          primary_domain?: string
          updated_at?: string
        }
        Relationships: []
      }
      pages: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          page_number: number
          project_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          page_number: number
          project_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          page_number?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      piles: {
        Row: {
          blade_size: string
          color: string | null
          created_at: string | null
          extension: string | null
          id: string
          is_custom: boolean | null
          length: string
          min_depth: string | null
          min_torque: string | null
          number: number | null
          page_id: string
          pile_type: string
          position_x: number
          position_y: number
          radius: number | null
        }
        Insert: {
          blade_size: string
          color?: string | null
          created_at?: string | null
          extension?: string | null
          id?: string
          is_custom?: boolean | null
          length: string
          min_depth?: string | null
          min_torque?: string | null
          number?: number | null
          page_id: string
          pile_type: string
          position_x: number
          position_y: number
          radius?: number | null
        }
        Update: {
          blade_size?: string
          color?: string | null
          created_at?: string | null
          extension?: string | null
          id?: string
          is_custom?: boolean | null
          length?: string
          min_depth?: string | null
          min_torque?: string | null
          number?: number | null
          page_id?: string
          pile_type?: string
          position_x?: number
          position_y?: number
          radius?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "piles_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      project_assets: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["asset_kind"]
          meta: Json | null
          path: string
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["asset_kind"]
          meta?: Json | null
          path: string
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          meta?: Json | null
          path?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          organisation_id: string | null
          pdf_url: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          organisation_id?: string | null
          pdf_url?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          organisation_id?: string | null
          pdf_url?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_request_files: {
        Row: {
          created_at: string
          folder: Database["public"]["Enums"]["quote_folder"]
          id: string
          meta: Json | null
          path: string
          quote_request_id: string
        }
        Insert: {
          created_at?: string
          folder: Database["public"]["Enums"]["quote_folder"]
          id?: string
          meta?: Json | null
          path: string
          quote_request_id: string
        }
        Update: {
          created_at?: string
          folder?: Database["public"]["Enums"]["quote_folder"]
          id?: string
          meta?: Json | null
          path?: string
          quote_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_request_files_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          organisation_id: string
          project_id: string | null
          status: Database["public"]["Enums"]["quote_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          organisation_id: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          organisation_id?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organisation_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organisation_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organisation_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_count: { Args: { p_org: string }; Returns: number }
      has_role_in_org: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      platform_org_id: { Args: never; Returns: string }
      user_org_ids: {
        Args: { _user_id: string }
        Returns: {
          organisation_id: string
        }[]
      }
    }
    Enums: {
      annotation_type: "pile" | "footing"
      app_role: "admin" | "member" | "viewer"
      asset_kind: "pdf" | "page_image" | "other"
      cert_folder:
        | "install_report"
        | "latest_plans"
        | "soil_report"
        | "architectural"
        | "engineering"
        | "other"
      certification_status:
        | "new"
        | "awaiting_docs"
        | "in_progress"
        | "approved"
        | "rejected"
      notification_type:
        | "quote_status_change"
        | "cert_status_change"
        | "org_invite"
        | "role_change"
        | "other"
      quote_folder: "soil_report" | "architectural" | "engineering" | "other"
      quote_status:
        | "new"
        | "awaiting_docs"
        | "in_progress"
        | "completed"
        | "rejected"
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
    Enums: {
      annotation_type: ["pile", "footing"],
      app_role: ["admin", "member", "viewer"],
      asset_kind: ["pdf", "page_image", "other"],
      cert_folder: [
        "install_report",
        "latest_plans",
        "soil_report",
        "architectural",
        "engineering",
        "other",
      ],
      certification_status: [
        "new",
        "awaiting_docs",
        "in_progress",
        "approved",
        "rejected",
      ],
      notification_type: [
        "quote_status_change",
        "cert_status_change",
        "org_invite",
        "role_change",
        "other",
      ],
      quote_folder: ["soil_report", "architectural", "engineering", "other"],
      quote_status: [
        "new",
        "awaiting_docs",
        "in_progress",
        "completed",
        "rejected",
      ],
    },
  },
} as const
