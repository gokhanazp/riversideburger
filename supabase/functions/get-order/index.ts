// get-order — misafirin onay sayfası için tek sipariş döndürür.
//
// orders üzerindeki RLS `auth.uid() = user_id` istiyor, yani oturumsuz bir
// müşteri kendi siparişini bile okuyamıyor. Politikayı gevşetmek yerine bu
// fonksiyon service_role ile okuyor ama ÖNCE order_number + public_token
// çiftinin eşleştiğini doğruluyor. Belirteç rastgele bir uuid; sipariş
// numarası tahmin edilebilir olsa da belirteç değil.
//
// Döndürülen alanlar bilinçli olarak sınırlı: müşteri adı, telefonu, adresi
// ve e-postası YOK. Bağlantı paylaşılırsa da kişisel veri sızmıyor.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const { order_number, token } = (await req.json()) as {
      order_number?: string;
      token?: string;
    };

    if (!order_number || !token || !UUID.test(token)) {
      return json({ error: 'order_number and token are required' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const { data, error } = await admin
      .from('orders')
      .select(
        'order_number, status, payment_status, delivery_method, total_amount, tax_amount, discount_amount, tip_amount, delivery_fee, points_used, created_at, campaign:campaigns(name_en), order_items(quantity, price, subtotal, product:products(name))'
      )
      .eq('order_number', order_number)
      .eq('public_token', token)
      .maybeSingle();

    if (error) {
      console.error('[get-order]', error);
      return json({ error: 'could not load order' }, 500);
    }
    // Eşleşmeyen belirteç ile var olmayan sipariş aynı yanıtı alıyor: hangi
    // sipariş numaralarının gerçek olduğunu sızdırmamak için.
    if (!data) return json({ error: 'not found' }, 404);

    return json({ order: data });
  } catch (error) {
    console.error('[get-order] unhandled', error);
    return json({ error: 'unexpected error' }, 500);
  }
});
