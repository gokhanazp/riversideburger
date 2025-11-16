// Working Hours Service
// Çalışma saatleri servisi

import { supabase } from '../lib/supabase';

// Çalışma saatleri tipi (Working hours type)
export interface DaySchedule {
  enabled: boolean; // Gün açık mı? (Is day open?)
  open: string; // Açılış saati (Opening time) - Format: "HH:MM"
  close: string; // Kapanış saati (Closing time) - Format: "HH:MM"
}

export interface WorkingHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

// Gün isimleri (Day names)
export const DAY_NAMES: (keyof WorkingHours)[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

// Varsayılan çalışma saatleri (Default working hours)
export const DEFAULT_WORKING_HOURS: WorkingHours = {
  monday: { enabled: true, open: '09:00', close: '22:00' },
  tuesday: { enabled: true, open: '09:00', close: '22:00' },
  wednesday: { enabled: true, open: '09:00', close: '22:00' },
  thursday: { enabled: true, open: '09:00', close: '22:00' },
  friday: { enabled: true, open: '09:00', close: '23:00' },
  saturday: { enabled: true, open: '10:00', close: '23:00' },
  sunday: { enabled: true, open: '10:00', close: '22:00' },
};

/**
 * Mağazanın şu anda açık olup olmadığını kontrol et
 * (Check if store is currently open)
 */
export const isStoreOpenNow = async (): Promise<boolean> => {
  try {
    // Ayarları getir (Get settings)
    const { data: settings, error } = await supabase
      .from('settings')
      .select('is_open, auto_close_enabled, working_hours')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching settings:', error);
      return true; // Hata durumunda açık kabul et (Default to open on error)
    }

    if (!settings) {
      return true; // Ayar yoksa açık kabul et (Default to open if no settings)
    }

    // Manuel olarak kapalıysa (If manually closed)
    if (!settings.is_open) {
      return false;
    }

    // Otomatik kapanma kapalıysa, sadece is_open'a bak (If auto close disabled, only check is_open)
    if (!settings.auto_close_enabled) {
      return settings.is_open;
    }

    // Çalışma saatlerini kontrol et (Check working hours)
    const workingHours = settings.working_hours as WorkingHours;
    if (!workingHours) {
      return settings.is_open; // Çalışma saatleri yoksa is_open'a bak
    }

    return isOpenAtTime(workingHours, new Date());
  } catch (error) {
    console.error('❌ Error in isStoreOpenNow:', error);
    return true; // Hata durumunda açık kabul et
  }
};

/**
 * Belirli bir zamanda mağazanın açık olup olmadığını kontrol et
 * (Check if store is open at specific time)
 */
export const isOpenAtTime = (workingHours: WorkingHours, date: Date): boolean => {
  // Günü al (Get day of week) - 0: Sunday, 1: Monday, ..., 6: Saturday
  const dayIndex = date.getDay();
  
  // Day index'i day name'e çevir (Convert day index to day name)
  const dayNames: (keyof WorkingHours)[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  
  const dayName = dayNames[dayIndex];
  const daySchedule = workingHours[dayName];

  // Gün kapalıysa (If day is closed)
  if (!daySchedule || !daySchedule.enabled) {
    return false;
  }

  // Şu anki saati al (Get current time)
  const currentTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  // Saat karşılaştırması (Time comparison)
  return currentTime >= daySchedule.open && currentTime <= daySchedule.close;
};

/**
 * Çalışma saatlerini getir (Get working hours)
 */
export const getWorkingHours = async (): Promise<WorkingHours | null> => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('working_hours')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching working hours:', error);
      return null;
    }

    return (data?.working_hours as WorkingHours) || DEFAULT_WORKING_HOURS;
  } catch (error) {
    console.error('❌ Error in getWorkingHours:', error);
    return null;
  }
};

/**
 * Çalışma saatlerini güncelle (Update working hours)
 */
export const updateWorkingHours = async (
  workingHours: WorkingHours,
  autoCloseEnabled: boolean
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('settings')
      .update({
        working_hours: workingHours,
        auto_close_enabled: autoCloseEnabled,
      })
      .limit(1);

    if (error) {
      console.error('❌ Error updating working hours:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error in updateWorkingHours:', error);
    return false;
  }
};

