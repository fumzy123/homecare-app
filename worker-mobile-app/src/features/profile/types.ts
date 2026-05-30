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

export type ComplianceDocumentType =
  | 'first_aid_cpr'
  | 'criminal_record_check'
  | 'vulnerable_sector_check'
  | 'drivers_license'
  | 'child_access_check'
  | 'tb_test'
  | 'immunization_record'
  | 'auto_insurance'
  | 'work_permit'
  | 'psw_certificate';

export const DOCUMENT_TYPE_LABELS: Record<ComplianceDocumentType, string> = {
  first_aid_cpr: 'First Aid / CPR',
  criminal_record_check: 'Criminal Record Check',
  vulnerable_sector_check: 'Vulnerable Sector Check',
  drivers_license: "Driver's License",
  child_access_check: 'Child Access Check',
  tb_test: 'TB Test',
  immunization_record: 'Immunization Record',
  auto_insurance: 'Auto Insurance',
  work_permit: 'Work Permit',
  psw_certificate: 'PSW Certificate',
};

export const ALL_DOCUMENT_TYPES: ComplianceDocumentType[] = [
  'first_aid_cpr',
  'criminal_record_check',
  'vulnerable_sector_check',
  'drivers_license',
  'child_access_check',
  'tb_test',
  'immunization_record',
  'auto_insurance',
  'work_permit',
  'psw_certificate',
];

export interface Credential {
  id: string;
  org_member_id: string;
  document_type: ComplianceDocumentType;
  expiry_date: string | null;
  file_url: string | null;
  uploaded_at: string;
}

export interface WorkerProfileUpdatePayload {
  phone_number?: string | null;
  gender?: string | null;
  street?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  languages?: string[] | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
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
