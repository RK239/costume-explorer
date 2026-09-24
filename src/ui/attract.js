import { t } from './i18n.js';

// Placeholder headline. It also proves content.json is wired up and gives the touch lock
// some text to test against. The designed attract state arrives in step 8.
export function mountHeadline(overlay, exhibition) {
  const headline = document.createElement('header');
  headline.className = 'headline';

  const title = document.createElement('h1');
  title.textContent = t(exhibition.title);

  const hook = document.createElement('p');
  hook.textContent = t(exhibition.hook);

  headline.append(title, hook);
  overlay.append(headline);
}
