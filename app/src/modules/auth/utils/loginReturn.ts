import { createReturnPath } from './returnPath';

/**
 * The page a signed-out visitor asked for, opened once they signed in,
 * whichever flow (password, passkey, MFA, Google) got them there.
 */
const loginReturn = createReturnPath('olauda:login-return');

export const saveLoginReturn = loginReturn.save;
export const clearLoginReturn = loginReturn.clear;
export const consumeLoginReturn = loginReturn.consume;
