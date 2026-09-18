// E-posta şablonları.
//
// TABLO TABANLI DÜZEN ve SATIR İÇİ STİL, bilinçli: Outlook ve Gmail harici
// stil sayfalarını ve modern CSS'i atıyor. Sitede kullandığımız Tailwind
// burada işe yaramaz.
import { esc, money, SITE_URL } from './email.ts';

const BRAND = '#e63946';
const INK = '#1a1a1a';
const SOFT = '#6c757d';
const LINE = '#e9ecef';

function shell(title: string, body: string, footerExtra = ''): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${LINE};">
    <tr><td style="background:${INK};padding:20px 24px;">
      <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:.5px;">RIVERSIDE <span style="color:${BRAND};">BURGERS</span></span>
    </td></tr>
    <tr><td style="padding:28px 24px;">${body}</td></tr>
    <tr><td style="padding:18px 24px;border-top:1px solid ${LINE};color:${SOFT};font-size:12px;line-height:18px;">
      Riverside Burgers · 688 Queen Street East, Toronto, Ontario · +1 (416) 850-7026<br>
      <a href="${SITE_URL}" style="color:${SOFT};">riversideburgers.ca</a>${footerExtra}
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr>
    <td style="background:${BRAND};border-radius:10px;">
      <a href="${href}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${esc(label)}</a>
    </td></tr></table>`;

// ── Üyelik ─────────────────────────────────────────────────────────────────
export function welcomeEmail(params: {
  name: string | null;
  pointsPercentage: number | null;
  unsubscribeUrl: string;
}): { subject: string; html: string } {
  const greeting = params.name?.trim() ? `Hi ${esc(params.name.trim().split(' ')[0])},` : 'Hi there,';
  const pct = params.pointsPercentage && params.pointsPercentage > 0
    ? `<p style="margin:0 0 14px;color:${INK};font-size:15px;line-height:23px;">
         You now earn <strong>${params.pointsPercentage}% back in points</strong> on every order, and you can spend them whenever you like — on the website or in the app.
       </p>`
    : '';

  return {
    subject: 'Welcome to Riverside Burgers',
    html: shell('Welcome to Riverside Burgers', `
      <h1 style="margin:0 0 14px;color:${INK};font-size:22px;font-weight:800;">Your account is ready</h1>
      <p style="margin:0 0 14px;color:${INK};font-size:15px;line-height:23px;">${greeting}</p>
      <p style="margin:0 0 14px;color:${INK};font-size:15px;line-height:23px;">
        Thanks for joining us. Handmade burgers in Toronto's Riverside since 2019 — patties, sauces and toppings made in our own kitchen.
      </p>
      ${pct}
      <p style="margin:0 0 14px;color:${INK};font-size:15px;line-height:23px;">
        Your address and favourites are saved, so reordering takes a couple of taps.
      </p>
      ${button(`${SITE_URL}/menu`, 'See the menu')}
      <p style="margin:0;color:${SOFT};font-size:13px;line-height:20px;">
        Questions about an order? Just reply to this email.
      </p>
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
    params.discount > 0 ? line('Discount', `−${money(params.discount)}`, '#28a745') : '',
    params.pointsUsed > 0 ? line('Points', `−${money(params.pointsUsed)}`, '#28a745') : '',
    params.isDelivery ? line('Delivery', money(params.deliveryFee)) : '',
    line('HST', money(params.tax)),
    params.tip > 0 ? line('Tip', money(params.tip)) : '',
  ].filter(Boolean).join('');

  const where = params.isDelivery && params.address
    ? `<p style="margin:0 0 14px;color:${SOFT};font-size:14px;line-height:21px;"><strong style="color:${INK};">Delivering to</strong><br>${esc(params.address)}</p>`
    : `<p style="margin:0 0 14px;color:${SOFT};font-size:14px;line-height:21px;"><strong style="color:${INK};">Pick up from</strong><br>688 Queen Street East, Toronto</p>`;

  const earned = params.pointsEarned > 0
    ? `<p style="margin:14px 0 0;color:#28a745;font-size:14px;font-weight:700;">You earned ${params.pointsEarned} points on this order.</p>`
    : '';

  return {
    subject: `Order #${params.orderNumber} confirmed`,
    html: shell(`Order #${params.orderNumber}`, `
      <h1 style="margin:0 0 6px;color:${INK};font-size:22px;font-weight:800;">Thanks${params.name?.trim() ? `, ${esc(params.name.trim().split(' ')[0])}` : ''}!</h1>
      <p style="margin:0 0 20px;color:${SOFT};font-size:14px;">
        Your payment cleared and the kitchen has your order.<br>
        Order <strong style="color:${INK};">#${esc(params.orderNumber)}</strong>
      </p>
      ${where}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};padding:8px 0;margin:0 0 12px;">
        ${rows}
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${line('Items', money(params.subtotal), SOFT)}
        ${extras}
        <tr><td colspan="2" style="border-top:1px solid ${LINE};height:8px;"></td></tr>
        ${line('Total', money(params.total), INK, true)}
      </table>
      ${earned}
      ${button(params.trackUrl, 'Track your order')}
      <p style="margin:0;color:${SOFT};font-size:13px;line-height:20px;">
        Something wrong with this order? Reply to this email or call us on +1 (416) 850-7026.
      </p>
    `),
    // Sipariş fişine abonelikten çıkma bağlantısı KOYMUYORUZ: bu işlemsel bir
    // posta, ticari bildirim değil. Müşterinin ödediği siparişin fişinden
    // çıkarılabilmesi de doğru olmaz.
  };
}
