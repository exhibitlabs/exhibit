/**
 * Display transform for text the agent wrote (brief headline, summary, reasoning points): swaps the
 * em dash for a colon or comma. Never apply it to the response letter, which must read exactly as filed.
 */
export const plain = (s: string, sep = ": ") => s.replace(/\s+—\s+/g, sep).replace(/—/g, ", ");
