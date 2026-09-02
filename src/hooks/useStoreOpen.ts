// Mağaza şu anda açık mı? (Is the store open right now?)
//
// Çalışma saatleri panelden değişiyor ve gün içinde açılıp kapanıyor, o yüzden
// ekran her odaklandığında yeniden okunuyor. Bir kez okuyup saklamak,
// uygulamayı akşam açık bırakıp gece açan müşteriye "açık" göstermek olurdu.
//
// Bilinmiyor durumu (null) bilinçli: veri gelmeden "kapalı" göstermek, açık
// bir restoranı bir anlığına kapalı ilan etmek demek.
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { isStoreOpenNow, getTodayHoursLabel } from '../services/workingHoursService';

export const useStoreOpen = () => {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [todayHours, setTodayHours] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [open, label] = await Promise.all([isStoreOpenNow(), getTodayHoursLabel()]);
    setIsOpen(open);
    setTodayHours(label);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { isOpen, todayHours, refresh };
};
