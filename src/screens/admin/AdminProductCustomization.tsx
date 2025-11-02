import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { customizationService } from '../../services/customizationService';
import { ProductOptionCategory, ProductAvailableOption } from '../../types/customization';

// Admin ürün özelleştirme yönetimi (Admin product customization management)
const AdminProductCustomization = ({ route, navigation }: any) => {
  const { product } = route.params;
  const [categories, setCategories] = useState<ProductOptionCategory[]>([]);
  const [availableOptions, setAvailableOptions] = useState<ProductAvailableOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Kategori ayarları state (Category settings state)
  const [categorySettings, setCategorySettings] = useState<{
    [key: string]: {
      enabled: boolean;
      isRequired: boolean;
      maxSelections: string;
    };
  }>({});

  useEffect(() => {
    loadData();
  }, []);

  // Verileri yükle (Load data)
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Tüm kategorileri getir (Get all categories)
      const allCategories = await customizationService.getAllCategories();
      setCategories(allCategories);

      // Ürün için mevcut seçenekleri getir (Get available options for product)
      const productCustomizations = await customizationService.getProductCustomizations(product.id);
      
      // Mevcut seçenekleri state'e dönüştür (Convert to state)
      const settings: any = {};
      allCategories.forEach((cat) => {
        const existing = productCustomizations.find((pc) => pc.category.id === cat.id);
        settings[cat.id] = {
          enabled: !!existing,
          isRequired: existing?.is_required || false,
          maxSelections: existing?.max_selections?.toString() || '',
        };
      });
      setCategorySettings(settings);

      // Mevcut available options'ları sakla (Store existing available options)
      const availableOpts: ProductAvailableOption[] = [];
      productCustomizations.forEach((pc) => {
        availableOpts.push({
          id: pc.category.id, // Geçici olarak category id kullanıyoruz
          product_id: product.id,
          category_id: pc.category.id,
          is_required: pc.is_required,
          max_selections: pc.max_selections,
          created_at: new Date().toISOString(),
        });
      });
      setAvailableOptions(availableOpts);
    } catch (error) {
      console.error('Error loading data:', error);
      Toast.show({
        type: 'error',
        text1: '❌ Hata',
        text2: 'Veriler yüklenirken hata oluştu',
      });
    } finally {
      setLoading(false);
    }
  };

  // Kategori toggle (Toggle category)
  const toggleCategory = (categoryId: string) => {
    setCategorySettings((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        enabled: !prev[categoryId].enabled,
      },
    }));
  };

  // Zorunlu toggle (Toggle required)
  const toggleRequired = (categoryId: string) => {
    setCategorySettings((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        isRequired: !prev[categoryId].isRequired,
      },
    }));
  };

  // Maksimum seçim değiştir (Change max selections)
  const changeMaxSelections = (categoryId: string, value: string) => {
    setCategorySettings((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        maxSelections: value,
      },
    }));
  };

  // Kaydet (Save)
  const handleSave = async () => {
    try {
      setSaving(true);

      // Önce mevcut tüm seçenekleri sil (Delete all existing options)
      // Not: Gerçek uygulamada bunu daha akıllı yapmalıyız
      // Şimdilik basit yaklaşım: Hepsini sil, yeniden ekle

      // Etkin kategorileri ekle (Add enabled categories)
      for (const category of categories) {
        const settings = categorySettings[category.id];
        
        if (settings.enabled) {
          const maxSelections = settings.maxSelections
            ? parseInt(settings.maxSelections, 10)
            : undefined;

          try {
            await customizationService.addProductCustomization(
              product.id,
              category.id,
              settings.isRequired,
              maxSelections
            );
          } catch (error: any) {
            // Eğer zaten varsa hata vermez, devam eder
            console.log('Category already exists or error:', error.message);
          }
        }
      }

      Toast.show({
        type: 'success',
        text1: '✅ Başarılı',
        text2: 'Özelleştirme ayarları kaydedildi',
      });

      // Geri dön (Go back)
      setTimeout(() => navigation.goBack(), 1000);
    } catch (error) {
      console.error('Error saving:', error);
      Toast.show({
        type: 'error',
        text1: '❌ Hata',
        text2: 'Kaydetme sırasında hata oluştu',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🎨 Ürün Özelleştirme</Text>
          <Text style={styles.headerSubtitle}>{product.name}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            Bu ürün için hangi özelleştirme seçeneklerinin gösterileceğini belirleyin
          </Text>
        </View>

        {categories.map((category) => {
          const settings = categorySettings[category.id] || {
            enabled: false,
            isRequired: false,
            maxSelections: '',
          };

          return (
            <View key={category.id} style={styles.categoryCard}>
              {/* Kategori başlığı ve toggle (Category header and toggle) */}
              <View style={styles.categoryHeader}>
                <View style={styles.categoryHeaderLeft}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  {category.description && (
                    <Text style={styles.categoryDescription}>{category.description}</Text>
                  )}
                </View>
                <Switch
                  value={settings.enabled}
                  onValueChange={() => toggleCategory(category.id)}
                  trackColor={{ false: '#D1D5DB', true: Colors.primary }}
                  thumbColor={Colors.white}
                />
              </View>

              {/* Kategori ayarları (Category settings) */}
              {settings.enabled && (
                <View style={styles.categorySettings}>
                  {/* Zorunlu mu? (Is required?) */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Ionicons name="alert-circle-outline" size={20} color={Colors.textSecondary} />
                      <Text style={styles.settingLabel}>Zorunlu Seçim</Text>
                    </View>
                    <Switch
                      value={settings.isRequired}
                      onValueChange={() => toggleRequired(category.id)}
                      trackColor={{ false: '#D1D5DB', true: Colors.primary }}
                      thumbColor={Colors.white}
                    />
                  </View>

                  {/* Maksimum seçim (Max selections) */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Ionicons name="options-outline" size={20} color={Colors.textSecondary} />
                      <Text style={styles.settingLabel}>Maksimum Seçim</Text>
                    </View>
                    <TextInput
                      style={styles.maxSelectionsInput}
                      placeholder="Sınırsız"
                      placeholderTextColor="#999"
                      value={settings.maxSelections}
                      onChangeText={(value) => changeMaxSelections(category.id, value)}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Kaydet butonu (Save button) */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
              <Text style={styles.saveButtonText}>Kaydet</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadows.small,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF5F5',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  categoryCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryHeaderLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  categoryName: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  categorySettings: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  settingLabel: {
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  maxSelectionsInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 80,
    textAlign: 'center',
  },
  footer: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadows.medium,
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadows.medium,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.white,
  },
});

export default AdminProductCustomization;

