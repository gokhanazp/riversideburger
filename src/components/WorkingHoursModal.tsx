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
                      <View style={styles.timeContainer}>
                        <View style={styles.timeInputGroup}>
                          <Text style={styles.timeLabel}>
                            {t('admin.settings.workingHours.open')}
                          </Text>
                          <TextInput
                            style={styles.timeInput}
                            value={schedule.open}
                            onChangeText={(value) => updateTime(day, 'open', value)}
                            placeholder="09:00"
                            placeholderTextColor="#999"
                            keyboardType="numbers-and-punctuation"
                            maxLength={5}
                            returnKeyType="done"
                          />
                        </View>

                        <View style={styles.arrowContainer}>
                          <Ionicons name="arrow-forward" size={20} color={Colors.textSecondary} />
                        </View>

                        <View style={styles.timeInputGroup}>
                          <Text style={styles.timeLabel}>
                            {t('admin.settings.workingHours.close')}
                          </Text>
                          <TextInput
                            style={styles.timeInput}
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

              <View style={{ height: 24 }} />
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    ...Shadows.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  closeButton: {
    padding: 8,
    marginLeft: 12,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  autoCloseSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.medium,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  autoCloseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  autoCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  dayCard: {
    backgroundColor: Colors.card,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.medium,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dayDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ddd',
  },
  dayDotActive: {
    backgroundColor: Colors.primary,
  },
  dayName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  dayNameDisabled: {
    color: Colors.textSecondary,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 16,
    paddingHorizontal: 8,
  },
  timeInputGroup: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeInput: {
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: BorderRadius.medium,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    minHeight: 56,
  },
  arrowContainer: {
    paddingTop: 24,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 16,
    backgroundColor: Colors.background,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: BorderRadius.medium,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    minHeight: 52,
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: BorderRadius.medium,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.small,
    minHeight: 52,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});

export default WorkingHoursModal;

