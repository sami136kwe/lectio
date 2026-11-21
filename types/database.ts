
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
            "bible_chapter_stats": {
                  Row: {
                    "aligned": boolean,"book_code": string,"chapter": number,"expected_count": number,"verse_count": number,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aligned": boolean,"book_code": string,"chapter": number,"expected_count": number,"verse_count": number,"version_id": string
                  }
                  Update: {
                    "aligned"?: boolean,"book_code"?: string,"chapter"?: number,"expected_count"?: number,"verse_count"?: number,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bible_chapter_stats_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "bible_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"bible_verses": {
                  Row: {
                    "book_code": string,"chapter": number,"id": number,"language": string,"search": unknown,"text": string,"verse": number,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "book_code": string,"chapter": number,"id"?: never,"language": string,"search"?: never,"text": string,"verse": number,"version_id": string
                  }
                  Update: {
                    "book_code"?: string,"chapter"?: number,"id"?: never,"language"?: string,"search"?: never,"text"?: string,"verse"?: number,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bible_verses_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "bible_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"bible_versions": {
                  Row: {
                    "attribution": string,"code": string,"id": string,"imported_at": string | null,"language": string,"license": string,"name": string,"scope": string,"source_sha256": string,"source_url": string,"textual_tradition": string,"verse_count": number,"versification": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attribution": string,"code": string,"id"?: string,"imported_at"?: string | null,"language": string,"license": string,"name": string,"scope": string,"source_sha256": string,"source_url": string,"textual_tradition": string,"verse_count"?: number,"versification": string
                  }
                  Update: {
                    "attribution"?: string,"code"?: string,"id"?: string,"imported_at"?: string | null,"language"?: string,"license"?: string,"name"?: string,"scope"?: string,"source_sha256"?: string,"source_url"?: string,"textual_tradition"?: string,"verse_count"?: number,"versification"?: string
                  }
                  Relationships: [
                    
                  ]
                },"card_perspectives": {
                  Row: {
                    "body": string,"card_id": string,"created_at": string,"divergence_summary": string | null,"divergence_topic": string | null,"divergence_type": string,"embedding": string | null,"id": string,"language": string,"review_status": string,"reviewed_at": string | null,"reviewer_note": string | null,"search": unknown,"tradition": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"card_id": string,"created_at"?: string,"divergence_summary"?: string | null,"divergence_topic"?: string | null,"divergence_type"?: string,"embedding"?: string | null,"id"?: string,"language": string,"review_status"?: string,"reviewed_at"?: string | null,"reviewer_note"?: string | null,"search"?: never,"tradition": string
                  }
                  Update: {
                    "body"?: string,"card_id"?: string,"created_at"?: string,"divergence_summary"?: string | null,"divergence_topic"?: string | null,"divergence_type"?: string,"embedding"?: string | null,"id"?: string,"language"?: string,"review_status"?: string,"reviewed_at"?: string | null,"reviewer_note"?: string | null,"search"?: never,"tradition"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_perspectives_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "card_details"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_perspectives_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_perspectives_tradition_fkey"
      columns: ["tradition"]
isOneToOne: false
      referencedRelation: "traditions"
      referencedColumns: ["code"]
    }
                  ]
                },"card_reviews": {
                  Row: {
                    "card_id": string,"ease_factor": number,"interval_days": number,"last_reviewed_at": string | null,"next_review_at": string,"rating": number | null,"repetitions": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "card_id": string,"ease_factor"?: number,"interval_days"?: number,"last_reviewed_at"?: string | null,"next_review_at"?: string,"rating"?: number | null,"repetitions"?: number,"user_id": string
                  }
                  Update: {
                    "card_id"?: string,"ease_factor"?: number,"interval_days"?: number,"last_reviewed_at"?: string | null,"next_review_at"?: string,"rating"?: number | null,"repetitions"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_reviews_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "card_details"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_reviews_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    }
                  ]
                },"card_seasons": {
                  Row: {
                    "card_id": string,"season_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "card_id": string,"season_id": string
                  }
                  Update: {
                    "card_id"?: string,"season_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_seasons_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "card_details"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_seasons_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_seasons_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "liturgical_seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"card_translations": {
                  Row: {
                    "action_step": string,"card_id": string,"created_at": string,"embedding": string | null,"id": string,"key_words": NonNullable<Json>,"language": string,"plain_explanation": string,"search": unknown,"status": string,"style_score": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action_step": string,"card_id": string,"created_at"?: string,"embedding"?: string | null,"id"?: string,"key_words"?: NonNullable<Json>,"language": string,"plain_explanation": string,"search"?: never,"status"?: string,"style_score"?: number | null
                  }
                  Update: {
                    "action_step"?: string,"card_id"?: string,"created_at"?: string,"embedding"?: string | null,"id"?: string,"key_words"?: NonNullable<Json>,"language"?: string,"plain_explanation"?: string,"search"?: never,"status"?: string,"style_score"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_translations_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "card_details"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_translations_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    }
                  ]
                },"card_views": {
                  Row: {
                    "action": string,"card_id": string,"created_at": string,"id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"card_id": string,"created_at"?: string,"id"?: never,"user_id": string
                  }
                  Update: {
                    "action"?: string,"card_id"?: string,"created_at"?: string,"id"?: never,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_views_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "card_details"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_views_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    }
                  ]
                },"cards": {
                  Row: {
                    "category_id": string,"content_hash": string,"created_at": string,"difficulty": number,"id": string,"ingestion_run_id": string | null,"passage_id": string,"passage_text_hash": string,"quality_score": number | null,"rejection_reason": string | null,"source_type": string,"stash_count": number,"status": string,"theology_score": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"content_hash": string,"created_at"?: string,"difficulty"?: number,"id"?: string,"ingestion_run_id"?: string | null,"passage_id": string,"passage_text_hash": string,"quality_score"?: number | null,"rejection_reason"?: string | null,"source_type"?: string,"stash_count"?: number,"status"?: string,"theology_score"?: number | null
                  }
                  Update: {
                    "category_id"?: string,"content_hash"?: string,"created_at"?: string,"difficulty"?: number,"id"?: string,"ingestion_run_id"?: string | null,"passage_id"?: string,"passage_text_hash"?: string,"quality_score"?: number | null,"rejection_reason"?: string | null,"source_type"?: string,"stash_count"?: number,"status"?: string,"theology_score"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cards_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cards_ingestion_run_id_fkey"
      columns: ["ingestion_run_id"]
isOneToOne: false
      referencedRelation: "ingestion_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cards_passage_id_fkey"
      columns: ["passage_id"]
isOneToOne: false
      referencedRelation: "passages"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"description": string | null,"description_en": string | null,"icon": string | null,"id": string,"name_en": string,"name_fr": string,"parent_id": string | null,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"description_en"?: string | null,"icon"?: string | null,"id"?: string,"name_en": string,"name_fr": string,"parent_id"?: string | null,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"description_en"?: string | null,"icon"?: string | null,"id"?: string,"name_en"?: string,"name_fr"?: string,"parent_id"?: string | null,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"daily_deck": {
                  Row: {
                    "card_id": string,"deck_date": string,"position": number,"seen_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "card_id": string,"deck_date": string,"position": number,"seen_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "card_id"?: string,"deck_date"?: string,"position"?: number,"seen_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_deck_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "card_details"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "daily_deck_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    }
                  ]
                },"daily_deck_state": {
                  Row: {
                    "current_position": number,"deck_date": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "current_position"?: number,"deck_date": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "current_position"?: number,"deck_date"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ingestion_runs": {
                  Row: {
                    "cards_created": number,"cards_rejected": number,"cost_usd": number,"details": NonNullable<Json>,"errors": NonNullable<Json>,"finished_at": string | null,"id": string,"model_calls": number,"scope": string | null,"source": string,"started_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cards_created"?: number,"cards_rejected"?: number,"cost_usd"?: number,"details"?: NonNullable<Json>,"errors"?: NonNullable<Json>,"finished_at"?: string | null,"id"?: string,"model_calls"?: number,"scope"?: string | null,"source": string,"started_at"?: string,"status"?: string
                  }
                  Update: {
                    "cards_created"?: number,"cards_rejected"?: number,"cost_usd"?: number,"details"?: NonNullable<Json>,"errors"?: NonNullable<Json>,"finished_at"?: string | null,"id"?: string,"model_calls"?: number,"scope"?: string | null,"source"?: string,"started_at"?: string,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"liturgical_seasons": {
                  Row: {
                    "description_en": string | null,"description_fr": string | null,"id": string,"name_en": string,"name_fr": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description_en"?: string | null,"description_fr"?: string | null,"id"?: string,"name_en": string,"name_fr": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "description_en"?: string | null,"description_fr"?: string | null,"id"?: string,"name_en"?: string,"name_fr"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"liturgical_uses": {
                  Row: {
                    "book_code": string,"calendar": string,"chapter_end": number,"chapter_start": number,"description_en": string,"description_fr": string,"id": string,"occasion_type": string,"passage_id": string | null,"rite": string,"season_id": string | null,"source_id": string | null,"tradition": string,"verified": boolean,"verse_end": number,"verse_start": number
                  }
                  ComputedFields: never
                  Insert: {
                    "book_code": string,"calendar": string,"chapter_end": number,"chapter_start": number,"description_en": string,"description_fr": string,"id"?: string,"occasion_type": string,"passage_id"?: string | null,"rite": string,"season_id"?: string | null,"source_id"?: string | null,"tradition": string,"verified"?: boolean,"verse_end": number,"verse_start": number
                  }
                  Update: {
                    "book_code"?: string,"calendar"?: string,"chapter_end"?: number,"chapter_start"?: number,"description_en"?: string,"description_fr"?: string,"id"?: string,"occasion_type"?: string,"passage_id"?: string | null,"rite"?: string,"season_id"?: string | null,"source_id"?: string | null,"tradition"?: string,"verified"?: boolean,"verse_end"?: number,"verse_start"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "liturgical_uses_passage_id_fkey"
      columns: ["passage_id"]
isOneToOne: false
      referencedRelation: "passages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "liturgical_uses_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "liturgical_seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "liturgical_uses_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "liturgical_uses_tradition_fkey"
      columns: ["tradition"]
isOneToOne: false
      referencedRelation: "traditions"
      referencedColumns: ["code"]
    }
                  ]
                },"passages": {
                  Row: {
                    "book_code": string,"chapter_end": number,"chapter_start": number,"created_at": string,"id": string,"psalm_number_hebrew": number | null,"psalm_number_lxx": string | null,"sort_key": number,"verse_end": number,"verse_start": number
                  }
                  ComputedFields: never
                  Insert: {
                    "book_code": string,"chapter_end": number,"chapter_start": number,"created_at"?: string,"id"?: string,"psalm_number_hebrew"?: number | null,"psalm_number_lxx"?: string | null,"sort_key": number,"verse_end": number,"verse_start": number
                  }
                  Update: {
                    "book_code"?: string,"chapter_end"?: number,"chapter_start"?: number,"created_at"?: string,"id"?: string,"psalm_number_hebrew"?: number | null,"psalm_number_lxx"?: string | null,"sort_key"?: number,"verse_end"?: number,"verse_start"?: number
                  }
                  Relationships: [
                    
                  ]
                },"perspective_sources": {
                  Row: {
                    "perspective_id": string,"quote": string | null,"source_id": string,"usage": string
                  }
                  ComputedFields: never
                  Insert: {
                    "perspective_id": string,"quote"?: string | null,"source_id": string,"usage": string
                  }
                  Update: {
                    "perspective_id"?: string,"quote"?: string | null,"source_id"?: string,"usage"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "perspective_sources_perspective_id_fkey"
      columns: ["perspective_id"]
isOneToOne: false
      referencedRelation: "card_perspectives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "perspective_sources_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "sources"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "bible_version_en": string,"bible_version_fr": string,"created_at": string,"daily_goal": number,"daily_limit": string,"display_name": string | null,"id": string,"include_reread": boolean,"interests": (string)[],"language": string,"last_active_date": string | null,"longest_streak": number,"onboarded": boolean,"reread_ratio": number,"reviewed_only": boolean,"show_greek": boolean,"streak_count": number,"timezone": string,"tradition_view": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bible_version_en"?: string,"bible_version_fr"?: string,"created_at"?: string,"daily_goal"?: number,"daily_limit"?: string,"display_name"?: string | null,"id": string,"include_reread"?: boolean,"interests"?: (string)[],"language"?: string,"last_active_date"?: string | null,"longest_streak"?: number,"onboarded"?: boolean,"reread_ratio"?: number,"reviewed_only"?: boolean,"show_greek"?: boolean,"streak_count"?: number,"timezone"?: string,"tradition_view"?: string,"updated_at"?: string
                  }
                  Update: {
                    "bible_version_en"?: string,"bible_version_fr"?: string,"created_at"?: string,"daily_goal"?: number,"daily_limit"?: string,"display_name"?: string | null,"id"?: string,"include_reread"?: boolean,"interests"?: (string)[],"language"?: string,"last_active_date"?: string | null,"longest_streak"?: number,"onboarded"?: boolean,"reread_ratio"?: number,"reviewed_only"?: boolean,"show_greek"?: boolean,"streak_count"?: number,"timezone"?: string,"tradition_view"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"psalm_numbering": {
                  Row: {
                    "hebrew_psalm": number,"hebrew_verse_end": number,"hebrew_verse_start": number,"id": number,"lxx_psalm": number,"lxx_verse_offset": number,"note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "hebrew_psalm": number,"hebrew_verse_end": number,"hebrew_verse_start": number,"id": number,"lxx_psalm": number,"lxx_verse_offset"?: number,"note"?: string | null
                  }
                  Update: {
                    "hebrew_psalm"?: number,"hebrew_verse_end"?: number,"hebrew_verse_start"?: number,"id"?: number,"lxx_psalm"?: number,"lxx_verse_offset"?: number,"note"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"reading_progress": {
                  Row: {
                    "book_code": string,"last_card_id": string | null,"last_sort_key": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "book_code": string,"last_card_id"?: string | null,"last_sort_key"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "book_code"?: string,"last_card_id"?: string | null,"last_sort_key"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reading_progress_last_card_id_fkey"
      columns: ["last_card_id"]
isOneToOne: false
      referencedRelation: "card_details"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reading_progress_last_card_id_fkey"
      columns: ["last_card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    }
                  ]
                },"sources": {
                  Row: {
                    "author": string,"bible_refs": (string)[],"content_hash": string,"embedding": string | null,"id": string,"imported_at": string,"kind": string,"language": string,"license": string,"region": string | null,"search": unknown,"section": string,"text": string | null,"tradition": string,"url": string,"verified": boolean,"work": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author": string,"bible_refs"?: (string)[],"content_hash": string,"embedding"?: string | null,"id"?: string,"imported_at"?: string,"kind": string,"language": string,"license": string,"region"?: string | null,"search"?: never,"section": string,"text"?: string | null,"tradition": string,"url": string,"verified"?: boolean,"work": string
                  }
                  Update: {
                    "author"?: string,"bible_refs"?: (string)[],"content_hash"?: string,"embedding"?: string | null,"id"?: string,"imported_at"?: string,"kind"?: string,"language"?: string,"license"?: string,"region"?: string | null,"search"?: never,"section"?: string,"text"?: string | null,"tradition"?: string,"url"?: string,"verified"?: boolean,"work"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sources_tradition_fkey"
      columns: ["tradition"]
isOneToOne: false
      referencedRelation: "traditions"
      referencedColumns: ["code"]
    }
                  ]
                },"stashes": {
                  Row: {
                    "card_id": string,"created_at": string,"note": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "card_id": string,"created_at"?: string,"note"?: string | null,"user_id": string
                  }
                  Update: {
                    "card_id"?: string,"created_at"?: string,"note"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stashes_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "card_details"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stashes_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    }
                  ]
                },"traditions": {
                  Row: {
                    "code": string,"name_en": string,"name_fr": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"name_en": string,"name_fr": string,"sort_order"?: number
                  }
                  Update: {
                    "code"?: string,"name_en"?: string,"name_fr"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"user_card_state": {
                  Row: {
                    "card_id": string,"first_read_at": string,"is_stashed": boolean,"last_read_at": string,"read_count": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "card_id": string,"first_read_at"?: string,"is_stashed"?: boolean,"last_read_at"?: string,"read_count"?: number,"user_id": string
                  }
                  Update: {
                    "card_id"?: string,"first_read_at"?: string,"is_stashed"?: boolean,"last_read_at"?: string,"read_count"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_card_state_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "card_details"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_card_state_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    }
                  ]
                },"verse_memory": {
                  Row: {
                    "card_id": string,"created_at": string,"ease_factor": number,"interval_days": number,"last_reviewed_at": string | null,"mask_level": number,"next_review_at": string,"rating": number | null,"repetitions": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "card_id": string,"created_at"?: string,"ease_factor"?: number,"interval_days"?: number,"last_reviewed_at"?: string | null,"mask_level"?: number,"next_review_at"?: string,"rating"?: number | null,"repetitions"?: number,"user_id": string
                  }
                  Update: {
                    "card_id"?: string,"created_at"?: string,"ease_factor"?: number,"interval_days"?: number,"last_reviewed_at"?: string | null,"mask_level"?: number,"next_review_at"?: string,"rating"?: number | null,"repetitions"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "verse_memory_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "card_details"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verse_memory_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "card_details": {
                  Row: {
                    "action_step": string,"book_code": string,"category_icon": string | null,"category_id": string,"category_name_en": string,"category_name_fr": string,"category_slug": string,"chapter_end": number,"chapter_start": number,"created_at": string,"difficulty": number,"id": string,"key_words": NonNullable<Json>,"language": string,"main_category_id": string | null,"passage_id": string,"plain_explanation": string,"psalm_number_hebrew": number | null,"psalm_number_lxx": string | null,"quality_score": number | null,"sort_key": number,"source_type": string,"stash_count": number,"status": string,"style_score": number | null,"theology_score": number | null,"translation_id": string,"verse_end": number,"verse_start": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "cards_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cards_passage_id_fkey"
      columns: ["passage_id"]
isOneToOne: false
      referencedRelation: "passages"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "book_progress":
{ Args: { "p_language": string }; Returns: {
              "book_code": string,"read": number,"total": number
            }[]
                           },
"category_card_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "category_id": string,"language": string,"slug": string,"status": string,"total": number
            }[]
                           },
"category_progress":
{ Args: Record<PropertyKey, never>; Returns: {
              "category_id": string,"completed": number,"icon": string,"name_en": string,"name_fr": string,"reviewed": number,"seen": number,"slug": string,"stashed": number,"total": number
            }[]
                           },
"daily_challenge":
{ Args: { "p_day": string }; Returns: {
              "action_step": string,
"book_code": string,
"category_icon": string | null,
"category_id": string,
"category_name_en": string,
"category_name_fr": string,
"category_slug": string,
"chapter_end": number,
"chapter_start": number,
"created_at": string,
"difficulty": number,
"id": string,
"key_words": NonNullable<Json>,
"language": string,
"main_category_id": string | null,
"passage_id": string,
"plain_explanation": string,
"psalm_number_hebrew": number | null,
"psalm_number_lxx": string | null,
"quality_score": number | null,
"sort_key": number,
"source_type": string,
"stash_count": number,
"status": string,
"style_score": number | null,
"theology_score": number | null,
"translation_id": string,
"verse_end": number,
"verse_start": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "card_details"
        isOneToOne: false
        isSetofReturn: true
      } },
"feed_candidates":
{ Args: { "p_category_ids": (string)[],"p_include": boolean,"p_language": string,"p_limit"?: number }; Returns: {
              "id": string,"main_category_id": string,"rank_score": number
            }[]
                           },
"history_cards":
{ Args: { "p_category"?: string,"p_from"?: string,"p_language": string,"p_limit"?: number,"p_offset"?: number,"p_q"?: string,"p_stashed"?: boolean,"p_sub"?: string,"p_to"?: string }; Returns: {
              "card_id": string,"first_read_at": string,"is_stashed": boolean,"last_read_at": string,"read_count": number,"total_count": number
            }[]
                           },
"match_perspectives":
{ Args: { "match_count"?: number,"match_language": string,"match_threshold"?: number,"match_tradition": string,"query_embedding": string }; Returns: {
              "card_id": string,"similarity": number
            }[]
                           },
"match_sources":
{ Args: { "match_count"?: number,"match_tradition": string,"query_embedding": string }; Returns: {
              "id": string,"similarity": number
            }[]
                           },
"match_translations":
{ Args: { "match_count"?: number,"match_language": string,"match_threshold"?: number,"query_embedding": string }; Returns: {
              "card_id": string,"similarity": number
            }[]
                           },
"record_activity":
{ Args: { "p_day": string }; Returns: {
              "last_active_date": string,"longest_streak": number,"streak_count": number
            }[]
                           },
"reread_candidates":
{ Args: { "p_category"?: string,"p_exclude"?: (string)[],"p_language": string,"p_limit"?: number,"p_mode"?: string }; Returns: {
              "card_id": string,"last_read_at": string,"read_count": number
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
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
            
          }
        }
} as const
