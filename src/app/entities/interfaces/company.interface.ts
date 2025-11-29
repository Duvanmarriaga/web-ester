export interface Company {
  id: number;
  name: string;
  identification_number: string;
  address: string;
  phone: string | null;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyCreate {
  name: string;
  identification_number: string;
  address: string;
  phone?: string | null;
  email: string;
}

export interface CompanyUpdate {
  id: number;
  name?: string;
  identification_number?: string;
  address?: string;
  phone?: string | null;
  email?: string;
}
