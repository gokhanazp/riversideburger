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
import { esc, money, SITE_URL, ASSETS, APP_STORE_URL, PLAY_STORE_URL, GOOGLE_REVIEW_URL } from './email.ts';
import { formatScheduled } from './scheduling.ts';

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

/** Google yorum daveti. Sitedeki GoogleReviewCard ile aynı metin ve görsel dil.
 *
 *  ÖNCE MEMNUNİYET SORULMUYOR: "memnun kaldıysanız yorum yazın" biçiminde
 *  filtreleme (review gating) Google'ın politikasına ve FTC kurallarına aykırı.
 *  Yıldızlar metin karakteri (★), SVG değil — Outlook ve Gmail SVG'yi atıyor.
 */
const reviewBlock = `
<tr><td style="padding:0 24px 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(230,57,70,.05);border:1px solid rgba(230,57,70,.3);border-radius:14px;">
    <tr><td style="padding:18px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        <td width="44" style="vertical-align:top;padding-right:14px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:11px;"><tr>
            <td align="center" style="width:44px;height:44px;">
              <img src="${ASSETS}/google-g.png" width="22" height="22" alt="Google" style="display:block;border:0;">
            </td>
          </tr></table>
        </td>
        <td style="vertical-align:top;">
          <div style="color:#F5B301;font-size:15px;letter-spacing:2px;line-height:18px;">★★★★★</div>
          <div style="color:${INK};font-size:16px;font-weight:800;margin:4px 0 3px;">Your review means a lot to us</div>
          <div style="color:${SOFT};font-size:13px;line-height:20px;">
            It takes about 30 seconds — and it's how neighbours find a small, family-run kitchen like ours.
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 0;"><tr>
            <td style="background:${BRAND};border-radius:10px;">
              <a href="${GOOGLE_REVIEW_URL}" style="display:inline-block;padding:11px 22px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Rate us on Google</a>
            </td>
          </tr></table>
        </td>
      </tr></table>
    </td></tr>
  </table>
</td></tr>`;

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
  /** Misafir hesabı (şifresiz): fişe "hesabını kaydet" kutusu ekleniyor. */
  isGuest?: boolean;
  /** İleri tarihli sipariş: teslim anı (UTC ISO). */
  scheduledFor?: string | null;
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
  // İleri tarihli sipariş: saat fişin en üstünde, kaçırılmasın.
  const scheduled = params.scheduledFor
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;border:1px solid #f6cdd1;border-radius:12px;margin:0 0 14px;">
         <tr><td style="padding:12px 16px;">
           <div style="color:${SOFT};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;line-height:16px;">Scheduled pickup</div>
           <div style="color:${INK};font-size:17px;font-weight:800;line-height:24px;">${esc(formatScheduled(params.scheduledFor))}</div>
           <div style="color:${SOFT};font-size:13px;line-height:19px;">We'll start cooking shortly before, so it's hot when you arrive.</div>
         </td></tr>
       </table>`
    : '';

  // Puanlar 1:1 PARA olarak harcanıyor (points_used doğrudan tutardan
  // düşülüyor), o yüzden kazanılan puan da para olarak yazılıyor. Ham sayıyı
  // "0.05 points" diye basmak hem yanıltıcı hem de uygulamanın tam sayı "PTS"
  // gösterimiyle çelişiyordu. Bir kuruşun altında kalan tutarda satır hiç
  // gösterilmiyor: "You earned $0.00" kazanç gibi durmuyor.
  const earnedValue = Number(params.pointsEarned) || 0;
  const earned = earnedValue >= 0.01
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9f2;border-radius:10px;margin:16px 0 0;">
         <tr><td align="center" style="padding:12px;color:${OK};font-size:14px;font-weight:700;">
           You earned ${money(earnedValue)} in points on this order
         </td></tr>
       </table>`
    : '';

  // Misafir: hesabı var ama şifresi yok. Bağlantı sipariş sayfasındaki
  // "Save your account" kartına iniyor; jeton ORADA üretiliyor ki 1 saatlik
  // ömrü fişin açıldığı anda değil, müşteri istediğinde başlasın.
  const saveAccount = params.isGuest
    ? `<tr><td style="padding:0 24px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;border:1px solid #f6cdd1;border-radius:12px;">
          <tr><td style="padding:14px 16px;">
            <div style="color:${INK};font-size:14px;font-weight:800;line-height:20px;">Save your account</div>
            <div style="color:${SOFT};font-size:13px;line-height:20px;margin:4px 0 8px;">
              You ordered as a guest, so your account already exists — it just needs a password. Set one to keep your points and reorder in a tap in our app.
            </div>
            <a href="${params.trackUrl}#save-account" style="color:${BRAND};font-size:13px;font-weight:700;text-decoration:none;">Set a password →</a>
          </td></tr>
        </table>
      </td></tr>`
    : '';

  return {
    subject: `Order #${params.orderNumber} confirmed`,
    html: shell(`Order #${params.orderNumber}`, `
      <tr><td style="padding:28px 24px 4px;">
        <h1 style="margin:0 0 6px;color:${INK};font-size:24px;font-weight:800;line-height:30px;">Thanks${params.name?.trim() ? `, ${esc(params.name.trim().split(' ')[0])}` : ''}!</h1>
        <p style="margin:0 0 18px;color:${SOFT};font-size:14px;line-height:21px;">
          ${params.scheduledFor ? 'Your payment cleared and your order is booked.' : 'Your payment cleared and the kitchen has your order.'}<br>
          Order <strong style="color:${INK};">#${esc(params.orderNumber)}</strong>
        </p>
        ${scheduled}

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
      ${saveAccount}
      ${reviewBlock}
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

// ── Teslimattan sonra Google yorum ricası ──────────────────────────────────
//
// Kısa ve tek düğmeli: fişteki düğmenin aynısı, ama bu kez posta yalnızca
// bundan ibaret. Memnuniyet sorusu YOK — "memnunsan Google'a, değilsen bize
// yaz" ayrımı review gating sayılıyor ve Google bunu yasaklıyor; herkese aynı
// posta gidiyor, mutsuz müşteri için "just reply" yolu altta.
export function reviewRequestEmail(params: {
  name: string | null;
  orderNumber: string;
  unsubscribeUrl: string;
}): { subject: string; html: string } {
  const first = params.name?.trim() ? esc(params.name.trim().split(' ')[0]) : null;
  const greeting = first ? `Hi ${first},` : 'Hi there,';
  return {
    subject: first ? `How was your burger, ${first}?` : 'How was your burger?',
    html: shell('How was your burger?', `
      <tr><td style="padding:28px 24px 8px;">
        <h1 style="margin:0 0 12px;color:${INK};font-size:24px;font-weight:800;line-height:30px;">How was your burger?</h1>
        <p style="margin:0 0 14px;color:${INK};font-size:15px;line-height:23px;">${greeting}</p>
        <p style="margin:0 0 18px;color:${INK};font-size:15px;line-height:23px;">
          Thanks for ordering from us (order ${esc(params.orderNumber)}). If you enjoyed it, a quick Google review takes about 30 seconds — and it's how neighbours find a small, family-run kitchen like ours.
        </p>
        ${button(GOOGLE_REVIEW_URL, 'Rate us on Google')}
      </td></tr>
      <tr><td style="padding:0 24px 24px;">
        <p style="margin:0;color:${SOFT};font-size:13px;line-height:20px;">
          Something wasn't right? Just reply to this email and we'll make it right.
        </p>
      </td></tr>
    `, `<br><br><a href="${params.unsubscribeUrl}" style="color:${SOFT};">Unsubscribe from our emails</a>`),
  };
}

// ── Şifre belirle / sıfırla ────────────────────────────────────────────────
//
// Tek düğme, tek iş. Misafir için "hesabın zaten var" vurgusu: müşteri hiç
// hesap açmadığını sanıyor. Üye için sıradan sıfırlama metni. Bağlantı 1 saat
// geçerli ve tek kullanımlık (Auth mailer_otp_exp).
export function setPasswordEmail(params: {
  name: string | null;
  isGuest: boolean;
  link: string;
}): { subject: string; html: string } {
  const first = params.name?.trim() ? esc(params.name.trim().split(' ')[0]) : null;
  const greeting = first ? `Hi ${first},` : 'Hi there,';
  const title = params.isGuest ? 'Save your account' : 'Set a new password';
  const intro = params.isGuest
    ? `You've ordered from us as a guest, so you already have a Riverside Burgers account — it just needs a password. Set one and your orders and points are yours to use on our website and in the app.`
    : `Use the button below to choose a new password for your Riverside Burgers account.`;
  return {
    subject: params.isGuest ? 'Save your Riverside Burgers account' : 'Set a new password',
    html: shell(title, `
      <tr><td style="padding:28px 24px 8px;">
        <h1 style="margin:0 0 12px;color:${INK};font-size:24px;font-weight:800;line-height:30px;">${title}</h1>
        <p style="margin:0 0 14px;color:${INK};font-size:15px;line-height:23px;">${greeting}</p>
        <p style="margin:0 0 18px;color:${INK};font-size:15px;line-height:23px;">${intro}</p>
        ${button(params.link, params.isGuest ? 'Set my password' : 'Choose a new password')}
        <p style="margin:0 0 6px;color:${INK};font-size:14px;line-height:22px;">
          <strong>Same login for the app.</strong> Once your password is set, sign in to the Riverside Burgers app with this email and password — that's where your points are spent.
        </p>
      </td></tr>
      <tr><td style="padding:0 24px 24px;">
        <p style="margin:0;color:${SOFT};font-size:13px;line-height:20px;">
          This link is valid for 1 hour and works once. If you didn't ask for it, you can safely ignore this email — nothing changes on your account.
        </p>
      </td></tr>
    `),
  };
}

// ── Mevcut misafirlere tek seferlik davet ──────────────────────────────────
//
// Düğme şifre sayfasına e-posta DOLU gidiyor; tek kullanımlık jeton buraya
// konmuyor çünkü 1 saatte bitiyor ve insanlar postayı akşam açıyor. Müşteri
// orada tek dokunuşla bağlantı istiyor. Ticari posta sayılır: abonelikten
// çıkma bağlantısı ve "bir daha sormayacağız" sözü var.
export function guestInviteEmail(params: {
  name: string | null;
  email: string;
  unsubscribeUrl: string;
}): { subject: string; html: string } {
  const first = params.name?.trim() ? esc(params.name.trim().split(' ')[0]) : null;
  const greeting = first ? `Hi ${first},` : 'Hi there,';
  const link = `${SITE_URL}/account/set-password?email=${encodeURIComponent(params.email)}`;
  return {
    subject: 'Your Riverside Burgers account is waiting',
    html: shell('Your account is waiting', `
      <tr><td style="padding:28px 24px 8px;">
        <h1 style="margin:0 0 12px;color:${INK};font-size:24px;font-weight:800;line-height:30px;">Your account is waiting</h1>
        <p style="margin:0 0 14px;color:${INK};font-size:15px;line-height:23px;">${greeting}</p>
        <p style="margin:0 0 14px;color:${INK};font-size:15px;line-height:23px;">
          Thanks for ordering from us. Your guest order quietly created an account for you — your orders and points are already on it. It just needs a password.
        </p>
        <p style="margin:0 0 18px;color:${INK};font-size:15px;line-height:23px;">
          Set one and you can sign in on riversideburgers.ca and in the Riverside Burgers app: reorder your usual in a tap, keep earning points, and spend them whenever you like.
        </p>
        ${button(link, 'Save my account')}
        <p style="margin:0 0 6px;color:${INK};font-size:14px;line-height:22px;">
          <strong>Same login for the app.</strong> The email and password you choose work in the app too.
        </p>
      </td></tr>
      <tr><td style="padding:0 24px 24px;">
        <p style="margin:0;color:${SOFT};font-size:13px;line-height:20px;">
          Not interested? No problem — we won't ask again.
        </p>
      </td></tr>
    `, `<br><br><a href="${params.unsubscribeUrl}" style="color:${SOFT};">Unsubscribe from our emails</a>`),
  };
}

// ── Catering başvurusu ─────────────────────────────────────────────────────
export interface CateringRequestLike {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string;
  event_date: string | null;
  event_time: string | null;
  guests: number | null;
  event_type: string | null;
  service: string | null;
  address: string | null;
  notes: string | null;
}

const row = (label: string, value: string | number | null | undefined) =>
  value === null || value === undefined || value === ''
    ? ''
    : `<tr>
        <td style="padding:6px 0;color:${SOFT};font-size:13px;width:38%;vertical-align:top;">${esc(label)}</td>
        <td style="padding:6px 0;color:${INK};font-size:14px;vertical-align:top;">${esc(value)}</td>
      </tr>`;

/** Restorana: başvurunun özeti. Yanıt adresi müşteri; "Reply" ile teklif yazılır. */
export function cateringRequestEmail(r: CateringRequestLike): { subject: string; html: string } {
  const bits = [r.name, r.guests ? `${r.guests} guests` : null, r.event_date].filter(Boolean).join(' · ');
  return {
    subject: `Catering request — ${bits}`,
    html: shell('Catering request', `
      <tr><td style="padding:28px 24px 8px;">
        <h1 style="margin:0 0 6px;color:${INK};font-size:22px;font-weight:800;line-height:28px;">New catering request</h1>
        <p style="margin:0 0 16px;color:${SOFT};font-size:14px;line-height:21px;">From the website. Reply to this email to answer ${esc(r.name)} directly.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};">
          ${row('Name', r.name)}
          ${row('Company', r.company)}
          ${row('Email', r.email)}
          ${row('Phone', r.phone)}
          ${row('Event date', r.event_date)}
          ${row('Time', r.event_time)}
          ${row('Guests', r.guests)}
          ${row('Occasion', r.event_type)}
          ${row('Service', r.service)}
          ${row('Address', r.address)}
          ${row('Notes', r.notes)}
        </table>
        <p style="margin:14px 0 0;color:${MUTED};font-size:12px;">Request ID ${esc(r.id)}</p>
      </td></tr>
    `),
  };
}

/** Müşteriye: alındı, 24 saat içinde dönüş. */
export function cateringAckEmail(r: CateringRequestLike): { subject: string; html: string } {
  const first = esc(r.name.trim().split(' ')[0] || 'there');
  const when = [r.event_date, r.guests ? `${r.guests} guests` : null].filter(Boolean).join(', ');
  return {
    subject: 'We got your catering request',
    html: shell('We got your catering request', `
      <tr><td style="padding:28px 24px 8px;">
        <h1 style="margin:0 0 12px;color:${INK};font-size:24px;font-weight:800;line-height:30px;">Thanks, ${first}!</h1>
        <p style="margin:0 0 14px;color:${INK};font-size:15px;line-height:23px;">
          We've received your catering request${when ? ` (${esc(when)})` : ''}. Someone from the kitchen will get back to you within 24 hours with a menu suggestion and a quote.
        </p>
        <p style="margin:0 0 18px;color:${INK};font-size:15px;line-height:23px;">
          Need to add or change anything? Just reply to this email, or call us on +1 (416) 850-7026.
        </p>
      </td></tr>
    `),
  };
}

// ── Sipariş durumu (yalnızca uygulaması olmayan müşteriye: hazır / iptal) ──
export function orderStatusEmail(params: {
  status: 'ready' | 'cancelled';
  orderNumber: string;
  name: string | null;
  deliveryMethod: 'pickup' | 'delivery' | string;
  trackUrl: string;
}): { subject: string; html: string } {
  const first = params.name?.trim() ? esc(params.name.trim().split(' ')[0]) : null;
  const greeting = first ? `Hi ${first},` : 'Hi there,';
  const n = esc(params.orderNumber);
  if (params.status === 'cancelled') {
    return {
      subject: `Order #${params.orderNumber} was cancelled`,
      html: shell('Order cancelled', `
        <tr><td style="padding:28px 24px 24px;">
          <h1 style="margin:0 0 12px;color:${INK};font-size:24px;font-weight:800;line-height:30px;">Order cancelled</h1>
          <p style="margin:0 0 14px;color:${INK};font-size:15px;line-height:23px;">${greeting}</p>
          <p style="margin:0 0 14px;color:${INK};font-size:15px;line-height:23px;">
            Order <strong>#${n}</strong> has been cancelled. If you were charged, the refund goes back to the same card within a few business days.
          </p>
          <p style="margin:0;color:${SOFT};font-size:13px;line-height:20px;">Questions? Reply to this email or call +1 (416) 850-7026.</p>
        </td></tr>
      `),
    };
  }
  const pickup = params.deliveryMethod === 'pickup';
  return {
    subject: pickup ? `Order #${params.orderNumber} is ready for pickup` : `Order #${params.orderNumber} is ready`,
    html: shell(pickup ? 'Ready for pickup' : 'Your order is ready', `
      <tr><td style="padding:28px 24px 24px;">
        <h1 style="margin:0 0 12px;color:${INK};font-size:24px;font-weight:800;line-height:30px;">${pickup ? 'Ready for pickup!' : 'Your order is ready'}</h1>
        <p style="margin:0 0 14px;color:${INK};font-size:15px;line-height:23px;">${greeting}</p>
        <p style="margin:0 0 6px;color:${INK};font-size:15px;line-height:23px;">
          ${pickup
            ? `Order <strong>#${n}</strong> is packed and waiting for you at <strong>688 Queen Street East</strong>. See you soon!`
            : `Order <strong>#${n}</strong> is packed and the courier is being called. You can follow it on your order page.`}
        </p>
        ${button(params.trackUrl, 'View your order')}
      </td></tr>
    `),
  };
}
