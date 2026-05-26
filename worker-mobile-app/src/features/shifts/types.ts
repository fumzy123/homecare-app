export type ShiftCompletionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface ShiftWorkerSummary {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface ShiftClientSummary {
  id: string;
  first_name: string;
  last_name: string;
}

export interface ShiftOccurrence {
  shift_id: string;
  modification_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  completion_status: ShiftCompletionStatus;
  is_modification: boolean;
  is_recurring: boolean;
  worker: ShiftWorkerSummary;
  client: ShiftClientSummary;
  location: string | null;
  notes: string | null;
  recurrence_end_date: string | null;
  recurrence_frequency: string | null;
  recurrence_days_of_week: string[] | null;
}
