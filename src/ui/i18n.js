import { state } from '../state.js';

// Returns the copy in the current language. Falls back to English while the Arabic isn't written yet.
export function t(entry) {
  return entry[state.lang] || entry.en;
}
