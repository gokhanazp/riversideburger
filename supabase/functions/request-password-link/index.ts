// request-password-link — "şifre belirle" e-postası.
//
// İki giriş var:
//   (a) sipariş sayfasından order_number + public_token: misafir e-posta
//       yazmadan tek dokunuşla ister; belirteç zaten siparişin sahibi olduğunu
//       gösteriyor.
//   (b) giriş sayfasından e-posta: şifresini unutan üye ya da daha önce misafir
//       sipariş vermiş müşteri.
// Yanıt HER DURUMDA { ok: true }: hangi e-postaların kayıtlı olduğu sızmıyor.
//
// Bağlantı Supabase Auth'un kurtarma jetonu (generateLink → hashed_token).
// Web sayfası verifyOtp ile oturum açıp updateUser ile şifreyi yazıyor.
// redirect_to KULLANILMIYOR: Auth panelinde izin listesi değişikliği gerekmiyor
// ve bağlantı hangi cihazda/tarayıcıda açılırsa açılsın çalışıyor (PKCE'li
// resetPasswordForEmail, isteğin yapıldığı tarayıcıya bağlı kalıyordu; Gmail'in
// uygulama içi tarayıcısında kırılırdı). Jeton ömrü Auth ayarı mailer_otp_exp
// (1 saat), tek kullanımlık.
//
// JWT yok (config.toml verify_jwt=false): misafirin oturumu yok. Kötüye
// kullanıma karşı e-posta başına 2 dakikada bir, günde en fazla 5 posta.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail, getReplyTo, FROM_DEFAULT, SITE_URL } from '../_shared/email.ts';
import { setPasswordEmail } from '../_shared/email-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_GAP_MS = 2 * 60 * 1000;
const DAILY_CAP = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const ok = () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  const bad = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') return bad(405, 'POST required');

  let body: { order_number?: string; token?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return bad(400, 'invalid json');
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  try {
    // ── Kullanıcıyı çöz ─────────────────────────────────────────────────
    let userId: string | null = null;

    if (body.order_number && body.token) {
      if (!UUID.test(body.token)) return bad(400, 'invalid token');
      const { data: order } = await admin
        .from('orders')
        .select('user_id')
        .eq('order_number', body.order_number)
        .eq('public_token', body.token)
        .maybeSingle();
      userId = order?.user_id ?? null;
    } else if (body.email) {
      const email = body.email.trim().toLowerCase();
      if (!email.includes('@') || email.length > 254) return bad(400, 'invalid email');
      const { data: user } = await admin
        .from('users')
        .select('id')
        .ilike('email', email)
        .maybeSingle();
      userId = user?.id ?? null;
    } else {
      return bad(400, 'order_number + token, or email required');
    }

    // Bilinmeyen sipariş/e-posta: sessizce ok. Tarayan biri kayıtlı ve
    // kayıtsız adresi ayırt edemesin.
    if (!userId) return ok();

    const { data: user } = await admin
      .from('users')
      .select('id, email, full_name, signup_source')
      .eq('id', userId)
      .maybeSingle();
    if (!user?.email) return ok();

    // ── Aralık sınırı ───────────────────────────────────────────────────
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await admin
      .from('email_log')
      .select('created_at')
      .eq('kind', 'set_password')
      .eq('email', user.email)
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    const last = recent?.[0]?.created_at ? new Date(recent[0].created_at).getTime() : 0;
    if ((recent?.length ?? 0) >= DAILY_CAP || Date.now() - last < MIN_GAP_MS) {
      console.log('[request-password-link] throttled', { email: user.email });
      return ok();
    }

    // ── Jeton ───────────────────────────────────────────────────────────
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: user.email,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.error('[request-password-link] generateLink failed', linkError);
      return ok();
    }
    const url = `${SITE_URL}/account/set-password?token_hash=${encodeURIComponent(tokenHash)}`;

    // ── Gönder (defter önce) ────────────────────────────────────────────
    const isGuest = user.signup_source === 'guest';
    const built = setPasswordEmail({ name: user.full_name, isGuest, link: url });

    const { data: logRow } = await admin
      .from('email_log')
      .insert({ user_id: user.id, email: user.email, kind: 'set_password', ref_id: null })
      .select('id')
      .single();

    const replyTo = await getReplyTo(admin);
    const result = await sendEmail({
      from: FROM_DEFAULT,
      to: user.email,
      subject: built.subject,
      html: built.html,
      replyTo,
    });

    if (logRow?.id) {
      await admin
        .from('email_log')
        .update(
          result.ok
            ? { provider_id: result.id }
            : { status: 'failed', error: result.error?.slice(0, 500) }
        )
        .eq('id', logRow.id);
    }
    if (!result.ok) console.error('[request-password-link] send failed', result.error);

    return ok();
  } catch (e) {
    console.error('[request-password-link] unhandled', e);
    return bad(500, 'unexpected error');
  }
});
