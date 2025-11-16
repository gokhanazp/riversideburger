// Working Hours Modal Component
// Çalışma saatleri modal bileşeni

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { WorkingHours, DaySchedule } from '../services/workingHoursService';

interface WorkingHoursModalProps {
  visible: boolean;
  workingHours: WorkingHours;
  autoCloseEnabled: boolean;
  onClose: () => void;
  onSave: (workingHours: WorkingHours, autoCloseEnabled: boolean) => void;
}

const WorkingHoursModal: React.FC<WorkingHoursModalProps> = ({
  visible,
  workingHours: initialWorkingHours,
  autoCloseEnabled: initialAutoCloseEnabled,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [workingHours, setWorkingHours] = useState<WorkingHours>(initialWorkingHours);
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(initialAutoCloseEnabled);

  // Gün isimlerini çevir (Translate day names)
  const dayTranslations: Record<keyof WorkingHours, string> = {
    monday: t('admin.settings.workingHours.monday'),
    tuesday: t('admin.settings.workingHours.tuesday'),
    wednesday: t('admin.settings.workingHours.wednesday'),
    thursday: t('admin.settings.workingHours.thursday'),
    friday: t('admin.settings.workingHours.friday'),
    saturday: t('admin.settings.workingHours.saturday'),
    sunday: t('admin.settings.workingHours.sunday'),
  };

  // Gün sırasını güncelle (Update day order)
  const dayOrder: (keyof WorkingHours)[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  // Gün durumunu değiştir (Toggle day enabled)
  const toggleDay = (day: keyof WorkingHours) => {
    setWorkingHours({
      ...workingHours,
      [day]: {
        ...workingHours[day],
        enabled: !workingHours[day].enabled,
      },
    });
  };

  // Saati güncelle (Update time)
  const updateTime = (day: keyof WorkingHours, field: 'open' | 'close', value: string) => {
    setWorkingHours({
      ...workingHours,
      [day]: {
        ...workingHours[day],
        [field]: value,
      },
    });
  };

  // Kaydet (Save)
  const handleSave = () => {
    onSave(workingHours, autoCloseEnabled);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('admin.settings.workingHours.title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Auto Close Toggle */}
            <View style={styles.autoCloseSection}>
              <View style={styles.autoCloseHeader}>
                <Ionicons name="time-outline" size={24} color={Colors.primary} />
                <View style={styles.autoCloseText}>
                  <Text style={styles.autoCloseTitle}>
                    {t('admin.settings.workingHours.autoClose')}
                  </Text>
                  <Text style={styles.autoCloseDesc}>
                    {t('admin.settings.workingHours.autoCloseDesc')}
                  </Text>
                </View>
              </View>
              <Switch
                value={autoCloseEnabled}
                onValueChange={setAutoCloseEnabled}
                trackColor={{ false: '#ccc', true: Colors.primary + '40' }}
                thumbColor={autoCloseEnabled ? Colors.primary : '#999'}
              />
            </View>

            {/* Days List */}
            <View style={styles.daysSection}>
              {dayOrder.map((day) => {
                const schedule = workingHours[day];
                return (
                  <View key={day} style={styles.dayCard}>
                    {/* Day Header */}
                    <View style={styles.dayHeader}>
                      <Text style={styles.dayName}>{dayTranslations[day]}</Text>
                      <Switch
                        value={schedule.enabled}
                        onValueChange={() => toggleDay(day)}
                        trackColor={{ false: '#ccc', true: Colors.primary + '40' }}
                        thumbColor={schedule.enabled ? Colors.primary : '#999'}
                      />
                    </View>

                    {/* Time Inputs */}
                    {schedule.enabled && (
                      <View style={styles.timeRow}>
                        <View style={styles.timeInput}>
                          <Text style={styles.timeLabel}>
                            {t('admin.settings.workingHours.open')}
                          </Text>
                          <TextInput
                            style={styles.input}
                            value={schedule.open}
                            onChangeText={(value) => updateTime(day, 'open', value)}
                            placeholder="09:00"
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                        <Text style={styles.timeSeparator}>-</Text>
                        <View style={styles.timeInput}>
                          <Text style={styles.timeLabel}>
                            {t('admin.settings.workingHours.close')}
                          </Text>
                          <TextInput
                            style={styles.input}
                            value={schedule.close}
                            onChangeText={(value) => updateTime(day, 'close', value)}
                            placeholder="22:00"
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.large,
    borderTopRightRadius: BorderRadius.large,
    maxHeight: '90%',
    ...Shadows.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.large,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: FontSizes.large,
    fontWeight: '600',
    color: Colors.text,
  },
  closeButton: {
    padding: Spacing.small,
  },
  content: {
    padding: Spacing.large,
  },
  autoCloseSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    padding: Spacing.medium,
    borderRadius: BorderRadius.medium,
    marginBottom: Spacing.large,
    ...Shadows.small,
  },
  autoCloseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.medium,
  },
  autoCloseText: {
    marginLeft: Spacing.medium,
    flex: 1,
  },
  autoCloseTitle: {
    fontSize: FontSizes.medium,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  autoCloseDesc: {
    fontSize: FontSizes.small,
    color: Colors.textSecondary,
  },
  daysSection: {
    gap: Spacing.medium,
  },
  dayCard: {
    backgroundColor: Colors.card,
    padding: Spacing.medium,
    borderRadius: BorderRadius.medium,
    ...Shadows.small,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayName: {
    fontSize: FontSizes.medium,
    fontWeight: '600',
    color: Colors.text,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.medium,
    gap: Spacing.medium,
  },
  timeInput: {
    flex: 1,
  },
  timeLabel: {
    fontSize: FontSizes.small,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.small,
    padding: Spacing.small,
    fontSize: FontSizes.medium,
    color: Colors.text,
  },
  timeSeparator: {
    fontSize: FontSizes.large,
    color: Colors.textSecondary,
    marginTop: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: Spacing.large,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.medium,
  },
  cancelButton: {
    flex: 1,
    padding: Spacing.medium,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FontSizes.medium,
    fontWeight: '600',
    color: Colors.text,
  },
  saveButton: {
    flex: 1,
    padding: Spacing.medium,
    borderRadius: BorderRadius.medium,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: FontSizes.medium,
    fontWeight: '600',
    color: '#fff',
  },
});

export default WorkingHoursModal;

