// Supabase Edge Function: send-email
//
// Veritabanı tetikleyicileri pg_net ile buraya POST atıyor
// (queue_email → 20260918120000_transactional_email.sql). Tetikleyici yalnızca
// "şu tür posta, şu kayıt için" diyor; İÇERİĞİ burada kuruyoruz ki e-posta
// metni SQL'in içine dağılmasın.
//
// KİMLİK DOĞRULAMA: JWT yok, paylaşılan sır var (x-email-secret). Tetikleyici
// bir kullanıcı oturumu taşımıyor. Bu yüzden fonksiyon --no-verify-jwt ile
// dağıtılmalı; sır olmadan hiçbir şey göndermiyor.
//
// MÜKERRER GÖNDERİM: email_log'daki tekil indeks engelliyor. Kayıt ÖNCE
// atılıyor, posta SONRA gönderiliyor: pg_net isteği yeniden denerse ikinci
// çağrı 23505 alıp sessizce çıkıyor. Tersi sırayla iki fiş gidebilirdi.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail, getReplyTo, FROM_DEFAULT, SITE_URL } from '../_shared/email.ts';
import { welcomeEmail, orderEmail, type OrderLine } from '../_shared/email-templates.ts';

const UNIQUE_VIOLATION = '23505';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  const expected = Deno.env.get('EMAIL_FN_SECRET');
  if (!expected) {
    console.error('[send-email] EMAIL_FN_SECRET tanımlı değil — istek reddedildi');
    return json({ error: 'not configured' }, 500);
  }
  if (req.headers.get('x-email-secret') !== expected) {
    return json({ error: 'unauthorized' }, 401);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { kind, ref_id } = await req.json();
    if (!kind || !ref_id) return json({ error: 'kind and ref_id required' }, 400);

    // ── Alıcıyı ve içeriği çöz ────────────────────────────────────────────
    let to: string | null = null;
    let userId: string | null = null;
    const from = FROM_DEFAULT;
    let subject = '';
    let html = '';
    let unsubscribeUrl: string | undefined;

    if (kind === 'welcome') {
      const { data: user } = await admin
        .from('users')
        .select('id, email, full_name, unsubscribe_token')
        .eq('id', ref_id)
        .maybeSingle();
      if (!user?.email) return json({ skipped: 'kullanıcı ya da e-posta yok' });

      const { data: settings } = await admin
        .from('settings')
        .select('points_percentage')
        .limit(1)
        .maybeSingle();

      // Abonelikten çıkma bağlantısı oturum gerektirmiyor: jeton yeterli.
      unsubscribeUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/unsubscribe?token=${user.unsubscribe_token}`;

      const built = welcomeEmail({
        name: user.full_name,
        pointsPercentage: settings?.points_percentage ?? null,
        unsubscribeUrl,
      });
      to = user.email;
      userId = user.id;
      subject = built.subject;
      html = built.html;
    } else if (kind === 'order') {
      const { data: order } = await admin
        .from('orders')
        .select(
          'id, order_number, public_token, user_id, delivery_method, delivery_address, ' +
            'total_amount, discount_amount, tax_amount, tip_amount, delivery_fee, points_used, points_earned'
        )
        .eq('id', ref_id)
        .maybeSingle();
      if (!order) return json({ skipped: 'sipariş bulunamadı' });
      if (!order.user_id) return json({ skipped: 'siparişin müşteri kaydı yok' });

      const { data: user } = await admin
        .from('users')
        .select('id, email, full_name')
        .eq('id', order.user_id)
        .maybeSingle();
      if (!user?.email) return json({ skipped: 'müşterinin e-postası yok' });

      const { data: items } = await admin
        .from('order_items')
        .select('quantity, subtotal, price, products(name)')
        .eq('order_id', order.id);

      const lines: OrderLine[] = (items ?? []).map((i: any) => ({
        name: i.products?.name ?? 'Item',
        quantity: Number(i.quantity) || 0,
        subtotal: Number(i.subtotal ?? (Number(i.price) || 0) * (Number(i.quantity) || 0)),
      }));

      const itemsSubtotal = lines.reduce((s, l) => s + l.subtotal, 0);

      const built = orderEmail({
        orderNumber: order.order_number,
        name: user.full_name,
        lines,
        subtotal: Number(itemsSubtotal.toFixed(2)),
        discount: Number(order.discount_amount) || 0,
        pointsUsed: Number(order.points_used) || 0,
        deliveryFee: Number(order.delivery_fee) || 0,
        tax: Number(order.tax_amount) || 0,
        tip: Number(order.tip_amount) || 0,
        total: Number(order.total_amount) || 0,
        pointsEarned: Number(order.points_earned) || 0,
        isDelivery: order.delivery_method === 'delivery',
        address: order.delivery_address,
        trackUrl: `${SITE_URL}/order/${order.order_number}?t=${order.public_token}`,
      });
      to = user.email;
      userId = user.id;
      subject = built.subject;
      html = built.html;
    } else {
      return json({ error: `bilinmeyen tür: ${kind}` }, 400);
    }

    // ── Defteri ÖNCE yaz: mükerrer gönderimi burası engelliyor ────────────
    const { data: logRow, error: logError } = await admin
      .from('email_log')
      .insert({ user_id: userId, email: to, kind, ref_id })
      .select('id')
      .single();

    if (logError) {
      if (logError.code === UNIQUE_VIOLATION) {
        // Bu posta daha önce gönderilmiş. pg_net yeniden denemiş ya da
        // sipariş iki yoldan tetiklenmiş; ikisi de beklenen durum.
        return json({ skipped: 'zaten gönderilmiş' });
      }
      console.error('[send-email] defter yazılamadı', logError);
      return json({ error: 'could not log' }, 500);
    }

    const replyTo = await getReplyTo(admin);
    const result = await sendEmail({ from, to: to!, subject, html, replyTo, unsubscribeUrl });

    if (!result.ok) {
      // Kayıt 'failed' işaretleniyor ama SİLİNMİYOR: tekil indeks yerinde
      // kalsın diye değil — hatanın izi kalsın diye. Yeniden göndermek
      // istenirse satır elle silinip tetiklenebilir.
      await admin
        .from('email_log')
        .update({ status: 'failed', error: result.error?.slice(0, 500) })
        .eq('id', logRow.id);
      console.error('[send-email] gönderilemedi', { kind, ref_id, error: result.error });
      return json({ error: result.error }, 502);
    }

    await admin.from('email_log').update({ provider_id: result.id }).eq('id', logRow.id);
    return json({ sent: true, id: result.id });
  } catch (e) {
    console.error('[send-email] beklenmeyen hata', e);
    return json({ error: 'unexpected' }, 500);
  }
});
