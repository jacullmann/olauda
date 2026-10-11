import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';

export interface MfaSetupResponse {
  ok: boolean;
  otpauthUrl: string;
  secret: string;
  expiresAt: string;
}

export interface MfaStatusResponse {
  ok: boolean;
  mfaEnabled: boolean;
  /** Unused recovery codes; `null` while two-factor authentication is off. */
  recoveryCodesLeft: number | null;
}

/** Recovery codes in display form, returned once when they are created. */
export interface RecoveryCodesResponse {
  ok: boolean;
  recoveryCodes: string[];
}

/** What a user offers as their second factor. */
export type SecondFactorProof = { code: string } | { recoveryCode: string };

export interface MfaLoginResponse {
  ok: boolean;
  /** Set when a recovery code was used: how many are left. */
  recoveryCodesLeft: number | null;
}

/** The ways an account can sign in, and so confirm a sensitive action. */
export interface SignInMethods {
  password: boolean;
  passkeys: number;
  google: boolean;
  twoFactor: boolean;
}

export interface ReauthStatus {
  methods: SignInMethods;
  /** Until when the last confirmation counts; `null` once it lapsed. */
  recentUntil: string | null;
}

export interface MfaChallengeResponse {
  expiresIn: number;
  /** Whether the account has a passkey to answer with instead of a code. */
  passkeyAvailable: boolean;
}

export interface MfaVerifyResult {
  ok: boolean;
  csrfToken?: string;
  error?: string;
}

export interface MfaActionResult {
  ok: boolean;
  error?: string;
}

export interface LoginResult {
  ok: boolean;
  csrfToken?: string | null;
  error?: string;
}

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

export interface Passkey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  /** Base64url, as the browser reports it. */
  credentialId: string;
}

export interface PasskeyListResponse {
  passkeys: Passkey[];
  rpId: string;
  /** The user handle every passkey of the account carries, base64url. */
  userHandle: string;
}

export interface PasskeyRegistrationResponse {
  options: PublicKeyCredentialCreationOptionsJSON;
}

export interface PasskeyChallengeResponse {
  challengeId: string;
  options: PublicKeyCredentialRequestOptionsJSON;
}
