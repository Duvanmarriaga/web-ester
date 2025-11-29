export interface User {
  id: number;
  name: string;
  email: string;
  email_verified_at: string | null;
  type: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  companies?: UserCompany[]; // IDs de compañías asignadas
}

export interface UserCompany {
  id: number;
  name: string;
}

export interface UserCreate {
  name: string;
  email: string;
  password: string;
  type: string;
  companies_ids?: number[]; // IDs de compañías a asignar
}

export interface UserUpdate {
  id: number;
  name?: string;
  email?: string;
  type?: UserType;
  companies_ids?: number[]; // IDs de compañías a asignar
}

export enum UserType {
  ADMIN = 'admin',
  CLIENT = 'client',
}

// Tipo para las opciones del selector de tipo de usuario
export interface UserTypeOption {
  id: UserType;
  name: string;
}

// Constante con los tipos de usuario y sus nombres en español
export const USER_TYPES: UserTypeOption[] = [
  { id: UserType.CLIENT, name: 'Cliente' },
  { id: UserType.ADMIN, name: 'Administrador' },
];
