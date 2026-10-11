import { createReturnPath } from './returnPath';

/**
 * Remembers where the user was when they left to confirm an action with
 * Google, so the round trip brings them back there instead of to the start.
 */
const reauthReturn = createReturnPath('olauda:reauth-return');

export const saveReauthReturn = reauthReturn.save;
export const consumeReauthReturn = reauthReturn.consume;
