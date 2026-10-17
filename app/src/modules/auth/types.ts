export interface ChangePasswordErrors {
  current?: string;
  new?: string;
  confirm?: string;
}

export interface SetPasswordErrors {
  code?: string;
  new?: string;
  confirm?: string;
}

export interface ForgotPasswordErrors {
  email?: string;
  code?: string;
  password?: string;
  confirm?: string;
}
