// Brand every page from site.config.js: colours, brand name, footer. Include as <script type="module" src="/site.js">.
// Titles, descriptions and OG tags stay hard-written in each page's <head> so crawlers see them (house rule:
// every page has its own OG image).
import SITE from '/site.config.js';

const root = document.documentElement.style;
for (const [k, v] of Object.entries(SITE.colours || {})) root.setProperty('--' + k, v);
document.querySelectorAll('[data-site]').forEach((el) => {
  const k = el.dataset.site;
  if (k === 'brand') el.innerHTML = SITE.brandHtml;
  else if (k === 'host') el.textContent = new URL(SITE.origin).host;
  else if (k === 'company') el.textContent = `${SITE.company.name}, company number ${SITE.company.number}`;
  else if (k === 'email') { el.textContent = SITE.company.email; if (el.tagName === 'A') el.href = 'mailto:' + SITE.company.email; }
  else if (typeof SITE[k] === 'string') el.textContent = SITE[k];
});
const f = document.querySelector('footer[data-footer]');
if (f) f.innerHTML = `${SITE.name} · part of the bWalletX family · <a href="https://bwalletx.com/get">Get bWalletX</a> · <a href="/browse">Browse</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a><br><small>${SITE.company.name} · company number ${SITE.company.number}</small>`;
