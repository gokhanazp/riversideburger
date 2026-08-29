# Edge Function testleri

Ödeme akışının değişmezlerini doğrular; en önemlisi **sipariş satırı ödeme
tamamlanmadan oluşmaz**. Gerçek Supabase'e bağlanmaz, `fakedb.ts` içindeki
istemci taklidini kullanır.

```sh
deno run --allow-net --allow-read supabase/tests/checkout.test.ts
```

Ödeme akışına dokunan her değişiklikten sonra çalıştırın. `orders` tablosuna
ne zaman yazıldığı bu testlerin tam olarak ölçtüğü şey.
