// Sipariş listesi yenileme veriyolu (Orders refresh bus)
//
// Sunucu push bildirimi, uygulamadaki en güvenilir kanal: Edge Function →
// Expo Push → APNs/FCM yolu her siparişte çalıştığı kanıtlandı (bildirim hep
// geliyor). Buna karşılık liste, Supabase realtime + HTTP polling'e bağlı ve
// tablet saatlerce açık kaldığında bu iki katman birlikte susuyor.
//
// Bu veriyolu ikisini birleştiriyor: bildirim CİHAZA ULAŞTIĞI anda listeye
// "hemen yenile" diyor. Böylece realtime ölse ve polling tikleri kaçsa bile
// yeni sipariş ekrana düşmek için tek bir çalışan kanala daha sahip oluyor.
//
// Bilinçli olarak modül düzeyinde: bildirim dinleyicisi App.tsx'te, liste
// AdminOrders'ta; ikisi arasında ortak bir React ağacı yok.

type Listener = (reason: string) => void;

const listeners = new Set<Listener>();

export const onOrdersRefresh = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const requestOrdersRefresh = (reason: string) => {
  listeners.forEach((listener) => {
    try {
      listener(reason);
    } catch {
      // Bir dinleyicinin hatası diğerlerini engellemesin
    }
  });
};
