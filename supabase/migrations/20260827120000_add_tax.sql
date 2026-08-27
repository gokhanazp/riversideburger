-- Satış vergisi (HST) desteği
--
-- Vergi bugüne kadar hiçbir yerde uygulanmıyordu: ne kodda, ne veritabanında,
-- ne Stripe'a giden tutarda. Ontario'da restoran satışları %13 HST'ye tabi.
--
-- Karar (kullanıcı onayıyla):
--   • Menü fiyatları vergi HARİÇ → %13 üzerine eklenir, tahsilat artar
--   • Vergi tabanı = (kalem toplamı - indirim - puan) + teslimat ücreti
--   • Bahşiş vergiye tabi DEĞİL (Kanada'da gratuity HST'den muaf) ve bahşiş
--     yine vergi ÖNCESİ tutardan hesaplanıyor
--
-- Oran sabit yazılmıyor: vergi oranları değişir ve her değişiklikte yeni sürüm
-- çıkarmak istemiyoruz. settings.tax_rate üzerinden yönetiliyor.

alter table public.settings
  add column if not exists tax_rate numeric not null default 13.00;

comment on column public.settings.tax_rate is
  'Satış vergisi oranı, yüzde olarak (Ontario HST = 13.00). Vergi tabanı: indirim ve puan düşülmüş kalem toplamı + teslimat ücreti; bahşiş hariç.';

-- Siparişte tahsil edilen vergi tutarı. Mevcut siparişlerde 0 kalır, böylece
-- eski siparişlerin tutar dökümü aynen tutmaya devam eder.
alter table public.orders
  add column if not exists tax_amount numeric not null default 0;

comment on column public.orders.tax_amount is
  'Sipariş anında tahsil edilen vergi tutarı. 0 = vergi öncesi dönemden kalan sipariş.';

do $$
declare v_rate numeric;
begin
  select tax_rate into v_rate from public.settings limit 1;
  raise notice '✅ tax_rate = %, orders.tax_amount eklendi (mevcut siparişler 0)', v_rate;
end $$;
