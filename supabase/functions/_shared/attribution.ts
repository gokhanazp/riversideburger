// Pazarlama kaynağı: istemcinin ilk sayfada yakaladığı parametrelerden
// kanal türetir. Yalnızca beyaz listedeki alanlar, kısaltılmış.
export interface Attribution {
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  fbclid?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  referrer?: string | null;
  landing_page?: string | null;
  captured_at?: string | null;
}

const KEYS: (keyof Attribution)[] = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'referrer', 'landing_page', 'captured_at'];

export function sanitizeAttribution(raw: unknown): Attribution | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: Attribution = {};
  let any = false;
  for (const k of KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim()) {
      out[k] = v.trim().slice(0, 300);
      any = true;
    }
  }
  return any ? out : null;
}

function host(url: string | null | undefined): string {
  try {
    return url ? new URL(url).hostname.toLowerCase() : '';
  } catch {
    return '';
  }
}

export function deriveChannel(a: Attribution | null, siteHost = 'riversideburgers.ca'): string {
  if (!a) return 'direct';
  const src = (a.utm_source ?? '').toLowerCase();
  const med = (a.utm_medium ?? '').toLowerCase();
  if (a.gclid || a.gbraid || a.wbraid) return 'google_ads';
  if (/google/.test(src) && /cpc|ppc|paid|ads/.test(med)) return 'google_ads';
  if (a.fbclid || /facebook|instagram|^fb$|^ig$|meta/.test(src)) return 'meta';
  if (src) return 'other_campaign';
  const ref = host(a.referrer);
  if (!ref || ref === siteHost || ref.endsWith('.' + siteHost)) return 'direct';
  if (/(^|\.)google\./.test(ref)) return 'google_organic';
  if (/bing\.com|duckduckgo\.com|yahoo\.|search\.brave/.test(ref)) return 'other_search';
  if (/instagram\.com|facebook\.com|fb\.com|l\.instagram|lm\.facebook/.test(ref)) return 'meta';
  return 'referral';
}
