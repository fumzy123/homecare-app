export interface WorkerProfile {
  id: string;
  // Identity
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  gender: string | null;
  date_of_birth: string | null;
  languages: string[] | null;
  // Employment
  role: string;
  employment_status: 'active' | 'on_leave' | 'terminated';
  employment_type: string | null;
  hire_date: string | null;
  has_vehicle: boolean | null;
  // Address
  street: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  // Scheduling & preferences
  availability: Record<string, unknown> | null;
  max_hours_per_week: number | null;
  pet_tolerance: string | null;
  preferred_client_types: string[] | null;
  // Compensation
  pay_rate: string | null;
  // Emergency contact
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
}

export interface WorkerStats {
  hours_this_week: number;
  weekly_hour_cap: number | null;
  hours_mtd: number;
  hours_ytd: number;
  overtime_mtd: number;
  overtime_ytd: number;
  punctuality_streak: number | null;
  care_log_streak: number | null;
}

export type CredentialCategory =
  | 'safety'
  | 'health'
  | 'emergency_response'
  | 'transportation'
  | 'eligibility'
  | 'qualification';

export interface Credential {
  id: string;
  org_member_id: string;
  name: string;
  category: CredentialCategory | null;
  issuer: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  is_required: boolean;
  file_url: string | null;
  uploaded_at: string;
}

export type CredentialStatus = 'valid' | 'expiring' | 'expired';

export function computeCredentialStatus(expiry_date: string | null): CredentialStatus {
  if (!expiry_date) return 'valid';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiry_date);
  if (expiry < today) return 'expired';
  const sixtyDaysOut = new Date(today);
  sixtyDaysOut.setDate(today.getDate() + 60);
  if (expiry <= sixtyDaysOut) return 'expiring';
  return 'valid';
}
