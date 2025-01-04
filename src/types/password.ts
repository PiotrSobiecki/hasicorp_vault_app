export interface Password {
  id: string;
  title: string;
  username: string;
  password: string;
  key?: string;
  url?: string;
  notes?: string;
  twoFactorCode?: string;
}

export interface PasswordFormData {
  title: string;
  username: string;
  password: string;
  key: string;
  passwordLength: number;
  twoFactorCode: string;
  url: string;
  notes: string;
}
