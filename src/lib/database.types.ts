
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "expense_revisions": {
                  Row: {
                    "amount_minor": number,"category": string | null,"created_at": string,"created_by": string | null,"currency": string,"description": string,"expense_date": string,"expense_id": string,"group_id": string,"id": string,"note": string | null,"payer_member_id": string,"revision": number,"split_method": Database["public"]['Enums']["split_method"]
                  }
                  Insert: {
                    "amount_minor": number,"category"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency": string,"description": string,"expense_date": string,"expense_id": string,"group_id": string,"id"?: string,"note"?: string | null,"payer_member_id": string,"revision": number,"split_method": Database["public"]['Enums']["split_method"]
                  }
                  Update: {
                    "amount_minor"?: number,"category"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string,"expense_date"?: string,"expense_id"?: string,"group_id"?: string,"id"?: string,"note"?: string | null,"payer_member_id"?: string,"revision"?: number,"split_method"?: Database["public"]['Enums']["split_method"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_revisions_expense_id_group_id_fkey"
      columns: ["expense_id","group_id"]
isOneToOne: false
      referencedRelation: "expense_current"
      referencedColumns: ["expense_id","group_id"]
    },{
      foreignKeyName: "expense_revisions_expense_id_group_id_fkey"
      columns: ["expense_id","group_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "expense_revisions_payer_member_id_group_id_fkey"
      columns: ["payer_member_id","group_id"]
isOneToOne: false
      referencedRelation: "group_members"
      referencedColumns: ["id","group_id"]
    }
                  ]
                },"expense_shares": {
                  Row: {
                    "group_id": string,"input_value": number | null,"member_id": string,"revision_id": string,"share_minor": number
                  }
                  Insert: {
                    "group_id": string,"input_value"?: number | null,"member_id": string,"revision_id": string,"share_minor": number
                  }
                  Update: {
                    "group_id"?: string,"input_value"?: number | null,"member_id"?: string,"revision_id"?: string,"share_minor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_shares_member_id_group_id_fkey"
      columns: ["member_id","group_id"]
isOneToOne: false
      referencedRelation: "group_members"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "expense_shares_revision_id_group_id_fkey"
      columns: ["revision_id","group_id"]
isOneToOne: false
      referencedRelation: "expense_revisions"
      referencedColumns: ["id","group_id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "created_at": string,"created_by": string | null,"current_revision": number,"group_id": string,"id": string,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"current_revision"?: number,"group_id": string,"id"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"current_revision"?: number,"group_id"?: string,"id"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"group_events": {
                  Row: {
                    "actor_member_id": string | null,"actor_user_id": string | null,"created_at": string,"data": NonNullable<Json>,"expense_id": string | null,"group_id": string,"id": number,"kind": string,"member_id": string | null,"payment_id": string | null
                  }
                  Insert: {
                    "actor_member_id"?: string | null,"actor_user_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"expense_id"?: string | null,"group_id": string,"id"?: never,"kind": string,"member_id"?: string | null,"payment_id"?: string | null
                  }
                  Update: {
                    "actor_member_id"?: string | null,"actor_user_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"expense_id"?: string | null,"group_id"?: string,"id"?: never,"kind"?: string,"member_id"?: string | null,"payment_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_events_actor_member_id_fkey"
      columns: ["actor_member_id"]
isOneToOne: false
      referencedRelation: "group_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_events_expense_id_fkey"
      columns: ["expense_id"]
isOneToOne: false
      referencedRelation: "expense_current"
      referencedColumns: ["expense_id"]
    },{
      foreignKeyName: "group_events_expense_id_fkey"
      columns: ["expense_id"]
isOneToOne: false
      referencedRelation: "expense_current_shares"
      referencedColumns: ["expense_id"]
    },{
      foreignKeyName: "group_events_expense_id_fkey"
      columns: ["expense_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_events_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_events_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "group_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_events_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"group_invites": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string,"group_id": string,"id": string,"revoked_at": string | null,"token": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at": string,"group_id": string,"id"?: string,"revoked_at"?: string | null,"token": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"group_id"?: string,"id"?: string,"revoked_at"?: string | null,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_invites_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"group_members": {
                  Row: {
                    "color_index": number,"created_by": string | null,"display_name": string,"group_id": string,"id": string,"invited_email": string | null,"joined_at": string,"left_at": string | null,"role": Database["public"]['Enums']["member_role"],"seq": number,"status": Database["public"]['Enums']["member_status"],"user_id": string | null
                  }
                  Insert: {
                    "color_index"?: number,"created_by"?: string | null,"display_name": string,"group_id": string,"id"?: string,"invited_email"?: string | null,"joined_at"?: string,"left_at"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"seq"?: never,"status"?: Database["public"]['Enums']["member_status"],"user_id"?: string | null
                  }
                  Update: {
                    "color_index"?: number,"created_by"?: string | null,"display_name"?: string,"group_id"?: string,"id"?: string,"invited_email"?: string | null,"joined_at"?: string,"left_at"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"seq"?: never,"status"?: Database["public"]['Enums']["member_status"],"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "created_at": string,"created_by": string | null,"currency": string,"id": string,"name": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"currency": string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payments": {
                  Row: {
                    "amount_minor": number,"created_at": string,"created_by": string | null,"currency": string,"from_member_id": string,"group_id": string,"id": string,"method": string | null,"note": string | null,"paid_on": string,"receipt_number": number,"to_member_id": string,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  Insert: {
                    "amount_minor": number,"created_at"?: string,"created_by"?: string | null,"currency": string,"from_member_id": string,"group_id": string,"id"?: string,"method"?: string | null,"note"?: string | null,"paid_on": string,"receipt_number"?: never,"to_member_id": string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "amount_minor"?: number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"from_member_id"?: string,"group_id"?: string,"id"?: string,"method"?: string | null,"note"?: string | null,"paid_on"?: string,"receipt_number"?: never,"to_member_id"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_from_member_id_group_id_fkey"
      columns: ["from_member_id","group_id"]
isOneToOne: false
      referencedRelation: "group_members"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "payments_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_to_member_id_group_id_fkey"
      columns: ["to_member_id","group_id"]
isOneToOne: false
      referencedRelation: "group_members"
      referencedColumns: ["id","group_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"payment_alias": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"display_name": string,"id": string,"payment_alias"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"payment_alias"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "expense_current": {
                  Row: {
                    "amount_minor": number | null,"category": string | null,"created_at": string | null,"created_by": string | null,"currency": string | null,"current_revision": number | null,"description": string | null,"expense_date": string | null,"expense_id": string | null,"group_id": string | null,"note": string | null,"payer_member_id": string | null,"revised_at": string | null,"revised_by": string | null,"revision_id": string | null,"split_method": Database["public"]['Enums']["split_method"] | null,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_current_shares": {
                  Row: {
                    "expense_id": string | null,"group_id": string | null,"input_value": number | null,"member_id": string | null,"revision_id": string | null,"share_minor": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_shares_member_id_group_id_fkey"
      columns: ["member_id","group_id"]
isOneToOne: false
      referencedRelation: "group_members"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "expense_shares_revision_id_group_id_fkey"
      columns: ["revision_id","group_id"]
isOneToOne: false
      referencedRelation: "expense_revisions"
      referencedColumns: ["id","group_id"]
    }
                  ]
                }
          }
          Functions: {
            "_check_expense_fields":
{ Args: { "p_amount": number,"p_category": string,"p_currency": string,"p_date": string,"p_description": string,"p_group": string }; Returns: undefined
                           },
"_check_expense_members":
{ Args: { "p_group": string,"p_payer": string,"p_prev_revision"?: string,"p_shares": Json }; Returns: undefined
                           },
"_clean_text":
{ Args: { "p": string,"p_max": number }; Returns: string
                           },
"_insert_revision":
{ Args: { "p_amount": number,"p_category": string,"p_currency": string,"p_date": string,"p_description": string,"p_expense": string,"p_group": string,"p_method": Database["public"]['Enums']["split_method"],"p_note": string,"p_payer": string,"p_revision": number,"p_shares": Json }; Returns: string
                           },
"_log":
{ Args: { "p_actor_member": string,"p_data"?: Json,"p_expense"?: string,"p_group": string,"p_kind": string,"p_member"?: string,"p_payment"?: string }; Returns: undefined
                           },
"_member_net":
{ Args: { "p_group": string,"p_member": string }; Returns: number
                           },
"_my_member":
{ Args: { "p_group": string,"p_require_owner"?: boolean }; Returns: {
              "color_index": number,
"created_by": string | null,
"display_name": string,
"group_id": string,
"id": string,
"invited_email": string | null,
"joined_at": string,
"left_at": string | null,
"role": Database["public"]['Enums']["member_role"],
"seq": number,
"status": Database["public"]['Enums']["member_status"],
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "group_members"
        isOneToOne: true
        isSetofReturn: false
      } },
"_next_color":
{ Args: { "p_group": string }; Returns: number
                           },
"_uid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"_validate_shares":
{ Args: { "p_amount": number,"p_group": string,"p_method": Database["public"]['Enums']["split_method"],"p_payer": string,"p_shares": Json }; Returns: undefined
                           },
"accept_invite":
{ Args: { "p_claim_member"?: string,"p_token": string }; Returns: string
                           },
"add_member":
{ Args: { "p_email"?: string,"p_group": string,"p_name": string }; Returns: string
                           },
"claim_email_memberships":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"create_expense":
{ Args: { "p_amount": number,"p_category": string,"p_currency": string,"p_date": string,"p_description": string,"p_group": string,"p_method": Database["public"]['Enums']["split_method"],"p_note": string,"p_payer": string,"p_shares": Json }; Returns: string
                           },
"create_group":
{ Args: { "p_currency": string,"p_name": string }; Returns: string
                           },
"create_invite":
{ Args: { "p_group": string }; Returns: string
                           },
"edit_expense":
{ Args: { "p_amount": number,"p_category": string,"p_currency": string,"p_date": string,"p_description": string,"p_expected_revision": number,"p_expense": string,"p_method": Database["public"]['Enums']["split_method"],"p_note": string,"p_payer": string,"p_shares": Json }; Returns: number
                           },
"get_invite":
{ Args: { "p_token": string }; Returns: Json
                           },
"is_group_member":
{ Args: { "p_group": string }; Returns: boolean
                           },
"is_group_owner":
{ Args: { "p_group": string }; Returns: boolean
                           },
"leave_group":
{ Args: { "p_group": string }; Returns: undefined
                           },
"my_group_summaries":
{ Args: Record<PropertyKey, never>; Returns: {
              "active_members": number,"currency": string,"group_id": string,"last_activity_at": string,"member_colors": (number)[],"member_id": string,"name": string,"net_minor": number,"role": Database["public"]['Enums']["member_role"]
            }[]
                           },
"record_payment":
{ Args: { "p_amount": number,"p_currency": string,"p_date": string,"p_from": string,"p_group": string,"p_method"?: string,"p_note"?: string,"p_to": string }; Returns: Json
                           },
"remove_member":
{ Args: { "p_force"?: boolean,"p_group": string,"p_member": string }; Returns: undefined
                           },
"revoke_invites":
{ Args: { "p_group": string }; Returns: undefined
                           },
"set_member_role":
{ Args: { "p_group": string,"p_member": string,"p_role": Database["public"]['Enums']["member_role"] }; Returns: undefined
                           },
"shares_group_with":
{ Args: { "p_user": string }; Returns: boolean
                           },
"update_group":
{ Args: { "p_currency": string,"p_group": string,"p_name": string }; Returns: undefined
                           },
"void_expense":
{ Args: { "p_expense": string,"p_reason"?: string }; Returns: undefined
                           },
"void_payment":
{ Args: { "p_payment": string,"p_reason"?: string }; Returns: undefined
                           }
          }
          Enums: {
            "member_role": "owner"|"member","member_status": "active"|"left"|"removed","split_method": "equal"|"exact"|"percent"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "member_role": ["owner", "member"],"member_status": ["active", "left", "removed"],"split_method": ["equal", "exact", "percent"]
          }
        }
} as const

