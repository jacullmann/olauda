import type { SecondFactorProof } from '@/api/schema';

/** The authenticator app's code, or a recovery code standing in for it. */
export type SecondFactorMode = 'code' | 'recoveryCode';

/** What the user has typed so far, before it is a complete proof. */
export interface SecondFactorDraft {
  mode: SecondFactorMode;
  value: string;
}

const CODE_PATTERN = /^\d{6}$/;
/** Ten symbols, shown as two groups of five ("ABCDE-FGHJK"). */
const RECOVERY_CODE_PATTERN = /^[0-9A-Z]{10}$/i;

export function emptySecondFactor(
  mode: SecondFactorMode = 'code',
): SecondFactorDraft {
  return { mode, value: '' };
}

/**
 * The proof the draft makes once it is complete, else `null`. Recovery codes
 * are sent as typed; the server forgives spaces, dashes and case.
 */
export function secondFactorProof(
  draft: SecondFactorDraft,
): SecondFactorProof | null {
  const value = draft.value.trim();

  if (draft.mode === 'code') {
    return CODE_PATTERN.test(value) ? { code: value } : null;
  }

  const symbols = value.replace(/[\s-]/g, '');
  return RECOVERY_CODE_PATTERN.test(symbols) ? { recoveryCode: value } : null;
}
