// send-review-requests — vadesi gelen "Google'da değerlendir" ricalarını
// teslim eder. pg_cron beş dakikada bir dispatch_review_requests() üzerinden
// çağırıyor (yalnızca bekleyen varsa).
//
// Kanal seçimi: müşterinin aktif push token'ı varsa PUSH (uygulama), yoksa
// E-POSTA (web misafiri, uygulamasız üye). İkisini birden göndermiyoruz —
// aynı rica iki kanaldan gelirse bunaltıyor. E-posta, send-email fonksiyonuna
// 'review_request' türüyle devrediliyor: şablon ve mükerrer koruması orada.
//
// Deploy: supabase functions deploy send-review-requests
// (verify_jwt config.toml'da kapalı; sır x-email-secret = EMAIL_FN_SECRET.)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GOOGLE_REVIEW_URL } from '../_shared/email.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;
const BATCH = 50;

interface ExpoTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  const expected = Deno.env.get('EMAIL_FN_SECRET');
  if (!expected) return json({ error: 'not configured' }, 500);
  if (req.headers.get('x-email-secret') !== expected) return json({ error: 'unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  const { data: due, error } = await admin
    .from('review_requests')
    .select('id, order_id, user_id')
    .eq('status', 'pending')
    .lte('send_at', new Date().toISOString())
    .order('send_at', { ascending: true })
    .limit(BATCH);
  if (error) return json({ error: error.message }, 500);
  if (!due?.length) return json({ processed: 0 });

  const summary = { processed: 0, push: 0, email: 0, skipped: 0, failed: 0 };
  const deadTokens: string[] = [];

  for (const row of due) {
    summary.processed += 1;
    const mark = (patch: Record<string, unknown>) =>
      admin.from('review_requests').update({ ...patch, sent_at: new Date().toISOString() }).eq('id', row.id);

    const { data: order } = await admin
      .from('orders')
      .select('order_number, status, payment_status')
      .eq('id', row.order_id)
      .maybeSingle();
    if (!order || order.status === 'cancelled' || order.payment_status === 'refunded') {
      await mark({ status: 'skipped', note: 'order cancelled/refunded' });
      summary.skipped += 1;
      continue;
    }

    const { data: user } = await admin
      .from('users')
      .select('email, full_name, marketing_opt_out_at')
      .eq('id', row.user_id)
      .maybeSingle();

    // ── Push ────────────────────────────────────────────────────────────
    const { data: tokenRows } = await admin
      .from('push_tokens')
      .select('token')
      .eq('user_id', row.user_id)
      .eq('is_active', true);
    const tokens = [...new Set<string>((tokenRows ?? []).map((r: { token: string }) => r.token).filter(Boolean))];

    if (tokens.length) {
      const first = user?.full_name?.trim()?.split(' ')[0];
      const message = (token: string) => ({
        to: token,
        title: 'How was your burger?',
        body: `${first ? `${first}, ` : ''}enjoyed it? A quick Google review helps a small family kitchen more than you'd think — tap to rate.`,
        sound: 'default',
        priority: 'default',
        // Bir gün sonra anlamsız; teslim edilemezse düşsün.
        ttl: 86400,
        data: { type: 'google_review', url: GOOGLE_REVIEW_URL, orderId: row.order_id, orderNumber: order.order_number },
      });

      let ok = 0;
      for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
        const chunk = tokens.slice(i, i + CHUNK_SIZE);
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk.map(message)),
        });
        const result = await res.json().catch(() => null);
        const tickets: ExpoTicket[] = result?.data ?? [];
        tickets.forEach((ticket, index) => {
          if (ticket.status === 'ok') ok += 1;
          else if (ticket.details?.error === 'DeviceNotRegistered') deadTokens.push(chunk[index]);
        });
      }
      if (ok > 0) {
        await mark({ status: 'sent', channel: 'push', note: `${ok}/${tokens.length} device(s)` });
        summary.push += 1;
        continue;
      }
      // Push tamamen düştüyse e-postaya düş.
    }

    // ── E-posta ─────────────────────────────────────────────────────────
    if (!user?.email) {
      await mark({ status: 'skipped', note: 'no push token and no email' });
      summary.skipped += 1;
      continue;
    }
    if (user.marketing_opt_out_at) {
      await mark({ status: 'skipped', note: 'opted out of emails' });
      summary.skipped += 1;
      continue;
    }
    const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-email-secret': expected },
      body: JSON.stringify({ kind: 'review_request', ref_id: row.order_id }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && (body.sent || body.skipped)) {
      await mark({ status: 'sent', channel: 'email', note: body.skipped ? 'email already sent' : null });
      summary.email += 1;
    } else {
      await mark({ status: 'failed', note: String(body.error ?? res.status).slice(0, 200) });
      summary.failed += 1;
    }
  }

  if (deadTokens.length) {
    await admin.from('push_tokens').update({ is_active: false }).in('token', deadTokens);
  }

  console.log('[review request]', JSON.stringify(summary));
  return json(summary);
});
