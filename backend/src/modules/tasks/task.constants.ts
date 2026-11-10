/**
 * Limits used by both the server schemas and the UI. Kept in a module without Zod
 * so client code can import a number without pulling the validator into the bundle.
 */
export const TITLE_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 1000;
export const LIST_DEFAULT_LIMIT = 8;
export const LIST_MAX_LIMIT = 50;
