export type ShiftCompletionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type ServiceType = 'personal_care' | 'companionship' | 'respite' | 'nursing' | 'homemaking';

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
  date_of_birth: string;
  street: string;
  city: string;
  medical_conditions: string | null;
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
  service_type: ServiceType | null;
  worker: ShiftWorkerSummary;
  client: ShiftClientSummary;
  location: string | null;
  notes: string | null;
  recurrence_end_date: string | null;
  recurrence_frequency: string | null;
  recurrence_days_of_week: string[] | null;
}

export interface WorkerShiftDetail {
  shift_id: string;
  occurrence_date: string;
  modification_id: string | null;
  start_time: string;
  end_time: string;
  completion_status: ShiftCompletionStatus;
  service_type: ServiceType | null;
  client: ShiftClientSummary;
  location: string | null;
  instructions: string | null;
  is_modified: boolean;
}
