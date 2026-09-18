// E-posta şablonları.
//
// TABLO TABANLI DÜZEN ve SATIR İÇİ STİL, bilinçli: Outlook ve Gmail harici
// stil sayfalarını, flexbox'ı ve modern CSS'i atıyor. Sitede kullandığımız
// Tailwind burada işe yaramaz.
//
// GÖRSELLER İÇİN İKİ KURAL:
//   1. Her <img> açık width/height ve alt taşıyor. Birçok istemci görselleri
//      VARSAYILAN OLARAK ENGELLİYOR; ölçü verilmezse düzen çöküyor, alt metni
//      olmazsa müşteri boş kutulara bakıyor.
//   2. Mağaza düğmeleri GÖRSEL DEĞİL, HTML. Görsel engellenmiş bir postada
//      "uygulamayı indir" düğmesinin kaybolmasını istemiyoruz.
//   3. Telefon görüntüleri SİTENİN uygulama tanıtımında kullanılan güncel
//      görsellerden üretiliyor. assets/google-play-screenshots KULLANILMADI:
//      onlar Kasım 2025'te geliştirme verisiyle çekilmiş ve Türkçe ürün
//      açıklamalarıyla $89.90 gibi test fiyatları taşıyor.
//      JPEG seçildi çünkü PNG aynı kalitede altı kat büyük çıkıyor.
import { esc, money, SITE_URL, ASSETS, APP_STORE_URL, PLAY_STORE_URL } from './email.ts';

const BRAND = '#e63946';
const INK = '#1a1a1a';
const SOFT = '#6c757d';
const MUTED = '#adb5bd';
const LINE = '#e9ecef';
const OK = '#28a745';

// ── Ortak parçalar ─────────────────────────────────────────────────────────

const header = `
<tr><td style="background:${INK};padding:18px 24px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="padding-right:12px;vertical-align:middle;">
      <img src="${ASSETS}/logo.png" width="44" height="44" alt="Riverside Burgers"
           style="display:block;border:0;border-radius:10px;">
    </td>
    <td style="vertical-align:middle;">
      <div style="color:#ffffff;font-size:17px;font-weight:800;letter-spacing:.4px;line-height:20px;">RIVERSIDE <span style="color:${BRAND};">BURGERS</span></div>
      <div style="color:${MUTED};font-size:10px;letter-spacing:2px;line-height:14px;">TORONTO · EST. 2019</div>
    </td>
  </tr></table>
</td></tr>`;

const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr>
    <td style="background:${BRAND};border-radius:10px;">
      <a href="${href}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${esc(label)}</a>
    </td></tr></table>`;

// Mağaza düğmeleri — görsel değil, HTML. Bkz. dosya başındaki 2. kural.
const storeButtons = `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
  <td style="padding:0 5px;">
    <a href="${APP_STORE_URL}" style="display:block;background:#ffffff;border-radius:9px;padding:9px 16px;text-decoration:none;">
      <div style="color:${SOFT};font-size:8px;letter-spacing:1px;line-height:11px;">DOWNLOAD ON THE</div>
      <div style="color:${INK};font-size:14px;font-weight:800;line-height:18px;">App Store</div>
    </a>
  </td>
  <td style="padding:0 5px;">
    <a href="${PLAY_STORE_URL}" style="display:block;background:#ffffff;border-radius:9px;padding:9px 16px;text-decoration:none;">
      <div style="color:${SOFT};font-size:8px;letter-spacing:1px;line-height:11px;">GET IT ON</div>
      <div style="color:${INK};font-size:14px;font-weight:800;line-height:18px;">Google Play</div>
    </a>
  </td>
</tr></table>`;

/** Uygulama tanıtımı. `compact` sipariş fişinde kullanılıyor: fiş zaten uzun,
 *  telefon görüntüleri orada yer israfı. */
function appPromo(compact = false): string {
  const phones = compact
    ? ''
    : `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 18px;"><tr>
         <td style="padding:0 6px;">
           <img src="${ASSETS}/app-home.jpg" width="150" height="267" alt="Riverside Burgers app home screen"
                style="display:block;border:0;border-radius:12px;">
         </td>
         <td style="padding:0 6px;">
           <img src="${ASSETS}/app-menu.jpg" width="150" height="267" alt="Riverside Burgers app menu screen"
                style="display:block;border:0;border-radius:12px;">
         </td>
       </tr></table>`;

  return `
<tr><td style="padding:0 24px 24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${INK};border-radius:14px;">
    <tr><td align="center" style="padding:${compact ? '20px' : '24px'} 20px;">
      <div style="color:${BRAND};font-size:10px;font-weight:800;letter-spacing:1.6px;margin-bottom:6px;">RIVERSIDE BURGERS APP</div>
      <div style="color:#ffffff;font-size:${compact ? '17px' : '19px'};font-weight:800;line-height:25px;margin-bottom:8px;">Order faster. Earn points.</div>
      <div style="color:${MUTED};font-size:13px;line-height:20px;margin-bottom:18px;">
        ${compact
          ? 'Reorder in a couple of taps and follow your delivery on the map.'
          : 'Save your address, reorder your favourites in a couple of taps, and track your delivery from the kitchen to your door.'}
      </div>
      ${phones}
      ${storeButtons}
    </td></tr>
  </table>
</td></tr>`;
}

function shell(title: string, bodyRows: string, footerExtra = ''): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${LINE};">
    ${header}
    ${bodyRows}
    <tr><td style="padding:18px 24px;border-top:1px solid ${LINE};color:${SOFT};font-size:12px;line-height:19px;">
      Riverside Burgers · 688 Queen Street East, Toronto, Ontario<br>
      +1 (416) 850-7026 · <a href="${SITE_URL}" style="color:${SOFT};">riversideburgers.ca</a>${footerExtra}
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

// ── Üyelik ─────────────────────────────────────────────────────────────────
export function welcomeEmail(params: {
  name: string | null;
  pointsPercentage: number | null;
  unsubscribeUrl: string;
}): { subject: string; html: string } {
  const greeting = params.name?.trim() ? `Hi ${esc(params.name.trim().split(' ')[0])},` : 'Hi there,';
  const pct = Number(params.pointsPercentage) || 0;

  const pointsBox = pct > 0
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9f2;border:1px solid #cfe9d6;border-radius:12px;margin:0 0 18px;">
         <tr><td style="padding:16px 18px;">
           <div style="color:${OK};font-size:15px;font-weight:800;margin-bottom:4px;">${pct}% back in points on every order</div>
           <div style="color:${SOFT};font-size:13px;line-height:20px;">Spend them whenever you like — on the website or in the app. Same account, either way.</div>
         </td></tr>
       </table>`
    : '';

  return {
    subject: 'Welcome to Riverside Burgers',
    html: shell('Welcome to Riverside Burgers', `
      <tr><td style="padding:28px 24px 4px;">
        <h1 style="margin:0 0 12px;color:${INK};font-size:24px;font-weight:800;line-height:30px;">Your account is ready</h1>
        <p style="margin:0 0 14px;color:${INK};font-size:15px;line-height:23px;">${greeting}</p>
        <p style="margin:0 0 18px;color:${INK};font-size:15px;line-height:23px;">
          Thanks for joining us. Handmade burgers in Toronto's Riverside since 2019 — patties, sauces and toppings made in our own kitchen.
        </p>
        ${pointsBox}
        ${button(`${SITE_URL}/menu`, 'See the menu')}
      </td></tr>
      ${appPromo()}
      <tr><td style="padding:0 24px 24px;">
        <p style="margin:0;color:${SOFT};font-size:13px;line-height:20px;">
          Questions about an order? Just reply to this email.
        </p>
      </td></tr>
    `, `<br><br><a href="${params.unsubscribeUrl}" style="color:${SOFT};">Unsubscribe from our emails</a>`),
  };
}

// ── Sipariş ────────────────────────────────────────────────────────────────
export interface OrderLine { name: string; quantity: number; subtotal: number }

export function orderEmail(params: {
  orderNumber: string;
  name: string | null;
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  pointsUsed: number;
  deliveryFee: number;
  tax: number;
  tip: number;
  total: number;
  pointsEarned: number;
  isDelivery: boolean;
  address: string | null;
  trackUrl: string;
}): { subject: string; html: string } {
  const rows = params.lines.map((l) => `
    <tr>
      <td style="padding:7px 0;color:${INK};font-size:14px;">${esc(l.quantity)} × ${esc(l.name)}</td>
      <td style="padding:7px 0;color:${INK};font-size:14px;text-align:right;white-space:nowrap;">${money(l.subtotal)}</td>
    </tr>`).join('');

  const line = (label: string, value: string, colour = INK, bold = false) => `
    <tr>
      <td style="padding:5px 0;color:${colour};font-size:14px;${bold ? 'font-weight:800;' : ''}">${esc(label)}</td>
      <td style="padding:5px 0;color:${colour};font-size:14px;text-align:right;white-space:nowrap;${bold ? 'font-weight:800;' : ''}">${value}</td>
    </tr>`;

  const extras = [
    params.discount > 0 ? line('Discount', `−${money(params.discount)}`, OK) : '',
    params.pointsUsed > 0 ? line('Points', `−${money(params.pointsUsed)}`, OK) : '',
    params.isDelivery ? line('Delivery', money(params.deliveryFee)) : '',
    line('HST', money(params.tax)),
    params.tip > 0 ? line('Tip', money(params.tip)) : '',
  ].filter(Boolean).join('');

  const where = params.isDelivery && params.address
    ? `<strong style="color:${INK};">Delivering to</strong><br>${esc(params.address)}`
    : `<strong style="color:${INK};">Pick up from</strong><br>688 Queen Street East, Toronto`;

  const earned = params.pointsEarned > 0
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9f2;border-radius:10px;margin:16px 0 0;">
         <tr><td align="center" style="padding:12px;color:${OK};font-size:14px;font-weight:700;">
           You earned ${params.pointsEarned} points on this order
         </td></tr>
       </table>`
    : '';

  return {
    subject: `Order #${params.orderNumber} confirmed`,
    html: shell(`Order #${params.orderNumber}`, `
      <tr><td style="padding:28px 24px 4px;">
        <h1 style="margin:0 0 6px;color:${INK};font-size:24px;font-weight:800;line-height:30px;">Thanks${params.name?.trim() ? `, ${esc(params.name.trim().split(' ')[0])}` : ''}!</h1>
        <p style="margin:0 0 18px;color:${SOFT};font-size:14px;line-height:21px;">
          Your payment cleared and the kitchen has your order.<br>
          Order <strong style="color:${INK};">#${esc(params.orderNumber)}</strong>
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;border-radius:12px;margin:0 0 18px;">
          <tr><td style="padding:14px 16px;color:${SOFT};font-size:14px;line-height:21px;">${where}</td></tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};margin:0 0 12px;">
          <tr><td style="padding:4px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
          </td></tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${line('Items', money(params.subtotal), SOFT)}
          ${extras}
          <tr><td colspan="2" style="border-top:1px solid ${LINE};height:8px;"></td></tr>
          ${line('Total', money(params.total), INK, true)}
        </table>
        ${earned}
        ${button(params.trackUrl, 'Track your order')}
      </td></tr>
      ${appPromo(true)}
      <tr><td style="padding:0 24px 24px;">
        <p style="margin:0;color:${SOFT};font-size:13px;line-height:20px;">
          Something wrong with this order? Reply to this email or call us on +1 (416) 850-7026.
        </p>
      </td></tr>
    `),
    // Sipariş fişine abonelikten çıkma bağlantısı KOYMUYORUZ: bu işlemsel bir
    // posta, ticari bildirim değil. Müşterinin ödediği siparişin fişinden
    // çıkarılabilmesi de doğru olmaz.
  };
}
