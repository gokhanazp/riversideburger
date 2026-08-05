-- Değerlendirme gönderimini tamamen bloklayan eksik bildirim tipi
--
-- notifications.valid_notification_type kısıtı şu tipleri kabul ediyordu:
--   order_status, points_earned, promotion, new_order_admin, general
-- Ama reviews tablosundaki trigger (notify_admins_on_new_review) admin'lere
-- 'new_review_admin' tipiyle bildirim yazıyor. Kısıt bu değeri reddettiği için
-- trigger patlıyor ve onunla birlikte reviews INSERT'i de geri alınıyordu:
-- kullanıcı "Değerlendirme oluşturulamadı: ... violates check constraint
-- valid_notification_type" hatası alıyor, hiçbir yorum kaydedilemiyordu.
--
-- 'new_review_admin' uygulamanın da beklediği değer: reviewService push data'sında
-- ve hem NotificationsScreen hem AdminNotifications render tarafında kullanılıyor.
-- Dolayısıyla doğru düzeltme kısıtı bu tipe açmak.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS valid_notification_type;

ALTER TABLE notifications ADD CONSTRAINT valid_notification_type
  CHECK (type IN (
    'order_status',
    'points_earned',
    'promotion',
    'new_order_admin',
    'new_review_admin',
    'general'
  ));
