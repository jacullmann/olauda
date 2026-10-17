import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import type { PasskeyChallengeDto, PasskeyRegistrationDto } from '@/api/schema';

// The API hands over the WebAuthn options in the browser's own JSON form,
// which it leaves untyped. The WebAuthn library defines that form, so its
// types take over here, where the options reach it.

export const requestOptions = (
  challenge: PasskeyChallengeDto,
): PublicKeyCredentialRequestOptionsJSON =>
  challenge.options as PublicKeyCredentialRequestOptionsJSON;

export const creationOptions = (
  registration: PasskeyRegistrationDto,
): PublicKeyCredentialCreationOptionsJSON =>
  registration.options as PublicKeyCredentialCreationOptionsJSON;
