// catering-request — web /catering formundan gelen başvuru.
//
// Satırı yazar, restorana özet postası ve müşteriye alındı postası gönderir.
// JWT yok (config.toml): başvuran çoğu zaman üye değil. Kötüye kullanıma karşı
// gizli alan (honeypot), alan doğrulama ve e-posta başına saatlik tavan var.
// Yanıt kasıtlı olarak sade: hangi kontrolün takıldığı dışarı söylenmiyor.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail, getReplyTo, FROM_DEFAULT } from '../_shared/email.ts';
import { cateringRequestEmail, cateringAckEmail } from '../_shared/email-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const HOURLY_CAP_PER_EMAIL = 3;

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  // Gizli alan: gerçek tarayıcı boş bırakır, botlar doldurur. Sessizce "ok".
  if (str(body.website, 10)) return json({ ok: true });

  const name = str(body.name, 120);
  const email = str(body.email, 254)?.toLowerCase() ?? null;
  const phone = str(body.phone, 40);
  if (!name || name.length < 2) return json({ error: 'name is required' }, 400);
  if (!email || !email.includes('@')) return json({ error: 'a valid email is required' }, 400);
  if (!phone || phone.replace(/\D/g, '').length < 7) return json({ error: 'a valid phone is required' }, 400);

  const guestsRaw = Number(body.guests);
  const guests = Number.isFinite(guestsRaw) && guestsRaw > 0 ? Math.min(Math.round(guestsRaw), 5000) : null;
  const dateRaw = str(body.event_date, 10);
  const event_date = dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) && !Number.isNaN(Date.parse(dateRaw)) ? dateRaw : null;
  const service = body.service === 'delivery' || body.service === 'pickup' ? body.service : null;

  const record = {
    name,
    company: str(body.company, 120),
    email,
    phone,
    event_date,
    event_time: str(body.event_time, 40),
    guests,
    event_type: str(body.event_type, 60),
    service,
    address: service === 'delivery' ? str(body.address, 300) : null,
    notes: str(body.notes, 2000),
    source: 'web',
    user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
  };

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  try {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('catering_requests')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', since);
    if ((count ?? 0) >= HOURLY_CAP_PER_EMAIL) {
      console.log('[catering-request] throttled', email);
      return json({ ok: true });
    }

    const { data: saved, error } = await admin.from('catering_requests').insert(record).select('id').single();
    if (error || !saved) {
      console.error('[catering-request] insert failed', error);
      return json({ error: 'could not save request' }, 500);
    }

    const full = { id: saved.id as string, ...record };
    const restaurantEmail = await getReplyTo(admin);

    // Restorana: yanıt adresi müşteri.
    const toKitchen = cateringRequestEmail(full);
    const sent1 = await sendEmail({ from: FROM_DEFAULT, to: restaurantEmail, subject: toKitchen.subject, html: toKitchen.html, replyTo: email });
    await admin.from('email_log').insert({
      user_id: null, email: restaurantEmail, kind: 'catering_request', ref_id: saved.id,
      status: sent1.ok ? 'sent' : 'failed', provider_id: sent1.id ?? null, error: sent1.error?.slice(0, 500) ?? null,
    });
    if (!sent1.ok) console.error('[catering-request] kitchen email failed', sent1.error);

    // Müşteriye: alındı. Yanıt adresi restoran.
    const ack = cateringAckEmail(full);
    const sent2 = await sendEmail({ from: FROM_DEFAULT, to: email, subject: ack.subject, html: ack.html, replyTo: restaurantEmail });
    await admin.from('email_log').insert({
      user_id: null, email, kind: 'catering_ack', ref_id: saved.id,
      status: sent2.ok ? 'sent' : 'failed', provider_id: sent2.id ?? null, error: sent2.error?.slice(0, 500) ?? null,
    });

    return json({ ok: true, id: saved.id });
  } catch (e) {
    console.error('[catering-request] unhandled', e);
    return json({ error: 'unexpected error' }, 500);
  }
});
