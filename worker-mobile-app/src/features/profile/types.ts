export interface WorkerProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  role: string;
  hire_date: string | null;
  max_hours_per_week: number | null;
}

export interface WorkerStats {
  hours_this_week: number;
  weekly_hour_cap: number | null;
  punctuality_streak: number | null;
  care_log_streak: number | null;
}
