// Supabase Edge Function: Uber Direct Cancel Delivery
// Bir sipariş sistemimizde iptal edildiğinde Uber'e de iptal bildirilir.
// ZORUNLU (sertifikasyon): POST /customers/{customer_id}/deliveries/{delivery_id}/cancel
// cancelation_reason önceden tanımlı değerlerden biri olmalı; "other" ise
// additional_description zorunludur. Aksi halde kurye yönlendirilmeye devam eder
// ve operasyon Uber ile uyumsuz kalır.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, uberFetch } from '../_shared/uber.ts';

// Uber'in kabul ettiği iptal sebepleri (yazım/case birebir eşleşmeli)
const VALID_REASONS = new Set([
  'out_of_items',
  'store_closed',
  'customer_called_to_cancel',
  'store_too_busy',
  'courier_delayed_en_route_to_pickup',
  'too_expensive',
  'customer_changed_order_requirements',
  'delivery_vehicle_too_small',
  'no_courier_assigned',
  'other',
]);

interface CancelRequest {
  order_id: string;
  cancelation_reason: string;
  additional_description?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Çağıranı doğrula (user-scoped)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Güvenilir yazımlar için service-role
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Sadece admin sipariş iptal edip Uber'e cancel çağırabilir
    const { data: profile } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role !== 'admin') throw new Error('Forbidden: admin only');

    const body = await req.json() as CancelRequest;
    const { order_id, cancelation_reason } = body;
    const additional_description = body.additional_description?.trim() || undefined;

    if (!order_id) throw new Error('order_id is required');
    if (!cancelation_reason || !VALID_REASONS.has(cancelation_reason)) {
      throw new Error('Invalid or missing cancelation_reason');
    }
    // "other" seçildiyse açıklama zorunlu (Uber gerekliliği)
    if (cancelation_reason === 'other' && !additional_description) {
      throw new Error('additional_description is required when cancelation_reason is "other"');
    }

    const { data: order, error: orderErr } = await adminClient
      .from('orders')
      .select('id, uber_delivery_id, uber_status, status')
      .eq('id', order_id)
      .single();
    if (orderErr || !order) throw new Error(`Order not found: ${orderErr?.message ?? 'no data'}`);

    // Uber teslimatı varsa ÖNCE Uber'e iptal bildir — doğru delivery_id (del_…) ile.
    // Başarısız olursa iç durumu değiştirmeyiz ki sistem Uber ile uyumsuz kalmasın.
    let uberCanceled = false;
    if (order.uber_delivery_id) {
      const cancelBody: Record<string, unknown> = { cancelation_reason };
      if (additional_description) cancelBody.additional_description = additional_description;

      await uberFetch(`/deliveries/${order.uber_delivery_id}/cancel`, {
        method: 'POST',
        body: JSON.stringify(cancelBody),
      });
      uberCanceled = true;
    }

    // Uber onayından (veya Uber teslimatı yoksa doğrudan) sonra siparişi iptal işaretle
    const { error: updErr } = await adminClient
      .from('orders')
      .update({
        status: 'cancelled',
        uber_status: order.uber_delivery_id ? 'canceled' : order.uber_status,
        cancelation_reason,
        cancelation_description: additional_description ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id);
    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({ ok: true, uber_canceled: uberCanceled }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (err) {
    console.error('uber-cancel-delivery error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});
