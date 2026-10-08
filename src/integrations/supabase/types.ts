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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_logs: {
        Row: {
          app: string
          app_version: string | null
          created_at: string
          details: Json | null
          device_info: string | null
          event: string
          id: number
          level: string
          message: string | null
          reservation_code: string | null
        }
        Insert: {
          app: string
          app_version?: string | null
          created_at?: string
          details?: Json | null
          device_info?: string | null
          event: string
          id?: never
          level?: string
          message?: string | null
          reservation_code?: string | null
        }
        Update: {
          app?: string
          app_version?: string | null
          created_at?: string
          details?: Json | null
          device_info?: string | null
          event?: string
          id?: never
          level?: string
          message?: string | null
          reservation_code?: string | null
        }
        Relationships: []
      }
      build_assets: {
        Row: {
          content_base64: string
          created_at: string
          name: string
          sha256: string | null
          updated_at: string
        }
        Insert: {
          content_base64: string
          created_at?: string
          name: string
          sha256?: string | null
          updated_at?: string
        }
        Update: {
          content_base64?: string
          created_at?: string
          name?: string
          sha256?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_sessions: {
        Row: {
          active: boolean
          created_at: string
          customer_id: string
          device_label: string | null
          expires_at: string
          id: string
          last_seen_at: string
          token_hash: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_id: string
          device_label?: string | null
          expires_at?: string
          id?: string
          last_seen_at?: string
          token_hash: string
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_id?: string
          device_label?: string | null
          expires_at?: string
          id?: string
          last_seen_at?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          phone_display: string
          phone_normalized: string
          pin_hash: string
          pin_salt: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          id?: string
          phone_display: string
          phone_normalized: string
          pin_hash: string
          pin_salt?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          phone_display?: string
          phone_normalized?: string
          pin_hash?: string
          pin_salt?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      driver_access: {
        Row: {
          active: boolean
          created_at: string
          full_name: string | null
          pin_hash: string
          singleton_id: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name?: string | null
          pin_hash: string
          singleton_id?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string | null
          pin_hash?: string
          singleton_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_availability_settings: {
        Row: {
          active_weekdays: number[]
          buffer_after_min: number
          buffer_before_min: number
          day_end: string
          day_start: string
          default_trip_min: number
          enabled: boolean
          lead_time_min: number
          pending_hold_min: number
          singleton_id: number
          slot_interval_min: number
          updated_at: string
        }
        Insert: {
          active_weekdays?: number[]
          buffer_after_min?: number
          buffer_before_min?: number
          day_end?: string
          day_start?: string
          default_trip_min?: number
          enabled?: boolean
          lead_time_min?: number
          pending_hold_min?: number
          singleton_id?: number
          slot_interval_min?: number
          updated_at?: string
        }
        Update: {
          active_weekdays?: number[]
          buffer_after_min?: number
          buffer_before_min?: number
          day_end?: string
          day_start?: string
          default_trip_min?: number
          enabled?: boolean
          lead_time_min?: number
          pending_hold_min?: number
          singleton_id?: number
          slot_interval_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_schedule_blocks: {
        Row: {
          block_date: string
          created_at: string
          end_time: string
          id: string
          note: string | null
          start_time: string
        }
        Insert: {
          block_date: string
          created_at?: string
          end_time: string
          id?: string
          note?: string | null
          start_time: string
        }
        Update: {
          block_date?: string
          created_at?: string
          end_time?: string
          id?: string
          note?: string | null
          start_time?: string
        }
        Relationships: []
      }
      driver_settings: {
        Row: {
          default_toll_unit_value: number
          singleton_id: number
          updated_at: string
        }
        Insert: {
          default_toll_unit_value?: number
          singleton_id?: number
          updated_at?: string
        }
        Update: {
          default_toll_unit_value?: number
          singleton_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          driver_id: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          driver_id: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          driver_id?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_events: {
        Row: {
          actor: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["reservation_status"] | null
          id: string
          note: string | null
          reservation_id: string
          to_status: Database["public"]["Enums"]["reservation_status"]
        }
        Insert: {
          actor?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["reservation_status"] | null
          id?: string
          note?: string | null
          reservation_id: string
          to_status: Database["public"]["Enums"]["reservation_status"]
        }
        Update: {
          actor?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["reservation_status"] | null
          id?: string
          note?: string | null
          reservation_id?: string
          to_status?: Database["public"]["Enums"]["reservation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reservation_events_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          code: string
          comments: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          destination_lat: number
          destination_lng: number
          destination_text: string
          driver_id: string | null
          id: string
          is_demo: boolean
          origin_lat: number
          origin_lng: number
          origin_text: string
          passengers: number
          pickup_date: string
          pickup_time: string
          public_token: string
          quote_accepted_at: string | null
          quote_final_total: number | null
          quote_includes: string | null
          quote_minimum: number | null
          quote_other: number | null
          quote_pickup_extra: number | null
          quote_price_per_km: number | null
          quote_reference_total: number | null
          quote_rejected_at: string | null
          quote_sent_at: string | null
          quote_status: string
          quote_toll_count: number | null
          quote_toll_unit_value: number | null
          quote_tolls: number | null
          quote_waiting: number | null
          route_distance_km: number | null
          route_duration_min: number | null
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          code: string
          comments?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          destination_lat: number
          destination_lng: number
          destination_text: string
          driver_id?: string | null
          id?: string
          is_demo?: boolean
          origin_lat: number
          origin_lng: number
          origin_text: string
          passengers?: number
          pickup_date: string
          pickup_time: string
          public_token: string
          quote_accepted_at?: string | null
          quote_final_total?: number | null
          quote_includes?: string | null
          quote_minimum?: number | null
          quote_other?: number | null
          quote_pickup_extra?: number | null
          quote_price_per_km?: number | null
          quote_reference_total?: number | null
          quote_rejected_at?: string | null
          quote_sent_at?: string | null
          quote_status?: string
          quote_toll_count?: number | null
          quote_toll_unit_value?: number | null
          quote_tolls?: number | null
          quote_waiting?: number | null
          route_distance_km?: number | null
          route_duration_min?: number | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          comments?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          destination_lat?: number
          destination_lng?: number
          destination_text?: string
          driver_id?: string | null
          id?: string
          is_demo?: boolean
          origin_lat?: number
          origin_lng?: number
          origin_text?: string
          passengers?: number
          pickup_date?: string
          pickup_time?: string
          public_token?: string
          quote_accepted_at?: string | null
          quote_final_total?: number | null
          quote_includes?: string | null
          quote_minimum?: number | null
          quote_other?: number | null
          quote_pickup_extra?: number | null
          quote_price_per_km?: number | null
          quote_reference_total?: number | null
          quote_rejected_at?: string | null
          quote_sent_at?: string | null
          quote_status?: string
          quote_toll_count?: number | null
          quote_toll_unit_value?: number | null
          quote_tolls?: number | null
          quote_waiting?: number | null
          route_distance_km?: number | null
          route_duration_min?: number | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      availability_duration: {
        Args: { p_trip_duration_min: number }
        Returns: number
      }
      availability_free_times: {
        Args: { p_date: string; p_duration_min: number }
        Returns: string[]
      }
      availability_has_conflict: {
        Args: {
          p_date: string
          p_duration_min: number
          p_exclude: string
          p_include_pending: boolean
          p_time: string
        }
        Returns: boolean
      }
      availability_reason: {
        Args: { p_date: string; p_duration_min: number; p_time: string }
        Returns: string
      }
      availability_session_customer: {
        Args: { p_session_token: string }
        Returns: string
      }
      availability_settings_effective: {
        Args: never
        Returns: {
          active_weekdays: number[]
          buffer_after_min: number
          buffer_before_min: number
          day_end: string
          day_start: string
          default_trip_min: number
          enabled: boolean
          lead_time_min: number
          pending_hold_min: number
          singleton_id: number
          slot_interval_min: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "driver_availability_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_reservation_by_token: { Args: { p_token: string }; Returns: Json }
      claim_driver_pin: {
        Args: { p_full_name?: string; p_pin: string }
        Returns: Json
      }
      claim_first_driver: { Args: { p_full_name?: string }; Returns: Json }
      create_reservation: {
        Args: {
          p_comments: string
          p_customer_name: string
          p_customer_phone: string
          p_destination_lat: number
          p_destination_lng: number
          p_destination_text: string
          p_origin_lat: number
          p_origin_lng: number
          p_origin_text: string
          p_passengers: number
          p_pickup_date: string
          p_pickup_time: string
        }
        Returns: Json
      }
      customer_cancel_reservation: {
        Args: { p_reservation_id: string; p_session_token: string }
        Returns: Json
      }
      customer_check_availability_v11_3: {
        Args: {
          p_pickup_date: string
          p_pickup_time: string
          p_session_token: string
          p_trip_duration_min?: number
        }
        Returns: Json
      }
      customer_claim_reservation: {
        Args: { p_public_token: string; p_session_token: string }
        Returns: Json
      }
      customer_create_reservation: {
        Args: {
          p_comments: string
          p_destination_lat: number
          p_destination_lng: number
          p_destination_text: string
          p_origin_lat: number
          p_origin_lng: number
          p_origin_text: string
          p_passengers: number
          p_pickup_date: string
          p_pickup_time: string
          p_session_token: string
        }
        Returns: Json
      }
      customer_create_reservation_v10: {
        Args: {
          p_comments: string
          p_destination_lat: number
          p_destination_lng: number
          p_destination_text: string
          p_origin_lat: number
          p_origin_lng: number
          p_origin_text: string
          p_passengers: number
          p_pickup_date: string
          p_pickup_time: string
          p_route_distance_km?: number
          p_route_duration_min?: number
          p_session_token: string
        }
        Returns: Json
      }
      customer_create_reservation_v11_3: {
        Args: {
          p_comments: string
          p_destination_lat: number
          p_destination_lng: number
          p_destination_text: string
          p_origin_lat: number
          p_origin_lng: number
          p_origin_text: string
          p_passengers: number
          p_pickup_date: string
          p_pickup_time: string
          p_route_distance_km?: number
          p_route_duration_min?: number
          p_session_token: string
        }
        Returns: Json
      }
      customer_get_available_slots_v11_3: {
        Args: {
          p_pickup_date: string
          p_session_token: string
          p_trip_duration_min?: number
        }
        Returns: Json
      }
      customer_get_profile: { Args: { p_session_token: string }; Returns: Json }
      customer_list_reservations: {
        Args: { p_session_token: string }
        Returns: Json
      }
      customer_login: {
        Args: { p_device_label?: string; p_phone: string; p_pin: string }
        Returns: Json
      }
      customer_logout: { Args: { p_session_token: string }; Returns: boolean }
      customer_quote_decision_v10: {
        Args: {
          p_accept: boolean
          p_reservation_id: string
          p_session_token: string
        }
        Returns: Json
      }
      customer_quote_decision_v11_3: {
        Args: {
          p_accept: boolean
          p_reservation_id: string
          p_session_token: string
        }
        Returns: Json
      }
      customer_register: {
        Args: {
          p_device_label?: string
          p_full_name: string
          p_phone: string
          p_pin: string
        }
        Returns: Json
      }
      customer_update_profile: {
        Args: { p_full_name: string; p_session_token: string }
        Returns: Json
      }
      driver_add_schedule_block_v11_3: {
        Args: {
          p_date: string
          p_end: string
          p_note?: string
          p_pin: string
          p_start: string
        }
        Returns: Json
      }
      driver_delete_schedule_block_v11_3: {
        Args: { p_id: string; p_pin: string }
        Returns: Json
      }
      driver_get_availability_settings_v11_3: {
        Args: { p_pin: string }
        Returns: Json
      }
      driver_get_quote_settings_v10_7: {
        Args: { p_pin: string }
        Returns: Json
      }
      driver_history_v2: { Args: { p_pin: string }; Returns: Json }
      driver_list_reservations_v2: { Args: { p_pin: string }; Returns: Json }
      driver_list_schedule_blocks_v11_3: {
        Args: { p_from: string; p_pin: string; p_to: string }
        Returns: Json
      }
      driver_pin_valid: { Args: { p_pin: string }; Returns: boolean }
      driver_send_quote_v10: {
        Args: {
          p_final_total: number
          p_includes?: string
          p_minimum: number
          p_other: number
          p_pickup_extra: number
          p_pin: string
          p_price_per_km: number
          p_reference_total: number
          p_reservation_id: string
          p_route_distance_km: number
          p_route_duration_min?: number
          p_tolls: number
          p_waiting: number
        }
        Returns: Json
      }
      driver_send_quote_v10_7: {
        Args: {
          p_final_total: number
          p_includes?: string
          p_minimum: number
          p_other: number
          p_pickup_extra: number
          p_pin: string
          p_price_per_km: number
          p_reference_total: number
          p_reservation_id: string
          p_route_distance_km: number
          p_route_duration_min?: number
          p_toll_count: number
          p_toll_unit_value: number
          p_waiting: number
        }
        Returns: Json
      }
      driver_set_availability_settings_v11_3: {
        Args: {
          p_active_weekdays: number[]
          p_buffer_after_min: number
          p_buffer_before_min: number
          p_day_end: string
          p_day_start: string
          p_default_trip_min: number
          p_enabled: boolean
          p_lead_time_min: number
          p_pending_hold_min: number
          p_pin: string
          p_slot_interval_min: number
        }
        Returns: Json
      }
      driver_set_default_toll_v10_7: {
        Args: { p_pin: string; p_value: number }
        Returns: Json
      }
      driver_set_status_v2: {
        Args: { p_pin: string; p_reservation_id: string; p_status: string }
        Returns: Json
      }
      driver_setup_state: { Args: never; Returns: Json }
      driver_setup_state_v2: { Args: never; Returns: Json }
      generate_reservation_code: { Args: never; Returns: string }
      get_reservation_by_token: { Args: { p_token: string }; Returns: Json }
      is_driver: { Args: { _user_id: string }; Returns: boolean }
      log_app_event: {
        Args: {
          p_app: string
          p_app_version?: string
          p_details?: Json
          p_device_info?: string
          p_event: string
          p_level: string
          p_message?: string
          p_reservation_code?: string
        }
        Returns: number
      }
      normalize_customer_phone: { Args: { p_phone: string }; Returns: string }
    }
    Enums: {
      reservation_status:
        | "PENDIENTE"
        | "ACEPTADA"
        | "EN_VIAJE"
        | "FINALIZADA"
        | "CANCELADA"
        | "RECHAZADA"
        | "PRESUPUESTO_ENVIADO"
        | "ACEPTADA_CLIENTE"
        | "CONFIRMADA"
        | "RECHAZADA_CLIENTE"
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
      reservation_status: [
        "PENDIENTE",
        "ACEPTADA",
        "EN_VIAJE",
        "FINALIZADA",
        "CANCELADA",
        "RECHAZADA",
        "PRESUPUESTO_ENVIADO",
        "ACEPTADA_CLIENTE",
        "CONFIRMADA",
        "RECHAZADA_CLIENTE",
      ],
    },
  },
} as const