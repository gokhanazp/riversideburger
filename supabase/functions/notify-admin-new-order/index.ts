// Supabase Edge Function: notify-admin-new-order
//
// Yeni sipariş geldiğinde admin cihazlarına SUNUCU TARAFINDAN push gönderir.
// Uygulama kapalı, arka planda veya realtime bağlantısı ölü olsa bile bildirim
// düşer — tek güvenilir yol bu. (In-app realtime yalnızca uygulama açıkken çalışır.)
//
// Tetikleyici: public.orders üzerindeki AFTER INSERT trigger'ı (pg_net ile POST).
// Bkz. supabase/migrations/20260817120000_admin_push_on_new_order.sql
//
// Neden client'tan değil: eskiden push'u siparişi veren MÜŞTERİNİN cihazı
// gönderiyordu (orderService). Müşteri RLS yüzünden ne diğer kullanıcıları ne de
// admin push_tokens'ını okuyabildiği için istek sessizce boş dönüyordu.
// Burada service role ile okunuyor.
//
// Deploy (verify_jwt kapalı — kimlik doğrulama paylaşılan sır ile):
//   supabase functions deploy notify-admin-new-order --no-verify-jwt
//   supabase secrets set ADMIN_PUSH_SECRET='<uzun-rastgele-sir>'

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Expo tek istekte en fazla 100 mesaj kabul ediyor
const CHUNK_SIZE = 100;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-admin-push-secret',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1) Paylaşılan sır ile doğrula. Fonksiyon --no-verify-jwt ile deploy edildiği
    //    için tek koruma bu; sır yoksa fonksiyonu hiç çalıştırma.
    const expectedSecret = Deno.env.get('ADMIN_PUSH_SECRET');
    if (!expectedSecret) {
      console.error('ADMIN_PUSH_SECRET tanımlı değil');
      return json({ error: 'not configured' }, 500);
    }
    if (req.headers.get('x-admin-push-secret') !== expectedSecret) {
      return json({ error: 'unauthorized' }, 401);
    }

    // 2) Gövdeyi çöz. Hem DB trigger'ının gönderdiği { order_id } hem de
    //    Supabase Database Webhook formatı ({ record: {...} }) desteklenir.
    const payload = await req.json().catch(() => ({}));
    const orderId: string | undefined =
      payload?.order_id ?? payload?.record?.id ?? payload?.new?.id;

    if (!orderId) {
      return json({ error: 'order_id missing' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // 3) Siparişi ve müşteri adını çek
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, delivery_method, user_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Sipariş bulunamadı:', orderId, orderError?.message);
      return json({ error: 'order not found', orderId }, 404);
    }

    let customerName = 'Müşteri';
    if (order.user_id) {
      const { data: customer } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', order.user_id)
        .single();
      if (customer?.full_name) customerName = customer.full_name;
    }

    // Para birimi admin ayarından — uygulamadaki formatPrice ile aynı sembol
    const { data: currencyRow } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'app_currency')
      .maybeSingle();
    const symbol = currencyRow?.setting_value === 'TRY' ? '₺' : '$';

    // 4) Admin'lerin aktif push token'larını al
    const { data: admins, error: adminError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin');

    if (adminError) {
      console.error('Admin listesi okunamadı:', adminError.message);
      return json({ error: 'admin lookup failed' }, 500);
    }
    if (!admins?.length) {
      console.warn('Admin kullanıcı yok — push gönderilmedi');
      return json({ sent: 0, reason: 'no admins' });
    }

    const { data: tokenRows, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token')
      .in(
        'user_id',
        admins.map((a) => a.id)
      )
      .eq('is_active', true);

    if (tokenError) {
      console.error('Push token okunamadı:', tokenError.message);
      return json({ error: 'token lookup failed' }, 500);
    }

    // Aynı token birden fazla satırda olabilir — tekilleştir
    const tokens: string[] = [
      ...new Set<string>((tokenRows ?? []).map((r: { token: string }) => r.token).filter(Boolean)),
    ];
    if (!tokens.length) {
      console.warn('Aktif admin push token yok — push gönderilmedi');
      return json({ sent: 0, reason: 'no tokens' });
    }

    // 5) Expo Push API'ye gönder
    const methodTag = order.delivery_method === 'pickup' ? ' [Pickup]' : '';
    const title = `🔔 Yeni Sipariş!${methodTag}`;
    const body = `${customerName} - ${symbol}${Number(order.total_amount).toFixed(2)}`;

    const buildMessage = (token: string) => ({
      to: token,
      title,
      body,
      // iOS mp3 bildirim sesini desteklemiyor; Android'de özel ses zaten
      // 'admin_orders' kanalından (order_sound.mp3) geliyor.
      sound: 'default',
      channelId: 'admin_orders',
      priority: 'high',
      badge: 1,
      // Yeni sipariş 30 dakika sonra anlamsız — teslim edilemezse düşsün
      ttl: 1800,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        type: 'new_order_admin',
        deliveryMethod: order.delivery_method,
      },
    });

    const deadTokens: string[] = [];
    let okCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
      const chunk = tokens.slice(i, i + CHUNK_SIZE);
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk.map(buildMessage)),
      });

      const result = await response.json().catch(() => null);
      const tickets: ExpoTicket[] = result?.data ?? [];

      if (!response.ok || !tickets.length) {
        console.error('Expo push hatası:', response.status, JSON.stringify(result));
        errors.push(`expo ${response.status}`);
        continue;
      }

      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') {
          okCount += 1;
          return;
        }
        errors.push(ticket.details?.error ?? ticket.message ?? 'unknown');
        // Cihaz uygulamayı silmiş/token geçersiz — bir daha denemeyelim
        if (ticket.details?.error === 'DeviceNotRegistered') {
          deadTokens.push(chunk[index]);
        }
      });
    }

    // 6) Ölü token'ları pasife çek — liste zamanla çöplenmesin
    if (deadTokens.length) {
      await supabase
        .from('push_tokens')
        .update({ is_active: false })
        .in('token', deadTokens);
      console.log(`${deadTokens.length} geçersiz token pasife alındı`);
    }

    console.log(
      `[admin push] sipariş ${order.order_number}: ${okCount}/${tokens.length} gönderildi` +
        (errors.length ? ` — hatalar: ${errors.join(', ')}` : '')
    );

    return json({
      orderId: order.id,
      orderNumber: order.order_number,
      tokens: tokens.length,
      sent: okCount,
      deactivated: deadTokens.length,
      errors,
    });
  } catch (error) {
    console.error('notify-admin-new-order beklenmedik hata:', error);
    return json({ error: String(error) }, 500);
  }
});
