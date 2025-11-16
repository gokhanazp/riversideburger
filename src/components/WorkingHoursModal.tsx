// Working Hours Modal Component
// Çalışma saatleri modal bileşeni

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
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

  // Modal açıldığında state'i güncelle (Update state when modal opens)
  useEffect(() => {
    if (visible) {
      setWorkingHours(initialWorkingHours);
      setAutoCloseEnabled(initialAutoCloseEnabled);
    }
  }, [visible, initialWorkingHours, initialAutoCloseEnabled]);

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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{t('admin.settings.workingHours.title')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Auto Close Toggle */}
              <View style={styles.autoCloseSection}>
                <View style={styles.autoCloseLeft}>
                  <Ionicons name="time-outline" size={20} color={Colors.primary} />
                  <Text style={styles.autoCloseText}>
                    {t('admin.settings.workingHours.autoClose')}
                  </Text>
                </View>
                <Switch
                  value={autoCloseEnabled}
                  onValueChange={setAutoCloseEnabled}
                  trackColor={{ false: '#ccc', true: Colors.primary + '40' }}
                  thumbColor={autoCloseEnabled ? Colors.primary : '#999'}
                />
              </View>

              {/* Days List */}
              {dayOrder.map((day) => {
                const schedule = workingHours[day];

                return (
                  <View key={day} style={styles.dayCard}>
                    {/* Day Header */}
                    <View style={styles.dayHeader}>
                      <View style={styles.dayHeaderLeft}>
                        <View style={[
                          styles.dayDot,
                          schedule.enabled && styles.dayDotActive
                        ]} />
                        <Text style={[
                          styles.dayName,
                          !schedule.enabled && styles.dayNameDisabled
                        ]}>
                          {dayTranslations[day]}
                        </Text>
                      </View>
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
                        <View style={styles.timeInputWrapper}>
                          <Text style={styles.timeLabel}>
                            {t('admin.settings.workingHours.open')}
                          </Text>
                          <TextInput
                            style={styles.input}
                            value={schedule.open}
                            onChangeText={(value) => updateTime(day, 'open', value)}
                            placeholder="09:00"
                            placeholderTextColor="#999"
                            keyboardType="numbers-and-punctuation"
                            maxLength={5}
                            returnKeyType="done"
                          />
                        </View>

                        <View style={styles.timeSeparatorWrapper}>
                          <Text style={styles.timeSeparator}>→</Text>
                        </View>

                        <View style={styles.timeInputWrapper}>
                          <Text style={styles.timeLabel}>
                            {t('admin.settings.workingHours.close')}
                          </Text>
                          <TextInput
                            style={styles.input}
                            value={schedule.close}
                            onChangeText={(value) => updateTime(day, 'close', value)}
                            placeholder="22:00"
                            placeholderTextColor="#999"
                            keyboardType="numbers-and-punctuation"
                            maxLength={5}
                            returnKeyType="done"
                          />
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}

              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Footer Buttons */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.large,
    borderTopRightRadius: BorderRadius.large,
    maxHeight: '85%',
    ...Shadows.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.large,
    paddingVertical: Spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: FontSizes.xlarge,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    padding: Spacing.small,
  },
  content: {
    paddingHorizontal: Spacing.large,
    paddingTop: Spacing.medium,
  },
  autoCloseSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    paddingVertical: Spacing.medium,
    paddingHorizontal: Spacing.large,
    borderRadius: BorderRadius.medium,
    marginBottom: Spacing.medium,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  autoCloseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.small,
    flex: 1,
  },
  autoCloseText: {
    fontSize: FontSizes.medium,
    fontWeight: '600',
    color: Colors.text,
  },
  dayCard: {
    backgroundColor: Colors.card,
    paddingVertical: Spacing.medium,
    paddingHorizontal: Spacing.large,
    borderRadius: BorderRadius.medium,
    marginBottom: Spacing.medium,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.small,
    flex: 1,
  },
  dayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ccc',
  },
  dayDotActive: {
    backgroundColor: Colors.primary,
  },
  dayName: {
    fontSize: FontSizes.large,
    fontWeight: '600',
    color: Colors.text,
  },
  dayNameDisabled: {
    color: Colors.textSecondary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: Spacing.medium,
    gap: Spacing.small,
  },
  timeInputWrapper: {
    flex: 1,
  },
  timeLabel: {
    fontSize: FontSizes.small,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.small,
    paddingVertical: Spacing.medium,
    paddingHorizontal: Spacing.medium,
    fontSize: FontSizes.large,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  timeSeparatorWrapper: {
    paddingBottom: Spacing.medium,
  },
  timeSeparator: {
    fontSize: 20,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.large,
    paddingVertical: Spacing.medium,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.medium,
    backgroundColor: Colors.background,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.medium,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: FontSizes.medium,
    fontWeight: '600',
    color: Colors.text,
  },
  saveButton: {
    flex: 1,
    paddingVertical: Spacing.medium,
    borderRadius: BorderRadius.medium,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.small,
  },
  saveButtonText: {
    fontSize: FontSizes.medium,
    fontWeight: '700',
    color: '#fff',
  },
});

export default WorkingHoursModal;

