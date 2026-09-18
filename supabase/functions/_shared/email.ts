// Resend üzerinden e-posta gönderimi.
//
// ALT ALAN ADINDAN gönderiliyor (send.riversideburgers.ca). Kök alan adının
// MX/SPF/DMARC kayıtlarına dokunulmuyor; Google Workspace kurulumu bundan
// etkilenmiyor. Kökten gönderseydik kökün SPF kaydını Google ve Resend'i
// birlikte kapsayacak şekilde birleştirmek gerekirdi.
//
// YANIT ADRESİ müşterinin gerçekten ulaşabileceği bir kutu olmalı:
// send.riversideburgers.ca posta ALMIYOR (yalnızca gönderim için MX taşıyor).
// O yüzden reply-to, panelden yönetilen app_settings.contact_email.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export const MAIL_DOMAIN = 'send.riversideburgers.ca';
export const FROM_ORDERS = `Riverside Burgers <orders@${MAIL_DOMAIN}>`;
export const FROM_HELLO = `Riverside Burgers <hello@${MAIL_DOMAIN}>`;
export const SITE_URL = 'https://riversideburgers.ca';

// E-posta görselleri SİTEDEN servis ediliyor (riverside-web/public/email/).
// Neden: posta istemcileri yerel dosya okuyamaz, base64 gömme ise Outlook ve
// Gmail'de sıkça engelleniyor. Site zaten Cloudflare'de duruyor, ek altyapı
// gerekmiyor — ama görseller ancak site dağıtıldıktan sonra görünür.
export const ASSETS = `${SITE_URL}/email`;

export const APP_STORE_URL = 'https://apps.apple.com/app/id6756664786';
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.riverside_burgers.app';

// Google'ın "yorum yaz" kısa bağlantısı — sitedeki GoogleReviewCard ile aynı.
export const GOOGLE_REVIEW_URL = 'https://g.page/r/CVFu2sBnWiP4EBE/review';

/** Panelden yönetilen iletişim e-postası; bulunamazsa bilinen adrese düşer. */
export async function getReplyTo(admin: { from: (t: string) => any }): Promise<string> {
  const { data } = await admin
    .from('app_settings')
    .select('setting_value')
    .eq('setting_key', 'contact_email')
    .maybeSingle();
  const value = (data?.setting_value ?? '').trim();
  return value || 'riversideburgerss@gmail.com';
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  /** Kampanya/üyelik postasında abonelikten çıkma bağlantısı. */
  unsubscribeUrl?: string;
}): Promise<SendResult> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) {
    // Anahtar yoksa gönderemeyiz ama çağıranı çökertmeyiz: defterde
    // 'failed' olarak görünür ve sebebi okunur.
    return { ok: false, error: 'RESEND_API_KEY tanımlı değil' };
  }

  const body: Record<string, unknown> = {
    from: params.from,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  };
  if (params.replyTo) body.reply_to = params.replyTo;

  // List-Unsubscribe: Gmail ve Outlook bu başlığı gördüğünde kendi
  // "abonelikten çık" düğmesini gösteriyor. Ticari postada bunu koymamak
  // spam şikâyeti oranını yükseltiyor — şikâyet, alan adının itibarını
  // düşürdüğü için SİPARİŞ postalarının teslimini de vurur.
  if (params.unsubscribeUrl) {
    body.headers = {
      'List-Unsubscribe': `<${params.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.message || `Resend ${res.status}` };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export const money = (v: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(v) || 0);

/** E-postaya giren her kullanıcı verisi kaçırılmalı: ad alanına HTML yazan
 *  biri şablonu bozabilir ya da başkasına içerik enjekte edebilir. */
export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
