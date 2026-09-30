// notify-order-status — sipariş durumu değişince müşteriye haber verir.
//
// Tetikleyici: orders.status değişimi (trg_notify_customer_on_status_change,
// pg_net). Kanal seçimi:
//   • push  — uygulaması olan müşteri (aktif push_tokens). Tüm durumlar.
//   • inapp — notifications tablosu; uygulamadaki bildirim listesi.
//   • email — push'u OLMAYAN müşteri (web misafiri vb.), yalnızca "hazır" ve
//             "iptal". Her durum için e-posta atmak dört posta demek olurdu.
// Tercihler: notification_preferences.order_status_enabled kapalıysa hiçbir
// kanal çalışmaz. Mükerrer: order_status_notifications tekil indeksi.
// Kimlik: x-email-secret = EMAIL_FN_SECRET (send-email ile aynı sır).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail, getReplyTo, FROM_DEFAULT, SITE_URL } from '../_shared/email.ts';
import { orderStatusEmail } from '../_shared/email-templates.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const UNIQUE_VIOLATION = '23505';
const EMAIL_STATUSES = new Set(['ready', 'cancelled']);

type ExpoTicket = { status: 'ok' | 'error'; details?: { error?: string } };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function copy(status: string, orderNumber: string, pickup: boolean): { title: string; body: string } | null {
  const n = `#${orderNumber}`;
  switch (status) {
    case 'confirmed':
      return { title: 'Order confirmed', body: `Order ${n} is in — the kitchen has it.` };
    case 'preparing':
      return { title: "We're on it", body: `Order ${n} is being made right now.` };
    case 'ready':
      return pickup
        ? { title: 'Ready for pickup!', body: `Order ${n} is packed and waiting at 688 Queen Street East.` }
        : { title: 'Your order is ready', body: `Order ${n} is packed — calling the courier now.` };
    case 'delivering':
      return { title: 'On its way', body: `Order ${n} is out for delivery.` };
    case 'delivered':
      return pickup
        ? { title: 'Enjoy!', body: `Order ${n} is marked as picked up. Thanks for coming by!` }
        : { title: 'Delivered', body: `Order ${n} has arrived. Enjoy your burgers!` };
    case 'cancelled':
      return { title: 'Order cancelled', body: `Order ${n} was cancelled. If you were charged, the refund is on its way.` };
    default:
      return null;
  }
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  const expected = Deno.env.get('EMAIL_FN_SECRET');
  if (!expected) return json({ error: 'not configured' }, 500);
  if (req.headers.get('x-email-secret') !== expected) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  try {
    const { order_id, status } = (await req.json()) as { order_id?: string; status?: string };
    if (!order_id || !status) return json({ error: 'order_id and status required' }, 400);

    const { data: order } = await admin
      .from('orders')
      .select('id, order_number, status, payment_status, delivery_method, user_id, public_token')
      .eq('id', order_id)
      .maybeSingle();
    if (!order?.user_id) return json({ skipped: 'order or customer missing' });
    // Durum bu arada yine değiştiyse eski durumu duyurmak kafa karıştırır.
    if (order.status !== status) return json({ skipped: 'stale status', current: order.status });
    if (order.payment_status !== 'paid') return json({ skipped: 'unpaid order' });

    const text = copy(status, order.order_number, order.delivery_method === 'pickup');
    if (!text) return json({ skipped: `no copy for ${status}` });

    const [{ data: user }, { data: prefs }, { data: tokenRows }] = await Promise.all([
      admin.from('users').select('id, email, full_name, role').eq('id', order.user_id).maybeSingle(),
      admin.from('notification_preferences').select('order_status_enabled, push_notifications, email_notifications').eq('user_id', order.user_id).maybeSingle(),
      admin.from('push_tokens').select('token').eq('user_id', order.user_id).eq('is_active', true),
    ]);
    if (!user) return json({ skipped: 'user missing' });
    if (prefs && prefs.order_status_enabled === false) return json({ skipped: 'order status notifications off' });

    const tokens = [...new Set<string>((tokenRows ?? []).map((r: { token: string }) => r.token).filter(Boolean))];
    const pushAllowed = tokens.length > 0 && prefs?.push_notifications !== false;
    const summary: Record<string, unknown> = { order: order.order_number, status };

    // Aynı (sipariş, durum, kanal) için ikinci kez çalışmayı engeller.
    const claim = async (channel: 'push' | 'inapp' | 'email', note?: string) => {
      const { error } = await admin.from('order_status_notifications').insert({ order_id: order.id, status, channel, note: note ?? null });
      if (!error) return true;
      if (error.code !== UNIQUE_VIOLATION) console.error('[order status] claim failed', channel, error);
      return false;
    };

    // ── Uygulama içi liste ───────────────────────────────────────────────
    if (await claim('inapp')) {
      const { error } = await admin.from('notifications').insert({
        user_id: user.id,
        title: text.title,
        body: text.body,
        type: 'order_status',
        order_id: order.id,
        data: { type: 'order_status', orderId: order.id, orderNumber: order.order_number, status },
        is_read: false,
      });
      summary.inapp = error ? `failed: ${error.message}` : 'ok';
    }

    // ── Push ─────────────────────────────────────────────────────────────
    if (pushAllowed && (await claim('push'))) {
      const messages = tokens.map((token) => ({
        to: token,
        title: text.title,
        body: text.body,
        sound: 'default',
        priority: 'high',
        channelId: 'orders',
        ttl: 3600,
        data: { type: 'order_status', orderId: order.id, orderNumber: order.order_number, status },
      }));
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
      const result = await res.json().catch(() => null);
      const tickets: ExpoTicket[] = result?.data ?? [];
      const dead: string[] = [];
      let ok = 0;
      tickets.forEach((t, i) => {
        if (t.status === 'ok') ok += 1;
        else if (t.details?.error === 'DeviceNotRegistered') dead.push(tokens[i]);
      });
      if (dead.length) await admin.from('push_tokens').update({ is_active: false }).in('token', dead);
      summary.push = `${ok}/${tokens.length}`;
      await admin.from('order_status_notifications').update({ note: `${ok}/${tokens.length} device(s)` })
        .eq('order_id', order.id).eq('status', status).eq('channel', 'push');
    }

    // ── E-posta: push'u olmayanlara, yalnızca hazır / iptal ──────────────
    const emailAllowed = !pushAllowed && EMAIL_STATUSES.has(status) && !!user.email && prefs?.email_notifications !== false;
    if (emailAllowed && (await claim('email'))) {
      const built = orderStatusEmail({
        status: status as 'ready' | 'cancelled',
        orderNumber: order.order_number,
        name: user.full_name,
        deliveryMethod: order.delivery_method,
        trackUrl: `${SITE_URL}/order/${order.order_number}?t=${order.public_token}`,
      });
      const replyTo = await getReplyTo(admin);
      const sent = await sendEmail({ from: FROM_DEFAULT, to: user.email, subject: built.subject, html: built.html, replyTo });
      await admin.from('email_log').insert({
        user_id: user.id, email: user.email, kind: 'order_status', ref_id: null,
        status: sent.ok ? 'sent' : 'failed', provider_id: sent.id ?? null, error: sent.error?.slice(0, 500) ?? null,
      });
      summary.email = sent.ok ? 'sent' : `failed: ${sent.error}`;
    }

    console.log('[order status]', JSON.stringify(summary));
    return json(summary);
  } catch (e) {
    console.error('[order status] unhandled', e);
    return json({ error: 'unexpected' }, 500);
  }
});
