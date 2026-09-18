// Supabase Edge Function: unsubscribe
//
// E-postadaki "abonelikten çık" bağlantısı buraya geliyor. OTURUM İSTEMİYOR:
// müşteriye "çıkmak için giriş yap" demek, çıkmayı zorlaştırmak demektir ve
// Kanada'da ticari postada çalışan bir çıkış yolu zorunlu. Güvenliği
// tahmin edilemez jeton sağlıyor (users.unsubscribe_token).
//
// Bu fonksiyon --no-verify-jwt ile dağıtılmalı; aksi halde bağlantı 401 döner.
//
// SADECE KAMPANYA postalarını kapatıyor. Sipariş fişi ve şifre sıfırlama
// işlemsel postalar; müşterinin ödediği siparişin fişini kesmek doğru olmaz.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const page = (title: string, message: string, ok = true) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" style="padding:48px 16px;"><tr><td align="center">
  <table role="presentation" width="100%" style="max-width:440px;background:#fff;border:1px solid #e9ecef;border-radius:16px;">
    <tr><td style="background:#1a1a1a;padding:18px 22px;">
      <span style="color:#fff;font-size:17px;font-weight:800;">RIVERSIDE <span style="color:#e63946;">BURGERS</span></span>
    </td></tr>
    <tr><td style="padding:28px 22px;">
      <h1 style="margin:0 0 10px;font-size:19px;color:${ok ? '#1a1a1a' : '#dc3545'};">${title}</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:23px;color:#6c757d;">${message}</p>
      <a href="https://riversideburgers.ca" style="display:inline-block;padding:12px 22px;background:#e63946;color:#fff;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;">Back to the menu</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`;

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

serve(async (req) => {
  const url = new URL(req.url);
  // Jeton sorgu dizgisinde ya da tek tıklama POST gövdesinde gelebilir.
  let token = url.searchParams.get('token');
  if (!token && req.method === 'POST') {
    const form = await req.formData().catch(() => null);
    token = (form?.get('token') as string | null) ?? null;
  }

  if (!token) {
    return html(page('Link is not valid', 'This unsubscribe link is missing its code. Reply to any of our emails and we will take you off the list.', false), 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data, error } = await admin
    .from('users')
    .update({ marketing_opt_out_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .select('email')
    .maybeSingle();

  if (error) {
    console.error('[unsubscribe] güncelleme başarısız', error.message);
    return html(page('Something went wrong', 'We could not process that just now. Please reply to any of our emails and we will take you off the list.', false), 500);
  }

  if (!data) {
    // Jeton tanınmadı. Yine de nötr bir mesaj veriyoruz: "böyle bir kayıt
    // yok" demek, jeton deneyen birine bilgi sızdırmak olur.
    return html(page('You are unsubscribed', 'You will not receive marketing emails from us. Order receipts still arrive, since those confirm something you paid for.'));
  }

  return html(page('You are unsubscribed', 'You will not receive marketing emails from us any more. Order receipts still arrive, since those confirm something you paid for.'));
});
