// İleri tarihli sipariş ayarları (settings.scheduling_* + working_hours).
// Dilim hesabı scheduling.ts'te (web ve sunucuyla aynı kopya).
import { supabase } from '../lib/supabase';
import { DEFAULT_SCHEDULING, listSlots, SchedulingConfig, SlotDay, WorkingHoursLike } from './scheduling';

export interface SchedulingContext {
  config: SchedulingConfig;
  hours: WorkingHoursLike;
}

export async function getSchedulingContext(): Promise<SchedulingContext> {
  const { data, error } = await supabase
    .from('settings')
    .select('working_hours, scheduling_enabled, scheduling_min_lead_minutes, scheduling_max_days, scheduling_slot_minutes, scheduling_close_buffer_minutes')
    .limit(1)
    .maybeSingle();
  if (error || !data) return { config: DEFAULT_SCHEDULING, hours: null };
  return {
    config: {
      enabled: Boolean(data.scheduling_enabled ?? DEFAULT_SCHEDULING.enabled),
      min_lead_minutes: Number(data.scheduling_min_lead_minutes ?? DEFAULT_SCHEDULING.min_lead_minutes),
      max_days: Number(data.scheduling_max_days ?? DEFAULT_SCHEDULING.max_days),
      slot_minutes: Number(data.scheduling_slot_minutes ?? DEFAULT_SCHEDULING.slot_minutes),
      close_buffer_minutes: Number(data.scheduling_close_buffer_minutes ?? DEFAULT_SCHEDULING.close_buffer_minutes),
    },
    hours: (data.working_hours as WorkingHoursLike) ?? null,
  };
}

export async function getSlotDays(): Promise<SlotDay[]> {
  const ctx = await getSchedulingContext();
  return listSlots(ctx.hours, ctx.config);
}
