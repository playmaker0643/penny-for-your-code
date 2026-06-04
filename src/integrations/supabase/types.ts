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
      archived_chats: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archived_chats_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          course_id: string | null
          created_at: string
          date: string
          id: string
          status: Database["public"]["Enums"]["attendance_status"]
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          date: string
          id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          date?: string
          id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          call_type: Database["public"]["Enums"]["call_type"]
          caller_id: string
          chat_id: string | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          parent_call_id: string | null
          receiver_id: string
          status: Database["public"]["Enums"]["call_status"]
        }
        Insert: {
          call_type?: Database["public"]["Enums"]["call_type"]
          caller_id: string
          chat_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          parent_call_id?: string | null
          receiver_id: string
          status?: Database["public"]["Enums"]["call_status"]
        }
        Update: {
          call_type?: Database["public"]["Enums"]["call_type"]
          caller_id?: string
          chat_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          parent_call_id?: string | null
          receiver_id?: string
          status?: Database["public"]["Enums"]["call_status"]
        }
        Relationships: [
          {
            foreignKeyName: "calls_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_parent_call_id_fkey"
            columns: ["parent_call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          awarded_at: string | null
          certificate_no: string | null
          course_id: string
          created_at: string
          id: string
          revoked_at: string | null
          status: Database["public"]["Enums"]["cert_status"]
          user_id: string
        }
        Insert: {
          awarded_at?: string | null
          certificate_no?: string | null
          course_id: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["cert_status"]
          user_id: string
        }
        Update: {
          awarded_at?: string | null
          certificate_no?: string | null
          course_id?: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["cert_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_invitations: {
        Row: {
          chat_id: string | null
          course_id: string | null
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: Database["public"]["Enums"]["challenge_status"]
        }
        Insert: {
          chat_id?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: Database["public"]["Enums"]["challenge_status"]
        }
        Update: {
          chat_id?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: Database["public"]["Enums"]["challenge_status"]
        }
        Relationships: [
          {
            foreignKeyName: "challenge_invitations_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_invitations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_matches: {
        Row: {
          accepted_at: string | null
          completed_at: string | null
          course_id: string | null
          created_at: string
          id: string
          invitation_id: string | null
          player_one_current_index: number
          player_one_id: string
          player_one_score: number
          player_two_current_index: number
          player_two_id: string
          player_two_score: number
          question_ids: string[]
          status: Database["public"]["Enums"]["challenge_status"]
          winner_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          invitation_id?: string | null
          player_one_current_index?: number
          player_one_id: string
          player_one_score?: number
          player_two_current_index?: number
          player_two_id: string
          player_two_score?: number
          question_ids?: string[]
          status?: Database["public"]["Enums"]["challenge_status"]
          winner_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          invitation_id?: string | null
          player_one_current_index?: number
          player_one_id?: string
          player_one_score?: number
          player_two_current_index?: number
          player_two_id?: string
          player_two_score?: number
          question_ids?: string[]
          status?: Database["public"]["Enums"]["challenge_status"]
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_matches_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_matches_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "challenge_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_questions: {
        Row: {
          correct_answer: string
          course_id: string
          created_at: string
          id: string
          options: string[] | null
          question_text: string
          question_type: Database["public"]["Enums"]["challenge_question_type"]
        }
        Insert: {
          correct_answer: string
          course_id: string
          created_at?: string
          id?: string
          options?: string[] | null
          question_text: string
          question_type?: Database["public"]["Enums"]["challenge_question_type"]
        }
        Update: {
          correct_answer?: string
          course_id?: string
          created_at?: string
          id?: string
          options?: string[] | null
          question_text?: string
          question_type?: Database["public"]["Enums"]["challenge_question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "challenge_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_members: {
        Row: {
          chat_id: string
          id: string
          is_admin: boolean
          joined_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          chat_id: string
          content: string | null
          created_at: string
          deleted_for_everyone: boolean
          edited: boolean
          id: string
          is_admin_broadcast: boolean
          message_type: string
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          chat_id: string
          content?: string | null
          created_at?: string
          deleted_for_everyone?: boolean
          edited?: boolean
          id?: string
          is_admin_broadcast?: boolean
          message_type?: string
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          chat_id?: string
          content?: string | null
          created_at?: string
          deleted_for_everyone?: boolean
          edited?: boolean
          id?: string
          is_admin_broadcast?: boolean
          message_type?: string
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string
          created_by: string | null
          group_avatar_url: string | null
          group_name: string | null
          id: string
          is_group: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_avatar_url?: string | null
          group_name?: string | null
          id?: string
          is_group?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_avatar_url?: string | null
          group_name?: string | null
          id?: string
          is_group?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_published: boolean
          thumbnail_url: string | null
          title: string
          total_lessons_required: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          thumbnail_url?: string | null
          title: string
          total_lessons_required?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          thumbnail_url?: string | null
          title?: string
          total_lessons_required?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          correct_answer: string | null
          created_at: string
          exam_id: string
          id: string
          options: string[] | null
          order_index: number
          part: string
          question_text: string
        }
        Insert: {
          correct_answer?: string | null
          created_at?: string
          exam_id: string
          id?: string
          options?: string[] | null
          order_index?: number
          part?: string
          question_text: string
        }
        Update: {
          correct_answer?: string | null
          created_at?: string
          exam_id?: string
          id?: string
          options?: string[] | null
          order_index?: number
          part?: string
          question_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_submissions: {
        Row: {
          ai_feedback: string | null
          ai_score: number | null
          code_answer: string | null
          code_score: number | null
          content: string | null
          essay_answers: Json | null
          essay_score: number | null
          exam_id: string
          file_url: string | null
          graded: boolean
          graded_at: string | null
          id: string
          marking_status: Database["public"]["Enums"]["marking_status"]
          obj_answers: Json | null
          obj_score: number | null
          sandbox_code: string | null
          score: number | null
          submitted_at: string
          user_id: string
        }
        Insert: {
          ai_feedback?: string | null
          ai_score?: number | null
          code_answer?: string | null
          code_score?: number | null
          content?: string | null
          essay_answers?: Json | null
          essay_score?: number | null
          exam_id: string
          file_url?: string | null
          graded?: boolean
          graded_at?: string | null
          id?: string
          marking_status?: Database["public"]["Enums"]["marking_status"]
          obj_answers?: Json | null
          obj_score?: number | null
          sandbox_code?: string | null
          score?: number | null
          submitted_at?: string
          user_id: string
        }
        Update: {
          ai_feedback?: string | null
          ai_score?: number | null
          code_answer?: string | null
          code_score?: number | null
          content?: string | null
          essay_answers?: Json | null
          essay_score?: number | null
          exam_id?: string
          file_url?: string | null
          graded?: boolean
          graded_at?: string | null
          id?: string
          marking_status?: Database["public"]["Enums"]["marking_status"]
          obj_answers?: Json | null
          obj_score?: number | null
          sandbox_code?: string | null
          score?: number | null
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_submissions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          ai_marking: boolean
          ai_marking_context: string | null
          allow_sandbox: boolean
          course_id: string | null
          created_at: string
          description: string | null
          exam_type: Database["public"]["Enums"]["exam_type"]
          id: string
          is_published: boolean
          max_score: number
          parts: Json
          target_lesson_id: string | null
          target_reg_numbers: string[] | null
          target_type: string
          title: string
        }
        Insert: {
          ai_marking?: boolean
          ai_marking_context?: string | null
          allow_sandbox?: boolean
          course_id?: string | null
          created_at?: string
          description?: string | null
          exam_type?: Database["public"]["Enums"]["exam_type"]
          id?: string
          is_published?: boolean
          max_score?: number
          parts?: Json
          target_lesson_id?: string | null
          target_reg_numbers?: string[] | null
          target_type?: string
          title: string
        }
        Update: {
          ai_marking?: boolean
          ai_marking_context?: string | null
          allow_sandbox?: boolean
          course_id?: string | null
          created_at?: string
          description?: string | null
          exam_type?: Database["public"]["Enums"]["exam_type"]
          id?: string
          is_published?: boolean
          max_score?: number
          parts?: Json
          target_lesson_id?: string | null
          target_reg_numbers?: string[] | null
          target_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_target_lesson_id_fkey"
            columns: ["target_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: Database["public"]["Enums"]["friend_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: Database["public"]["Enums"]["friend_status"]
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: Database["public"]["Enums"]["friend_status"]
        }
        Relationships: []
      }
      group_invitations: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          invitee_id: string
          inviter_id: string
          status: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          invitee_id: string
          inviter_id: string
          status?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invitations_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_engagement: {
        Row: {
          id: string
          interactions: number
          last_ping: string
          lesson_id: string
          seconds_active: number
          user_id: string
        }
        Insert: {
          id?: string
          interactions?: number
          last_ping?: string
          lesson_id: string
          seconds_active?: number
          user_id: string
        }
        Update: {
          id?: string
          interactions?: number
          last_ping?: string
          lesson_id?: string
          seconds_active?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_engagement_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_practicals: {
        Row: {
          created_at: string
          difficulty: string
          hidden_tests: Json
          id: string
          language: string
          lesson_id: string
          min_engagement_seconds: number
          order_index: number
          prompt: string
          reference_solution: string | null
          required: boolean
          starter_code: string | null
          title: string
          updated_at: string
          visible_tests: Json
          xp_reward: number
        }
        Insert: {
          created_at?: string
          difficulty?: string
          hidden_tests?: Json
          id?: string
          language?: string
          lesson_id: string
          min_engagement_seconds?: number
          order_index?: number
          prompt: string
          reference_solution?: string | null
          required?: boolean
          starter_code?: string | null
          title: string
          updated_at?: string
          visible_tests?: Json
          xp_reward?: number
        }
        Update: {
          created_at?: string
          difficulty?: string
          hidden_tests?: Json
          id?: string
          language?: string
          lesson_id?: string
          min_engagement_seconds?: number
          order_index?: number
          prompt?: string
          reference_solution?: string | null
          required?: boolean
          starter_code?: string | null
          title?: string
          updated_at?: string
          visible_tests?: Json
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_practicals_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          ai_questions_date: string | null
          ai_questions_used: number
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          ai_questions_date?: string | null
          ai_questions_used?: number
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          ai_questions_date?: string | null
          ai_questions_used?: number
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_question_attempts: {
        Row: {
          answer: string | null
          correct: boolean
          created_at: string
          id: string
          lesson_id: string
          question_id: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          correct?: boolean
          created_at?: string
          id?: string
          lesson_id: string
          question_id: string
          user_id: string
        }
        Update: {
          answer?: string | null
          correct?: boolean
          created_at?: string
          id?: string
          lesson_id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_question_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_question_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "lesson_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_questions: {
        Row: {
          correct_answer: string
          created_at: string
          id: string
          lesson_id: string
          options: string[] | null
          order_index: number
          question_text: string
          question_type: Database["public"]["Enums"]["challenge_question_type"]
        }
        Insert: {
          correct_answer: string
          created_at?: string
          id?: string
          lesson_id: string
          options?: string[] | null
          order_index?: number
          question_text: string
          question_type?: Database["public"]["Enums"]["challenge_question_type"]
        }
        Update: {
          correct_answer?: string
          created_at?: string
          id?: string
          lesson_id?: string
          options?: string[] | null
          order_index?: number
          question_text?: string
          question_type?: Database["public"]["Enums"]["challenge_question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "lesson_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          completion_time_minutes: number | null
          content: string | null
          content_html: string | null
          course_id: string
          created_at: string
          description: string | null
          id: string
          order_index: number
          title: string
          video_url: string | null
        }
        Insert: {
          completion_time_minutes?: number | null
          content?: string | null
          content_html?: string | null
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          title: string
          video_url?: string | null
        }
        Update: {
          completion_time_minutes?: number | null
          content?: string | null
          content_html?: string | null
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      message_read_receipts: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notification_dedup: {
        Row: {
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          hash: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          hash: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          hash?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_events: {
        Row: {
          category: Database["public"]["Enums"]["notification_category"] | null
          created_at: string
          event: string
          id: string
          meta: Json
          notification_id: string | null
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["notification_category"] | null
          created_at?: string
          event: string
          id?: string
          meta?: Json
          notification_id?: string | null
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["notification_category"] | null
          created_at?: string
          event?: string
          id?: string
          meta?: Json
          notification_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          achievement: boolean
          ai_recommendation: boolean
          announcement: boolean
          assignment_deadline: boolean
          challenge: boolean
          chat_message: boolean
          course_reminder: boolean
          direct_message: boolean
          high_priority_only: boolean
          leaderboard_change: boolean
          lesson_reminder: boolean
          live_class: boolean
          mentor_reply: boolean
          mute_until: string | null
          new_lesson: boolean
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          quiz_reminder: boolean
          security: boolean
          sound_enabled: boolean
          streak_reminder: boolean
          system: boolean
          timezone: string
          updated_at: string
          user_id: string
          vibration_enabled: boolean
        }
        Insert: {
          achievement?: boolean
          ai_recommendation?: boolean
          announcement?: boolean
          assignment_deadline?: boolean
          challenge?: boolean
          chat_message?: boolean
          course_reminder?: boolean
          direct_message?: boolean
          high_priority_only?: boolean
          leaderboard_change?: boolean
          lesson_reminder?: boolean
          live_class?: boolean
          mentor_reply?: boolean
          mute_until?: string | null
          new_lesson?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          quiz_reminder?: boolean
          security?: boolean
          sound_enabled?: boolean
          streak_reminder?: boolean
          system?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
          vibration_enabled?: boolean
        }
        Update: {
          achievement?: boolean
          ai_recommendation?: boolean
          announcement?: boolean
          assignment_deadline?: boolean
          challenge?: boolean
          chat_message?: boolean
          course_reminder?: boolean
          direct_message?: boolean
          high_priority_only?: boolean
          leaderboard_change?: boolean
          lesson_reminder?: boolean
          live_class?: boolean
          mentor_reply?: boolean
          mute_until?: string | null
          new_lesson?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          quiz_reminder?: boolean
          security?: boolean
          sound_enabled?: boolean
          streak_reminder?: boolean
          system?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
          vibration_enabled?: boolean
        }
        Relationships: []
      }
      notification_send_log: {
        Row: {
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notification_tokens: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          platform: string
          token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actions: Json
          body: string | null
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          data: Json
          id: string
          image_url: string | null
          link_url: string | null
          read: boolean
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          actions?: Json
          body?: string | null
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          data?: Json
          id?: string
          image_url?: string | null
          link_url?: string | null
          read?: boolean
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          actions?: Json
          body?: string | null
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          data?: Json
          id?: string
          image_url?: string | null
          link_url?: string | null
          read?: boolean
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          chat_id: string | null
          created_at: string
          creator_id: string | null
          id: string
          options: string[]
          question: string
          sender_id: string | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          creator_id?: string | null
          id?: string
          options?: string[]
          question: string
          sender_id?: string | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          creator_id?: string | null
          id?: string
          options?: string[]
          question?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "polls_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string | null
          content_html: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          is_published: boolean
          link_url: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          content?: string | null
          content_html?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          link_url?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          content?: string | null
          content_html?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          link_url?: string | null
          title?: string
          video_url?: string | null
        }
        Relationships: []
      }
      practical_submissions: {
        Row: {
          attempt_number: number
          code: string
          created_at: string
          feedback: string | null
          hidden_passed: number
          hint_level: number
          id: string
          lesson_id: string
          passed: boolean
          plagiarism_score: number | null
          practical_id: string
          runtime_ms: number | null
          score: number
          suspicious: boolean
          time_spent_seconds: number
          total_tests: number
          user_id: string
          visible_passed: number
        }
        Insert: {
          attempt_number?: number
          code: string
          created_at?: string
          feedback?: string | null
          hidden_passed?: number
          hint_level?: number
          id?: string
          lesson_id: string
          passed?: boolean
          plagiarism_score?: number | null
          practical_id: string
          runtime_ms?: number | null
          score?: number
          suspicious?: boolean
          time_spent_seconds?: number
          total_tests?: number
          user_id: string
          visible_passed?: number
        }
        Update: {
          attempt_number?: number
          code?: string
          created_at?: string
          feedback?: string | null
          hidden_passed?: number
          hint_level?: number
          id?: string
          lesson_id?: string
          passed?: boolean
          plagiarism_score?: number | null
          practical_id?: string
          runtime_ms?: number | null
          score?: number
          suspicious?: boolean
          time_spent_seconds?: number
          total_tests?: number
          user_id?: string
          visible_passed?: number
        }
        Relationships: [
          {
            foreignKeyName: "practical_submissions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practical_submissions_practical_id_fkey"
            columns: ["practical_id"]
            isOneToOne: false
            referencedRelation: "lesson_practicals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_locked: boolean
          address: string | null
          avatar_url: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string | null
          full_name: string
          id: string
          locked_at: string | null
          other_names: string | null
          phone: string | null
          registration_number: string | null
          second_name: string | null
          state: string | null
          town: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_locked?: boolean
          address?: string | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          locked_at?: string | null
          other_names?: string | null
          phone?: string | null
          registration_number?: string | null
          second_name?: string | null
          state?: string | null
          town?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_locked?: boolean
          address?: string | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          locked_at?: string | null
          other_names?: string | null
          phone?: string | null
          registration_number?: string | null
          second_name?: string | null
          state?: string | null
          town?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "public_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_likes: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_likes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "public_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      public_projects: {
        Row: {
          allow_clone: boolean
          created_at: string
          description: string | null
          files: Json
          id: string
          is_public: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_clone?: boolean
          created_at?: string
          description?: string | null
          files?: Json
          id?: string
          is_public?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_clone?: boolean
          created_at?: string
          description?: string | null
          files?: Json
          id?: string
          is_public?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sandbox_projects: {
        Row: {
          code: string | null
          created_at: string
          id: string
          language: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          language?: string | null
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          language?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stickers: {
        Row: {
          created_at: string
          id: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      student_projects: {
        Row: {
          course_id: string | null
          created_at: string
          description: string | null
          feedback: string | null
          file_url: string | null
          graded: boolean
          graded_at: string | null
          id: string
          mark: number | null
          name: string
          public_project_id: string | null
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          feedback?: string | null
          file_url?: string | null
          graded?: boolean
          graded_at?: string | null
          id?: string
          mark?: number | null
          name: string
          public_project_id?: string | null
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          feedback?: string | null
          file_url?: string | null
          graded?: boolean
          graded_at?: string | null
          id?: string
          mark?: number | null
          name?: string
          public_project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_projects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_projects_public_project_id_fkey"
            columns: ["public_project_id"]
            isOneToOne: false
            referencedRelation: "public_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_signals: {
        Row: {
          active_hour_histogram: number[]
          current_streak_days: number
          last_active_at: string
          last_reengagement_at: string | null
          last_streak_at: string | null
          lessons_completed_24h: number
          notifications_clicked_24h: number
          notifications_ignored_24h: number
          notifications_sent_24h: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_hour_histogram?: number[]
          current_streak_days?: number
          last_active_at?: string
          last_reengagement_at?: string | null
          last_streak_at?: string | null
          lessons_completed_24h?: number
          notifications_clicked_24h?: number
          notifications_ignored_24h?: number
          notifications_sent_24h?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_hour_histogram?: number[]
          current_streak_days?: number
          last_active_at?: string
          last_reengagement_at?: string | null
          last_streak_at?: string | null
          lessons_completed_24h?: number
          notifications_clicked_24h?: number
          notifications_ignored_24h?: number
          notifications_sent_24h?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          is_online: boolean
          last_seen: string
          user_id: string
        }
        Insert: {
          is_online?: boolean
          last_seen?: string
          user_id: string
        }
        Update: {
          is_online?: boolean
          last_seen?: string
          user_id?: string
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_xp: {
        Row: {
          badges: Json
          current_streak: number
          last_activity_date: string | null
          level: number
          longest_streak: number
          practicals_attempted: number
          practicals_passed: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          badges?: Json
          current_streak?: number
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          practicals_attempted?: number
          practicals_passed?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          badges?: Json
          current_streak?: number
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          practicals_attempted?: number
          practicals_passed?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_challenge_questions: {
        Args: { _course_id: string }
        Returns: {
          correct_answer: string
          course_id: string
          created_at: string
          id: string
          options: string[] | null
          question_text: string
          question_type: Database["public"]["Enums"]["challenge_question_type"]
        }[]
        SetofOptions: {
          from: "*"
          to: "challenge_questions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_exam_questions: {
        Args: { _exam_id: string }
        Returns: {
          correct_answer: string | null
          created_at: string
          exam_id: string
          id: string
          options: string[] | null
          order_index: number
          part: string
          question_text: string
        }[]
        SetofOptions: {
          from: "*"
          to: "exam_questions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_profiles: {
        Args: never
        Returns: {
          account_locked: boolean
          address: string | null
          avatar_url: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string | null
          full_name: string
          id: string
          locked_at: string | null
          other_names: string | null
          phone: string | null
          registration_number: string | null
          second_name: string | null
          state: string | null
          town: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      award_xp: {
        Args: { _amount: number; _passed: boolean }
        Returns: {
          badges: Json
          current_streak: number
          last_activity_date: string | null
          level: number
          longest_streak: number
          practicals_attempted: number
          practicals_passed: number
          updated_at: string
          user_id: string
          xp: number
        }
        SetofOptions: {
          from: "*"
          to: "user_xp"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_challenge_answer: {
        Args: { _answer: string; _qid: string }
        Returns: boolean
      }
      find_user_by_email_or_reg: { Args: { _input: string }; Returns: string }
      get_my_profile: {
        Args: never
        Returns: {
          account_locked: boolean
          address: string | null
          avatar_url: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string | null
          full_name: string
          id: string
          locked_at: string | null
          other_names: string | null
          phone: string | null
          registration_number: string | null
          second_name: string | null
          state: string | null
          town: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_notification_analytics: {
        Args: { _days?: number }
        Returns: {
          category: string
          clicked: number
          ctr: number
          delivered: number
          dismissed: number
          failed: number
        }[]
      }
      get_one_admin: { Args: never; Returns: string }
      grade_exam_obj_answers: {
        Args: { _answers: Json; _exam_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_chat_member: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      is_lesson_practical_complete: {
        Args: { _lesson: string; _user: string }
        Returns: boolean
      }
      start_admin_chat: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "student"
      attendance_status: "present" | "absent"
      call_status: "pending" | "active" | "ended" | "missed"
      call_type: "video" | "voice"
      cert_status: "waiting" | "awarded" | "revoked"
      challenge_question_type:
        | "multiple_choice"
        | "short_answer"
        | "fill_blank"
        | "syntax_correction"
      challenge_status:
        | "pending"
        | "active"
        | "completed"
        | "cancelled"
        | "rejected"
        | "accepted"
      exam_type: "exam" | "assignment"
      friend_status: "pending" | "accepted" | "rejected"
      marking_status: "pending" | "queued" | "grading" | "graded"
      notification_category:
        | "new_lesson"
        | "challenge"
        | "security"
        | "announcement"
        | "achievement"
        | "live_class"
        | "system"
        | "chat_message"
        | "lesson_reminder"
        | "course_reminder"
        | "assignment_deadline"
        | "quiz_reminder"
        | "direct_message"
        | "mentor_reply"
        | "streak_reminder"
        | "leaderboard_change"
        | "ai_recommendation"
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
      app_role: ["admin", "student"],
      attendance_status: ["present", "absent"],
      call_status: ["pending", "active", "ended", "missed"],
      call_type: ["video", "voice"],
      cert_status: ["waiting", "awarded", "revoked"],
      challenge_question_type: [
        "multiple_choice",
        "short_answer",
        "fill_blank",
        "syntax_correction",
      ],
      challenge_status: [
        "pending",
        "active",
        "completed",
        "cancelled",
        "rejected",
        "accepted",
      ],
      exam_type: ["exam", "assignment"],
      friend_status: ["pending", "accepted", "rejected"],
      marking_status: ["pending", "queued", "grading", "graded"],
      notification_category: [
        "new_lesson",
        "challenge",
        "security",
        "announcement",
        "achievement",
        "live_class",
        "system",
        "chat_message",
        "lesson_reminder",
        "course_reminder",
        "assignment_deadline",
        "quiz_reminder",
        "direct_message",
        "mentor_reply",
        "streak_reminder",
        "leaderboard_change",
        "ai_recommendation",
      ],
    },
  },
} as const
