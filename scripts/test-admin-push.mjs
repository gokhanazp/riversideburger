#!/usr/bin/env node
// Admin push zincirini parça parça test etme aracı
// (Diagnostic tool for the admin push notification chain)
//
// Kullanım:
//   export SUPABASE_URL='https://<ref>.supabase.co'
//   export SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'
//
//   node scripts/test-admin-push.mjs tokens          # Admin + token durumunu listele
//   node scripts/test-admin-push.mjs send            # Doğrudan Expo'ya test push at
//   node scripts/test-admin-push.mjs fn <order_id>   # Edge Function'ı elle çağır
//   node scripts/test-admin-push.mjs orders          # Son 5 siparişin id'sini göster
//
// `fn` için ek olarak: export ADMIN_PUSH_SECRET='<sir>'
// Node 18+ gerekir (global fetch).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PUSH_SECRET = process.env.ADMIN_PUSH_SECRET;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri gerekli.');
  console.error('   Service role key: Supabase Dashboard → Project Settings → API');
  process.exit(1);
}

const restHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function rest(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: restHeaders });
  const body = await res.json();
  if (!res.ok) throw new Error(`REST ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function loadAdminTokens() {
  const admins = await rest('users?role=eq.admin&select=id,email,full_name');
  if (!admins.length) {
    console.log('⚠️  Hiç admin kullanıcı yok (users.role = admin).');
    return { admins, tokens: [] };
  }
  const ids = admins.map((a) => a.id).join(',');
  const tokens = await rest(
    `push_tokens?user_id=in.(${ids})&select=token,user_id,device_type,is_active,last_used_at&order=last_used_at.desc`
  );
  return { admins, tokens };
}

async function cmdTokens() {
  const { admins, tokens } = await loadAdminTokens();
  console.log(`\n👤 Admin sayısı: ${admins.length}`);
  admins.forEach((a) => console.log(`   • ${a.full_name || '(isimsiz)'} <${a.email}>  ${a.id}`));

  const active = tokens.filter((t) => t.is_active);
  console.log(`\n📱 Kayıtlı token: ${tokens.length}  |  aktif: ${active.length}`);
  tokens.forEach((t) =>
    console.log(
      `   ${t.is_active ? '✅' : '⛔️'} ${t.device_type.padEnd(7)} ${t.token}  (son: ${t.last_used_at ?? '-'})`
    )
  );

  if (!active.length) {
    console.log(
      '\n⚠️  Aktif token yok → push imkânsız. Admin hesabıyla DEV/PROD build\'de\n' +
        '    giriş yapıp bildirim izni verilmeli (Expo Go\'da push token alınamaz).'
    );
  }
}

async function cmdSend() {
  const { tokens } = await loadAdminTokens();
  const active = [...new Set(tokens.filter((t) => t.is_active).map((t) => t.token))];
  if (!active.length) {
    console.log('⚠️  Aktif admin token yok, gönderilecek cihaz bulunamadı.');
    return;
  }

  const messages = active.map((token) => ({
    to: token,
    title: '🔔 Yeni Sipariş! [TEST]',
    body: 'Test Müşteri - $99.00',
    sound: 'default',
    channelId: 'admin_orders',
    priority: 'high',
    badge: 1,
    // Gerçek push ile aynı data — orderId sahte olduğu için dedupe'a takılmaz
    data: { orderId: `test-${Date.now()}`, type: 'new_order_admin' },
  }));

  console.log(`📤 ${messages.length} cihaza test push gönderiliyor...`);
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = await res.json();
  console.log(`\nHTTP ${res.status}`);
  console.dir(result, { depth: 5 });

  const tickets = result?.data ?? [];
  tickets.forEach((ticket, i) => {
    if (ticket.status === 'ok') {
      console.log(`✅ ${active[i].slice(0, 30)}… → ticket ${ticket.id}`);
    } else {
      console.log(
        `❌ ${active[i].slice(0, 30)}… → ${ticket.details?.error ?? ticket.message}`
      );
    }
  });
}

async function cmdOrders() {
  const orders = await rest(
    'orders?select=id,order_number,status,total_amount,created_at&order=created_at.desc&limit=5'
  );
  console.log('\n🧾 Son siparişler:');
  orders.forEach((o) =>
    console.log(`   ${o.created_at}  #${o.order_number}  ${o.status.padEnd(10)}  ${o.id}`)
  );
}

async function cmdFn(orderId) {
  if (!orderId) {
    console.error('❌ Kullanım: node scripts/test-admin-push.mjs fn <order_id>');
    console.error('   Sipariş id\'leri için: node scripts/test-admin-push.mjs orders');
    process.exit(1);
  }
  if (!ADMIN_PUSH_SECRET) {
    console.error('❌ ADMIN_PUSH_SECRET ortam değişkeni gerekli (fonksiyonun beklediği sır).');
    process.exit(1);
  }

  // Yerelde `supabase functions serve` çalışıyorsa FUNCTIONS_BASE ile üzerine yaz
  const base = process.env.FUNCTIONS_BASE || `${SUPABASE_URL}/functions/v1`;
  const url = `${base}/notify-admin-new-order`;
  console.log(`📡 POST ${url}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-push-secret': ADMIN_PUSH_SECRET,
    },
    body: JSON.stringify({ order_id: orderId }),
  });
  const body = await res.text();
  console.log(`\nHTTP ${res.status}`);
  try {
    console.dir(JSON.parse(body), { depth: 5 });
  } catch {
    console.log(body);
  }
}

const [command, arg] = process.argv.slice(2);

const commands = {
  tokens: cmdTokens,
  send: cmdSend,
  orders: cmdOrders,
  fn: () => cmdFn(arg),
};

if (!commands[command]) {
  console.log('Komutlar: tokens | send | orders | fn <order_id>');
  process.exit(1);
}

commands[command]().catch((error) => {
  console.error('❌', error.message);
  process.exit(1);
});
