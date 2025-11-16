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
            <View style={styles.headerLeft}>
              <Ionicons name="time-outline" size={28} color={Colors.primary} />
              <View style={styles.headerTextContainer}>
                <Text style={styles.title}>{t('admin.settings.workingHours.title')}</Text>
                <Text style={styles.subtitle}>{t('admin.settings.workingHours.description')}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close-circle" size={32} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contentContainer}
          >
            {/* Auto Close Toggle */}
            <View style={styles.autoCloseSection}>
              <View style={styles.autoCloseBadge}>
                <Ionicons
                  name={autoCloseEnabled ? "checkmark-circle" : "close-circle"}
                  size={20}
                  color={autoCloseEnabled ? Colors.primary : Colors.textSecondary}
                />
                <Text style={[
                  styles.autoCloseBadgeText,
                  autoCloseEnabled && styles.autoCloseBadgeTextActive
                ]}>
                  {autoCloseEnabled
                    ? t('admin.settings.workingHours.autoCloseEnabled')
                    : t('admin.settings.workingHours.autoCloseDisabled')
                  }
                </Text>
              </View>
              <Switch
                value={autoCloseEnabled}
                onValueChange={setAutoCloseEnabled}
                trackColor={{ false: '#E0E0E0', true: Colors.primary + '30' }}
                thumbColor={autoCloseEnabled ? Colors.primary : '#999'}
                ios_backgroundColor="#E0E0E0"
              />
            </View>

            {/* Info Banner */}
            {autoCloseEnabled && (
              <View style={styles.infoBanner}>
                <Ionicons name="information-circle" size={20} color={Colors.primary} />
                <Text style={styles.infoBannerText}>
                  {t('admin.settings.workingHours.autoCloseDesc')}
                </Text>
              </View>
            )}

            {/* Days List */}
            <View style={styles.daysSection}>
              <Text style={styles.daysSectionTitle}>
                📅 {t('admin.settings.workingHours.weekSchedule')}
              </Text>
              {dayOrder.map((day, index) => {
                const schedule = workingHours[day];
                const isWeekend = day === 'saturday' || day === 'sunday';

                return (
                  <View key={day} style={[
                    styles.dayCard,
                    !schedule.enabled && styles.dayCardDisabled,
                    isWeekend && styles.dayCardWeekend
                  ]}>
                    {/* Day Header */}
                    <View style={styles.dayHeader}>
                      <View style={styles.dayHeaderLeft}>
                        <View style={[
                          styles.dayIcon,
                          schedule.enabled ? styles.dayIconActive : styles.dayIconInactive,
                          isWeekend && styles.dayIconWeekend
                        ]}>
                          <Text style={[
                            styles.dayIconText,
                            schedule.enabled && styles.dayIconTextActive
                          ]}>
                            {dayTranslations[day].substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text style={[
                            styles.dayName,
                            !schedule.enabled && styles.dayNameDisabled
                          ]}>
                            {dayTranslations[day]}
                          </Text>
                          {schedule.enabled && (
                            <Text style={styles.dayTime}>
                              {schedule.open} - {schedule.close}
                            </Text>
                          )}
                          {!schedule.enabled && (
                            <Text style={styles.dayClosedText}>
                              {t('admin.settings.workingHours.closed')}
                            </Text>
                          )}
                        </View>
                      </View>
                      <Switch
                        value={schedule.enabled}
                        onValueChange={() => toggleDay(day)}
                        trackColor={{ false: '#E0E0E0', true: Colors.primary + '30' }}
                        thumbColor={schedule.enabled ? Colors.primary : '#999'}
                        ios_backgroundColor="#E0E0E0"
                      />
                    </View>

                    {/* Time Inputs */}
                    {schedule.enabled && (
                      <View style={styles.timeRow}>
                        <View style={styles.timeInputContainer}>
                          <View style={styles.timeInputWrapper}>
                            <Ionicons name="sunny-outline" size={18} color={Colors.primary} />
                            <View style={styles.timeInputContent}>
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
                              />
                            </View>
                          </View>
                        </View>

                        <View style={styles.timeSeparatorContainer}>
                          <Ionicons name="arrow-forward" size={20} color={Colors.textSecondary} />
                        </View>

                        <View style={styles.timeInputContainer}>
                          <View style={styles.timeInputWrapper}>
                            <Ionicons name="moon-outline" size={18} color={Colors.primary} />
                            <View style={styles.timeInputContent}>
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
                              />
                            </View>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close-outline" size={22} color={Colors.text} />
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    ...Shadows.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: Spacing.large,
    paddingBottom: Spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: Spacing.medium,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
    marginTop: -4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.large,
    paddingTop: Spacing.medium,
  },
  autoCloseSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    padding: Spacing.medium,
    paddingHorizontal: Spacing.large,
    borderRadius: 12,
    marginBottom: Spacing.medium,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  autoCloseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  autoCloseBadgeText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  autoCloseBadgeTextActive: {
    color: Colors.primary,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.primary + '10',
    padding: Spacing.medium,
    borderRadius: 10,
    marginBottom: Spacing.large,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  daysSection: {
    gap: Spacing.medium,
  },
  daysSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.small,
  },
  dayCard: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.large,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    ...Shadows.small,
  },
  dayCardDisabled: {
    backgroundColor: '#F8F8F8',
    opacity: 0.7,
  },
  dayCardWeekend: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary + '40',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.medium,
    flex: 1,
  },
  dayIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
  },
  dayIconActive: {
    backgroundColor: Colors.primary + '15',
  },
  dayIconInactive: {
    backgroundColor: '#F5F5F5',
  },
  dayIconWeekend: {
    backgroundColor: Colors.primary + '20',
  },
  dayIconText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
  },
  dayIconTextActive: {
    color: Colors.primary,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  dayNameDisabled: {
    color: Colors.textSecondary,
  },
  dayTime: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },
  dayClosedText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.large,
    gap: Spacing.small,
  },
  timeInputContainer: {
    flex: 1,
  },
  timeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: Spacing.small,
    paddingHorizontal: Spacing.medium,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    gap: 8,
  },
  timeInputContent: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  input: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    padding: 0,
    margin: 0,
  },
  timeSeparatorContainer: {
    paddingTop: 16,
  },
  footer: {
    flexDirection: 'row',
    padding: Spacing.large,
    paddingTop: Spacing.medium,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: Spacing.medium,
    backgroundColor: '#FAFAFA',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: Spacing.medium,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: Spacing.medium,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    ...Shadows.small,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default WorkingHoursModal;

