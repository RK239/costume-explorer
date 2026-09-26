import { state } from '../state.js';

// Language: English and Arabic. Every word on screen comes from content.json through t(), and
// every module that writes words registers a re-render with onLanguage(), so a switch rewrites
// the whole page at once. Arabic also turns the page right-to-left; the layout follows through CSS
// logical properties and the deliberate overrides in rtl.css (DECISIONS.md: RTL).

const listeners = [];

// Returns the copy in the current language. Falls back to English while the Arabic isn't written
// yet (the hotspot chapters wait for the copy pass); callers mark such text dir="auto".
export function t(entry) {
  return entry[state.lang] || entry.en;
}

// Numbers in the current language's digits: Eastern Arabic (٠١٢٣…) in Arabic (DECISIONS.md: RTL).
const EASTERN = '٠١٢٣٤٥٦٧٨٩';
export function num(n) {
  const text = String(n);
  return state.lang === 'ar' ? text.replace(/[0-9]/g, (d) => EASTERN[d]) : text;
}

export function onLanguage(listener) {
  listeners.push(listener);
}

// Switch at once: the language, the page's direction, and every word. Callers that want it
// seen as a move (the language button) wrap it in a transition; the idle reset calls it bare.
export function setLanguage(lang) {
  if (lang === state.lang) return;
  state.lang = lang;
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  for (const listener of listeners) listener(lang);
}

// The language button: one tap, always on screen, in the top corner at the inline end (above the
// headline in the attract state, above the story panel in a story), with Home under it. It names
// the other language in that language, so a visitor finds their own.
export function createLanguageSwitch({ parent, content, onSwitch }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'language';
  // The other language's name carries its own lang and direction on an inner span: on the button
  // itself, dir would also flip which side "inline end" means, and move the button.
  const name = document.createElement('span');
  button.append(name);
  parent.append(button);

  function render() {
    const other = state.lang === 'ar' ? 'en' : 'ar';
    name.textContent = content.ui.language[state.lang];
    name.lang = other;
    name.dir = other === 'ar' ? 'rtl' : 'ltr';
  }
  render();
  onLanguage(render);
  button.addEventListener('click', () => onSwitch(state.lang === 'ar' ? 'en' : 'ar'));
  return button;
}
