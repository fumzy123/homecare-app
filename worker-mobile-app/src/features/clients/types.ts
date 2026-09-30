export interface WorkerClient {
  id: string;
  first_name: string;
  last_name: string;
  city: string;
  status: 'active' | 'on_hold' | 'discharged';
}

export interface WorkerClientProfile extends WorkerClient {
  date_of_birth: string;
  street: string;
  province: string;
  postal_code: string;
  phone_number: string | null;
  medical_conditions: string | null;
  allergies: string | null;
  medications: string | null;
  special_instructions: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
}
