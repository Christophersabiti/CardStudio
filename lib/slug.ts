import { customAlphabet } from "nanoid";

// Lowercase alphanumerics, no ambiguous characters removed for simplicity.
// 8 chars over a 36-symbol alphabet keeps slugs short but hard to guess.
const nano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 8);

export const newSlug = (): string => nano();
