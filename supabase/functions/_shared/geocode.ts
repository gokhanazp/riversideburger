// Adres → koordinat. LocationIQ, token Supabase secret'ında.
//
// Neden burada ve neden geocode-address çağrılmıyor: o fonksiyon gerçek bir
// oturum istiyor (supabase.auth.getUser) çünkü mobil uygulamanın adres
// ekleme ekranı için yazıldı. Web'de misafir siparişte oturum yok. O
// fonksiyonu anon anahtara açmak, dışarıya bedava bir geocode proxy'si
// bırakmak olurdu — LocationIQ kotası günlük ve sınırlı.
//
// Bunun yerine geocode sunucunun içinde, sepet doğrulandıktan SONRA çalışıyor:
// çağırmak için geçerli ürün kimlikleri göndermek gerekiyor, bu da kotayı
// eğlence için tüketmeyi zahmetli hale getiriyor.

export interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
}

// Sokak adı ekleri: eşleştirmede anlam taşımıyorlar, "Street" iki adresi
// benzer göstermeye yetmemeli.
const SUFFIXES = new Set([
  'street','st','avenue','ave','road','rd','drive','dr','boulevard','blvd',
  'lane','ln','court','crt','ct','crescent','cres','way','place','pl',
  'trail','terrace','parkway','pkwy','circle','square','east','west','north','south','e','w','n','s',
]);

const tokens = (value: string) =>
  new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !SUFFIXES.has(t))
  );

/** Kanada posta kodunun ilk üç karakteri (FSA), ör. M4M. */
const fsa = (value: string | undefined | null) => {
  const clean = (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]\d[A-Z]/.test(clean) ? clean.slice(0, 3) : null;
};

export interface AddressInput {
  street_number?: string;
  street_name?: string;
  unit_number?: string | null;
  city?: string;
  province?: string;
  postal_code?: string;
}

export async function geocodeAddress(address: AddressInput): Promise<GeocodeResult | null> {
  const token = Deno.env.get('LOCATIONIQ_TOKEN');
  if (!token) {
    console.error('[geocode] LOCATIONIQ_TOKEN is not configured');
    return null;
  }

  const street = [address.street_number, address.street_name].filter(Boolean).join(' ').trim();
  const query = [street, address.city, address.province, address.postal_code, 'Canada']
    .map((p) => (p ?? '').toString().trim())
    .filter(Boolean)
    .join(', ');
  if (!street || !query) return null;

  const url = new URL('https://us1.locationiq.com/v1/search');
  url.searchParams.set('key', token);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', 'ca');

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      console.error('[geocode] LocationIQ returned', res.status);
      return null;
    }
    const results = (await res.json()) as {
      lat: string;
      lon: string;
      display_name: string;
      address?: { road?: string; house_number?: string; postcode?: string };
    }[];
    const first = results?.[0];
    if (!first) return null;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    // ── Eşleşme gerçekten bu adres mi? ───────────────────────────────────
    // LocationIQ bulanık eşleştirme yapıyor: var olmayan bir sokak adı bile
    // yakındaki bir noktaya oturuyor ve makul bir mesafe döndürüyor. Testte
    // uydurma bir adres 2.73 km'ye eşleşip kabul edilmişti — kurye yanlış
    // yere giderdi. O yüzden sonucu iki koşulla süzüyoruz.
    const matched = first.address ?? {};

    // 1) Sonuç bir SOKAĞA oturmalı. Yoksa mahalle/şehir merkezine düşmüşüz.
    if (!matched.road) {
      console.warn('[geocode] result has no road, rejecting', first.display_name);
      return null;
    }

    // 2) Sokak adı örtüşmeli. Ekler ("Street", "East") atılıyor; kalan
    //    anlamlı kelimelerden en az biri tutmalı.
    const typedStreet = tokens(address.street_name ?? '');
    const matchedStreet = tokens(matched.road);
    const streetOverlap = [...typedStreet].some((t) => matchedStreet.has(t));
    if (typedStreet.size > 0 && !streetOverlap) {
      console.warn('[geocode] street mismatch', { typed: address.street_name, matched: matched.road });
      return null;
    }

    // 3) Posta kodu bölgesi (FSA) çelişmemeli. Müşteri geçerli bir FSA
    //    yazdıysa ve sonuç başka bir bölgeyi gösteriyorsa güvenmiyoruz.
    const typedFsa = fsa(address.postal_code);
    const matchedFsa = fsa(matched.postcode);
    if (typedFsa && matchedFsa && typedFsa !== matchedFsa) {
      console.warn('[geocode] postal code mismatch', { typedFsa, matchedFsa });
      return null;
    }

    return { lat, lng, display_name: first.display_name };
  } catch (error) {
    console.error('[geocode] request failed', error);
    return null;
  }
}
