export interface SupabaseQuestionRow {
  id: number;
  prompt: string;
  type: string;
  options: unknown;
  required: boolean;
  position: number;
  depends_on: number | null;
  condition_type: string | null;
  condition_value: string | null;
  follow_up_option: string | null;
  follow_up_placeholder: string | null;
  placeholder: string | null;
  multiple_max: number | null;
  response_text: string | null;
  response_trigger: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseResponseRow {
  id: number;
  answers: Record<string, unknown>;
  created_at: string;
}
