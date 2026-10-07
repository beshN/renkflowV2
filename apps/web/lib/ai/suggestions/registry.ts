import 'server-only';

/**
 * Every suggestion kind registers itself on import; this file is the one list of them. The queue
 * shows nothing until a kind is registered here, so no unfinished kind can appear in the panel.
 * Planned order: cutting plan (Faz 4 defaults) → stock threshold + purchase draft → PDF-based.
 */
export {};
