// Sipariş uyarısı tekilleştirici (Order alert dedupe registry)
//
// Bir sipariş için uyarı artık iki bağımsız yoldan gelebiliyor:
//   1) Uygulama içi realtime / catch-up  → yerel bildirim (sendLocalNotification)
//   2) Sunucudaki Edge Function          → push notification
// İkisi de bilerek duruyor: realtime anında, push ise uygulama kapalı/donmuş
// olsa bile çalışıyor. Uygulama ön plandayken ikisi birlikte gelirse admin çift
// ses duyar. Bu kayıt defteri "bu sipariş için zaten alarm çaldı" bilgisini tutar;
// hangisi önce gelirse o gösterilir, ikincisi sessizce yutulur.
//
// Not: yalnızca ön planda gelen bildirimler için işe yarar — uygulama arka
// plandayken bildirimi OS gösterir ve JS hiç çalışmaz.

const alerted = new Set<string>();
// Uygulama günlerce açık kalabiliyor; sınırsız büyümesin
const MAX_ENTRIES = 500;

/**
 * Siparişi "uyarıldı" olarak işaretler.
 * @returns İlk kez işaretlendiyse true, daha önce uyarıldıysa false.
 */
export function markOrderAlerted(orderId: string): boolean {
  if (alerted.has(orderId)) return false;

  alerted.add(orderId);
  if (alerted.size > MAX_ENTRIES) {
    // Set ekleme sırasını koruyor — en eski kaydı at
    const oldest = alerted.values().next().value;
    if (oldest !== undefined) alerted.delete(oldest);
  }
  return true;
}

export function hasOrderBeenAlerted(orderId: string): boolean {
  return alerted.has(orderId);
}

/** Admin oturumu kapandığında temizle */
export function resetOrderAlerts(): void {
  alerted.clear();
}
