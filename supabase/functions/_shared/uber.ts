// Uber Direct shared helpers
// OAuth client credentials flow + typed API wrappers

const UBER_OAUTH_URL = 'https://auth.uber.com/oauth/v2/token';
const UBER_API_BASE = 'https://api.uber.com/v1/customers';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory token cache (Edge Function instance lifetime)
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getUberAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const clientId = Deno.env.get('UBER_CLIENT_ID');
  const clientSecret = Deno.env.get('UBER_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('UBER_CLIENT_ID or UBER_CLIENT_SECRET not configured');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    scope: 'eats.deliveries',
  });

  const res = await fetch(UBER_OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Uber OAuth failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return data.access_token;
}

export async function uberFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const customerId = Deno.env.get('UBER_CUSTOMER_ID');
  if (!customerId) throw new Error('UBER_CUSTOMER_ID not configured');

  const token = await getUberAccessToken();
  const url = `${UBER_API_BASE}/${customerId}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Uber API ${res.status} ${path}: ${text}`);
  }
  return text ? JSON.parse(text) as T : ({} as T);
}

export interface RestaurantPickup {
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  // Yapılandırılmış adres (Uber API için zorunlu)
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export function getRestaurantPickup(): RestaurantPickup {
  const name = Deno.env.get('RESTAURANT_NAME');
  const phone = Deno.env.get('RESTAURANT_PHONE');
  const address = Deno.env.get('RESTAURANT_ADDRESS');
  const lat = Number(Deno.env.get('RESTAURANT_LAT'));
  const lng = Number(Deno.env.get('RESTAURANT_LNG'));

  if (!name || !phone || !address || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Restaurant pickup env vars not fully configured');
  }
  return {
    name,
    phone,
    address,
    lat,
    lng,
    street: '688 Queen Street East',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M4M 1G9',
    country: 'CA',
  };
}

export function getPickupAddressJson(): string {
  const p = getRestaurantPickup();
  return JSON.stringify({
    street_address: [p.street],
    city: p.city,
    state: p.province,
    zip_code: p.postalCode,
    country: p.country,
  });
}

// Maps Uber Direct status to internal orders.status enum
// Uber statuses: pending, pickup, pickup_complete, dropoff, delivered, canceled, returned
export function mapUberStatusToOrderStatus(uberStatus: string): string | null {
  switch (uberStatus) {
    case 'pending':         return 'confirmed';
    case 'pickup':          return 'preparing';
    case 'pickup_complete': return 'delivering';
    case 'dropoff':         return 'delivering';
    case 'delivered':       return 'delivered';
    case 'canceled':        return 'cancelled';
    case 'returned':        return 'cancelled';
    default:                return null;
  }
}
