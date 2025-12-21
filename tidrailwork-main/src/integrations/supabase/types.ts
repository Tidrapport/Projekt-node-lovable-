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
      billing_records: {
        Row: {
          amount: number
          billing_month: string
          company_id: string
          created_at: string
          id: string
          paid_at: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: string
          user_count: number
        }
        Insert: {
          amount: number
          billing_month: string
          company_id: string
          created_at?: string
          id?: string
          paid_at?: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          status?: string
          user_count: number
        }
        Update: {
          amount?: number
          billing_month?: string
          company_id?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: string
          user_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          billing_email: string | null
          billing_start_date: string | null
          company_code: string
          created_at: string
          id: string
          is_active: boolean | null
          logo_url: string | null
          monthly_price_per_user: number | null
          name: string
          org_number: string | null
          slug: string
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          billing_start_date?: string | null
          company_code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          monthly_price_per_user?: number | null
          name: string
          org_number?: string | null
          slug: string
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          billing_start_date?: string | null
          company_code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          monthly_price_per_user?: number | null
          name?: string
          org_number?: string | null
          slug?: string
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          company_id: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          org_number: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          org_number?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          org_number?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deviation_images: {
        Row: {
          created_at: string
          deviation_report_id: string
          id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          deviation_report_id: string
          id?: string
          storage_path: string
        }
        Update: {
          created_at?: string
          deviation_report_id?: string
          id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "deviation_images_deviation_report_id_fkey"
            columns: ["deviation_report_id"]
            isOneToOne: false
            referencedRelation: "deviation_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      deviation_reports: {
        Row: {
          company_id: string | null
          created_at: string
          description: string
          id: string
          severity: string | null
          status: string | null
          time_entry_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          severity?: string | null
          status?: string | null
          time_entry_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          severity?: string | null
          status?: string | null
          time_entry_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deviation_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deviation_reports_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deviation_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fortnox_company_mappings: {
        Row: {
          company_id: string
          created_at: string
          fortnox_code: string
          fortnox_description: string | null
          id: string
          internal_code: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          fortnox_code: string
          fortnox_description?: string | null
          id?: string
          internal_code: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          fortnox_code?: string
          fortnox_description?: string | null
          id?: string
          internal_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fortnox_company_mappings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnox_company_mappings_internal_code_fkey"
            columns: ["internal_code"]
            isOneToOne: false
            referencedRelation: "fortnox_salary_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      fortnox_export_logs: {
        Row: {
          company_id: string
          employee_count: number
          entry_count: number
          exported_at: string
          exported_by: string
          filename: string
          id: string
          period_end: string
          period_start: string
        }
        Insert: {
          company_id: string
          employee_count: number
          entry_count: number
          exported_at?: string
          exported_by: string
          filename: string
          id?: string
          period_end: string
          period_start: string
        }
        Update: {
          company_id?: string
          employee_count?: number
          entry_count?: number
          exported_at?: string
          exported_by?: string
          filename?: string
          id?: string
          period_end?: string
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "fortnox_export_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnox_export_logs_exported_by_fkey"
            columns: ["exported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fortnox_salary_codes: {
        Row: {
          category: string
          code: string
          company_id: string | null
          created_at: string
          default_fortnox_code: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category: string
          code: string
          company_id?: string | null
          created_at?: string
          default_fortnox_code?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string
          code?: string
          company_id?: string | null
          created_at?: string
          default_fortnox_code?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fortnox_salary_codes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      job_roles: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      material_reports: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          material_type_id: string
          notes: string | null
          quantity: number
          time_entry_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          material_type_id: string
          notes?: string | null
          quantity: number
          time_entry_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          material_type_id?: string
          notes?: string | null
          quantity?: number
          time_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_reports_material_type_id_fkey"
            columns: ["material_type_id"]
            isOneToOne: false
            referencedRelation: "material_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_reports_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      material_types: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          unit: string
        }
        Insert: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          unit: string
        }
        Update: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          estimated_hours: number | null
          fixed_price: number | null
          hourly_rate_day: number | null
          hourly_rate_evening: number | null
          hourly_rate_night: number | null
          hourly_rate_weekend: number | null
          id: string
          include_vat: boolean
          notes: string | null
          offer_number: string
          per_diem_full: number | null
          per_diem_half: number | null
          pricing_type: string
          status: string
          terms: string | null
          title: string
          travel_rate_per_km: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          estimated_hours?: number | null
          fixed_price?: number | null
          hourly_rate_day?: number | null
          hourly_rate_evening?: number | null
          hourly_rate_night?: number | null
          hourly_rate_weekend?: number | null
          id?: string
          include_vat?: boolean
          notes?: string | null
          offer_number: string
          per_diem_full?: number | null
          per_diem_half?: number | null
          pricing_type?: string
          status?: string
          terms?: string | null
          title: string
          travel_rate_per_km?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          estimated_hours?: number | null
          fixed_price?: number | null
          hourly_rate_day?: number | null
          hourly_rate_evening?: number | null
          hourly_rate_night?: number | null
          hourly_rate_weekend?: number | null
          id?: string
          include_vat?: boolean
          notes?: string | null
          offer_number?: string
          per_diem_full?: number | null
          per_diem_half?: number | null
          pricing_type?: string
          status?: string
          terms?: string | null
          title?: string
          travel_rate_per_km?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          emergency_contact: string | null
          employee_number: string | null
          employee_type: Database["public"]["Enums"]["employee_type"] | null
          full_name: string
          hourly_wage: number | null
          id: string
          phone: string | null
          tax_table: number | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          employee_number?: string | null
          employee_type?: Database["public"]["Enums"]["employee_type"] | null
          full_name: string
          hourly_wage?: number | null
          id: string
          phone?: string | null
          tax_table?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          employee_number?: string | null
          employee_type?: Database["public"]["Enums"]["employee_type"] | null
          full_name?: string
          hourly_wage?: number | null
          id?: string
          phone?: string | null
          tax_table?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          description: string | null
          id: string
          internal_marking: string | null
          location: string | null
          name: string
          updated_at: string
          work_task: string | null
        }
        Insert: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          description?: string | null
          id?: string
          internal_marking?: string | null
          location?: string | null
          name: string
          updated_at?: string
          work_task?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          description?: string | null
          id?: string
          internal_marking?: string | null
          location?: string | null
          name?: string
          updated_at?: string
          work_task?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_assignments: {
        Row: {
          company_id: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string
          end_date: string
          first_shift_start_time: string | null
          id: string
          is_tentative: boolean
          notes: string | null
          project_id: string
          start_date: string
          subproject_id: string | null
          updated_at: string | null
          user_id: string
          vehicle: string | null
          work_address: string | null
        }
        Insert: {
          company_id?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by: string
          end_date: string
          first_shift_start_time?: string | null
          id?: string
          is_tentative?: boolean
          notes?: string | null
          project_id: string
          start_date: string
          subproject_id?: string | null
          updated_at?: string | null
          user_id: string
          vehicle?: string | null
          work_address?: string | null
        }
        Update: {
          company_id?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string
          end_date?: string
          first_shift_start_time?: string | null
          id?: string
          is_tentative?: boolean
          notes?: string | null
          project_id?: string
          start_date?: string
          subproject_id?: string | null
          updated_at?: string | null
          user_id?: string
          vehicle?: string | null
          work_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_assignments_subproject_id_fkey"
            columns: ["subproject_id"]
            isOneToOne: false
            referencedRelation: "subprojects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_types_config: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          end_hour: number
          id: string
          multiplier: number
          shift_type: Database["public"]["Enums"]["shift_type"]
          start_hour: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          end_hour?: number
          id?: string
          multiplier?: number
          shift_type: Database["public"]["Enums"]["shift_type"]
          start_hour?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          end_hour?: number
          id?: string
          multiplier?: number
          shift_type?: Database["public"]["Enums"]["shift_type"]
          start_hour?: number
        }
        Relationships: [
          {
            foreignKeyName: "shift_types_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subprojects: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subprojects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subprojects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          ao_number: string | null
          attested_at: string | null
          attested_by: string | null
          break_minutes: number | null
          company_id: string | null
          created_at: string
          date: string
          end_time: string
          id: string
          invoiced: boolean | null
          invoiced_at: string | null
          invoiced_by: string | null
          job_role_id: string
          overtime_weekday_hours: number | null
          overtime_weekend_hours: number | null
          per_diem_type: string | null
          project_id: string
          save_travel_compensation: boolean | null
          shift_type: Database["public"]["Enums"]["shift_type"]
          start_time: string
          subproject_id: string | null
          total_hours: number
          travel_time_hours: number | null
          updated_at: string
          user_id: string
          work_description: string | null
        }
        Insert: {
          ao_number?: string | null
          attested_at?: string | null
          attested_by?: string | null
          break_minutes?: number | null
          company_id?: string | null
          created_at?: string
          date: string
          end_time: string
          id?: string
          invoiced?: boolean | null
          invoiced_at?: string | null
          invoiced_by?: string | null
          job_role_id: string
          overtime_weekday_hours?: number | null
          overtime_weekend_hours?: number | null
          per_diem_type?: string | null
          project_id: string
          save_travel_compensation?: boolean | null
          shift_type?: Database["public"]["Enums"]["shift_type"]
          start_time: string
          subproject_id?: string | null
          total_hours: number
          travel_time_hours?: number | null
          updated_at?: string
          user_id: string
          work_description?: string | null
        }
        Update: {
          ao_number?: string | null
          attested_at?: string | null
          attested_by?: string | null
          break_minutes?: number | null
          company_id?: string | null
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          invoiced?: boolean | null
          invoiced_at?: string | null
          invoiced_by?: string | null
          job_role_id?: string
          overtime_weekday_hours?: number | null
          overtime_weekend_hours?: number | null
          per_diem_type?: string | null
          project_id?: string
          save_travel_compensation?: boolean | null
          shift_type?: Database["public"]["Enums"]["shift_type"]
          start_time?: string
          subproject_id?: string | null
          total_hours?: number
          travel_time_hours?: number | null
          updated_at?: string
          user_id?: string
          work_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_invoiced_by_fkey"
            columns: ["invoiced_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_subproject_id_fkey"
            columns: ["subproject_id"]
            isOneToOne: false
            referencedRelation: "subprojects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      welding_reports: {
        Row: {
          bessy_anm_ofelia: string | null
          cleaned_workplace: boolean | null
          comments: string | null
          company_id: string | null
          created_at: string
          customer_ao_number: string | null
          deviations: string | null
          ensured_gas_flow: boolean | null
          geometry_control: boolean | null
          id: string
          id_marked_weld: boolean | null
          own_ao_number: string | null
          protected_cooling: boolean | null
          report_date: string
          report_month: number
          report_year: number
          restored_rail_quantity: boolean | null
          supervisor_phone: string | null
          updated_at: string
          user_id: string
          welded_in_cold_climate: boolean | null
          welder_id: string
          welder_name: string
          welding_entries: Json
          welding_supervisor: string | null
        }
        Insert: {
          bessy_anm_ofelia?: string | null
          cleaned_workplace?: boolean | null
          comments?: string | null
          company_id?: string | null
          created_at?: string
          customer_ao_number?: string | null
          deviations?: string | null
          ensured_gas_flow?: boolean | null
          geometry_control?: boolean | null
          id?: string
          id_marked_weld?: boolean | null
          own_ao_number?: string | null
          protected_cooling?: boolean | null
          report_date: string
          report_month: number
          report_year: number
          restored_rail_quantity?: boolean | null
          supervisor_phone?: string | null
          updated_at?: string
          user_id: string
          welded_in_cold_climate?: boolean | null
          welder_id: string
          welder_name: string
          welding_entries?: Json
          welding_supervisor?: string | null
        }
        Update: {
          bessy_anm_ofelia?: string | null
          cleaned_workplace?: boolean | null
          comments?: string | null
          company_id?: string | null
          created_at?: string
          customer_ao_number?: string | null
          deviations?: string | null
          ensured_gas_flow?: boolean | null
          geometry_control?: boolean | null
          id?: string
          id_marked_weld?: boolean | null
          own_ao_number?: string | null
          protected_cooling?: boolean | null
          report_date?: string
          report_month?: number
          report_year?: number
          restored_rail_quantity?: boolean | null
          supervisor_phone?: string | null
          updated_at?: string
          user_id?: string
          welded_in_cold_climate?: boolean | null
          welder_id?: string
          welder_name?: string
          welding_entries?: Json
          welding_supervisor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "welding_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "welding_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_company_code: { Args: never; Returns: string }
      generate_offer_number: { Args: { p_company_id: string }; Returns: string }
      get_companies_for_login: {
        Args: never
        Returns: {
          company_code: string
          id: string
          is_active: boolean
          logo_url: string
          name: string
        }[]
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      verify_company_code: {
        Args: { code: string }
        Returns: {
          id: string
          logo_url: string
          name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin"
      employee_type: "anställd" | "platschef" | "inhyrd"
      shift_type:
        | "day"
        | "evening"
        | "night"
        | "weekend"
        | "overtime_day"
        | "overtime_weekend"
      subscription_plan: "free" | "core" | "pro" | "enterprise"
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
      app_role: ["admin", "user", "super_admin"],
      employee_type: ["anställd", "platschef", "inhyrd"],
      shift_type: [
        "day",
        "evening",
        "night",
        "weekend",
        "overtime_day",
        "overtime_weekend",
      ],
      subscription_plan: ["free", "core", "pro", "enterprise"],
    },
  },
} as const
