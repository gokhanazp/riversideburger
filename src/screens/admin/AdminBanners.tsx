import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  TextInput,
  Image,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';
import ConfirmModal from '../../components/ConfirmModal';
import { uploadBannerImage, deleteImage } from '../../services/imageService';

// Banner tipi (Banner type)
interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  image_url: string;
  button_text?: string;
  button_link?: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// Admin Banner Yönetimi Ekranı (Admin Banners Management Screen)
const AdminBanners = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  // State'ler (States)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    image_url: '',
    button_text: '',
    button_link: '',
    order_index: 0,
    is_active: true,
  });

  // Resim yükleme state'leri (Image upload states)
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sayfa başlığını ayarla (Set page title)
  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('admin.screenTitles.bannerManagement'),
    });
  }, [navigation, t, i18n.language]);

  // Sayfa yüklendiğinde banner'ları getir (Fetch banners on page load)
  useEffect(() => {
    fetchBanners();
  }, []);

  // Banner'ları getir (Fetch banners)
  const fetchBanners = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching banners...');

      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) {
        console.error('❌ Fetch error:', error);
        throw error;
      }

      console.log('✅ Banners fetched:', data?.length || 0);
      setBanners(data || []);
    } catch (error: any) {
      console.error('❌ Error fetching banners:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: error.message || t('admin.banners.errorLoading'),
      });
      setBanners([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Yenileme (Refresh)
  const onRefresh = () => {
    setRefreshing(true);
    fetchBanners();
  };

  // Yeni banner ekle modal'ını aç (Open add banner modal)
  const handleAddBanner = () => {
    setSelectedBanner(null);
    setSelectedFile(null);
    setFormData({
      title: '',
      subtitle: '',
      image_url: '',
      button_text: 'Order Now',
      button_link: '/menu',
      order_index: banners.length + 1,
      is_active: true,
    });
    setShowEditModal(true);
  };

  // Banner düzenle modal'ını aç (Open edit banner modal)
  const handleEditBanner = (banner: Banner) => {
    setSelectedBanner(banner);
    setSelectedFile(null);
    setFormData({
      title: banner.title,
      subtitle: banner.subtitle || '',
      image_url: banner.image_url,
      button_text: banner.button_text || '',
      button_link: banner.button_link || '',
      order_index: banner.order_index,
      is_active: banner.is_active,
    });
    setShowEditModal(true);
  };

  // Resim seç (Select image)
  const handleSelectImage = async () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
    } else if (Platform.OS !== 'web') {
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true, // Kullanıcıya kırpma imkanı ver
          aspect: [16, 9], // Banner için geniş format (Wide format for banner)
          quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          handleImageUpload(result.assets[0].uri);
        }
      } catch (error) {
        console.error('Image picker error:', error);
        Toast.show({
          type: 'error',
          text1: t('admin.error'),
          text2: 'Resim seçilirken hata oluştu',
        });
      }
    }
  };

  // Resim yükleme işlemi (Image upload process)
  const handleImageUpload = async (fileOrUri: File | string) => {
    try {
      setUploadingImage(true);
      console.log('📤 Banner resmi yükleniyor...', typeof fileOrUri === 'string' ? 'URI' : fileOrUri.name);

      // Resmi yükle (Upload image)
      const imageUrl = await uploadBannerImage(fileOrUri, selectedBanner?.id);

      // Eski resmi sil (Delete old image if exists)
      if (selectedBanner?.image_url && formData.image_url !== imageUrl) {
        try {
          await deleteImage(selectedBanner.image_url, 'banner-images');
        } catch (error) {
          console.warn('Eski resim silinemedi:', error);
        }
      }

      // Form data'yı güncelle (Update form data)
      setFormData({ ...formData, image_url: imageUrl });
      setSelectedFile(fileOrUri);

      Toast.show({
        type: 'success',
        text1: t('admin.banners.imageUploaded'),
        text2: typeof fileOrUri === 'string' ? 'Resim yüklendi' : fileOrUri.name,
      });
    } catch (error: any) {
      console.error('❌ Resim yükleme hatası:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: error.message || t('admin.banners.errorUploading'),
      });
    } finally {
      setUploadingImage(false);
    }
  };

  // Dosya seçildiğinde (When file is selected)
  const handleFileChange = async (event: any) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  // Banner kaydet (Save banner)
  const handleSaveBanner = async () => {
    try {
      // Validasyon (Validation)
      if (!formData.title || !formData.image_url) {
        Toast.show({
          type: 'error',
          text1: t('admin.error'),
          text2: t('admin.banners.errorRequired'),
        });
        return;
      }

      const bannerData = {
        title: formData.title.trim(),
        subtitle: formData.subtitle.trim() || null,
        image_url: formData.image_url.trim(),
        button_text: formData.button_text.trim() || null,
        button_link: formData.button_link.trim() || null,
        order_index: formData.order_index,
        is_active: formData.is_active,
      };

      console.log('💾 Saving banner:', bannerData);

      if (selectedBanner) {
        // Güncelle (Update)
        const { data, error } = await supabase
          .from('banners')
          .update(bannerData)
          .eq('id', selectedBanner.id)
          .select();

        if (error) {
          console.error('❌ Update error:', error);
          throw error;
        }

        console.log('✅ Banner updated:', data);

        Toast.show({
          type: 'success',
          text1: t('admin.banners.bannerUpdated'),
          text2: formData.title,
        });
      } else {
        // Yeni ekle (Insert)
        const { data, error } = await supabase
          .from('banners')
          .insert(bannerData)
          .select();

        if (error) {
          console.error('❌ Insert error:', error);
          throw error;
        }

        console.log('✅ Banner added:', data);

        Toast.show({
          type: 'success',
          text1: t('admin.banners.bannerAdded'),
          text2: formData.title,
        });
      }

      setShowEditModal(false);
      fetchBanners();
    } catch (error: any) {
      console.error('❌ Error saving banner:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: error.message || t('admin.banners.errorSaving'),
      });
    }
  };

  // Banner sil (Delete banner)
  const handleDeleteBanner = async () => {
    if (!selectedBanner) return;

    try {
      console.log('🗑️ Deleting banner:', selectedBanner.id);

      const { error } = await supabase
        .from('banners')
        .delete()
        .eq('id', selectedBanner.id);

      if (error) throw error;

      console.log('✅ Banner deleted');

      Toast.show({
        type: 'success',
        text1: t('admin.banners.bannerDeleted'),
        text2: selectedBanner.title,
      });

      setShowDeleteModal(false);
      setSelectedBanner(null);
      fetchBanners();
    } catch (error: any) {
      console.error('❌ Error deleting banner:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: error.message || t('admin.banners.errorDeleting'),
      });
    }
  };

  // Aktif/Pasif durumu değiştir (Toggle active status)
  const handleToggleActive = async (banner: Banner) => {
    try {
      const { error } = await supabase
        .from('banners')
        .update({ is_active: !banner.is_active })
        .eq('id', banner.id);

      if (error) throw error;

      Toast.show({
        type: 'success',
        text1: banner.is_active ? t('admin.banners.bannerDeactivated') : t('admin.banners.bannerActivated'),
        text2: banner.title,
      });

      fetchBanners();
    } catch (error: any) {
      console.error('Error toggling banner status:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: t('admin.banners.errorToggling'),
      });
    }
  };

  // Banner kartı (Banner card)
  const BannerCard = ({ banner }: { banner: Banner }) => (
    <View style={styles.bannerCard}>
      <Image source={{ uri: banner.image_url }} style={styles.bannerImage} resizeMode="cover" />

      <View style={styles.bannerOverlay}>
        <View style={styles.bannerHeader}>
          <View style={styles.orderBadge}>
            <Text style={styles.orderText}>#{banner.order_index}</Text>
          </View>
          {banner.is_active ? (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>{t('admin.banners.statusActive')}</Text>
            </View>
          ) : (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>{t('admin.banners.statusInactive')}</Text>
            </View>
          )}
        </View>

        <Text style={styles.bannerTitle}>{banner.title}</Text>
        {banner.subtitle && <Text style={styles.bannerSubtitle}>{banner.subtitle}</Text>}
      </View>

      <View style={styles.bannerActions}>
        <TouchableOpacity
          style={[styles.actionButton, banner.is_active ? styles.deactivateButton : styles.activateButton]}
          onPress={() => handleToggleActive(banner)}
          activeOpacity={0.7}
        >
          <Ionicons name={banner.is_active ? 'eye-off' : 'eye'} size={18} color={Colors.white} />
          <Text style={styles.actionButtonText}>
            {banner.is_active ? t('admin.banners.buttonDeactivate') : t('admin.banners.buttonActivate')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => handleEditBanner(banner)}
          activeOpacity={0.7}
        >
          <Ionicons name="create" size={18} color={Colors.white} />
          <Text style={styles.actionButtonText}>{t('admin.banners.buttonEdit')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => {
            setSelectedBanner(banner);
            setShowDeleteModal(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="trash" size={18} color={Colors.white} />
          <Text style={styles.actionButtonText}>{t('admin.banners.buttonDelete')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('admin.banners.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('admin.banners.headerTitle')}</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddBanner} activeOpacity={0.7}>
          <Ionicons name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Banner listesi (Banners list) */}
      <FlatList
        data={banners}
        renderItem={({ item }) => <BannerCard banner={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>{t('admin.banners.emptyText')}</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleAddBanner}>
              <Text style={styles.emptyButtonText}>{t('admin.banners.emptyButton')}</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Düzenleme/Ekleme Modal (Edit/Add Modal) */}
      {showEditModal && (
        <Modal visible={showEditModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.editModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectedBanner ? t('admin.banners.modalTitleEdit') : t('admin.banners.modalTitleAdd')}
                </Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                {/* Başlık (Title) */}
                <Text style={styles.label}>{t('admin.banners.labelTitle')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.title}
                  onChangeText={(text) => setFormData({ ...formData, title: text })}
                  placeholder="Welcome to Riverside Burgers"
                  placeholderTextColor="#999"
                />

                {/* Alt Başlık (Subtitle) */}
                <Text style={styles.label}>{t('admin.banners.labelSubtitle')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.subtitle}
                  onChangeText={(text) => setFormData({ ...formData, subtitle: text })}
                  placeholder="Toronto's Best Burgers"
                  placeholderTextColor="#999"
                />

                {/* Resim Yükleme (Image Upload) */}
                <Text style={styles.label}>{t('admin.banners.labelImage')}</Text>

                {/* Web için file input (File input for web) */}
                {Platform.OS === 'web' && (
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                )}

                {/* Resim yükleme butonu (Image upload button) */}
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handleSelectImage}
                  disabled={uploadingImage}
                  activeOpacity={0.7}
                >
                  {uploadingImage ? (
                    <>
                      <ActivityIndicator size="small" color={Colors.white} />
                      <Text style={styles.uploadButtonText}>{t('admin.banners.uploading')}</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={24} color={Colors.white} />
                      <Text style={styles.uploadButtonText}>
                        {formData.image_url ? t('admin.banners.changeImage') : t('admin.banners.uploadImage')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Bilgi mesajı (Info message) */}
                <Text style={styles.uploadInfo}>
                  {t('admin.banners.uploadInfo1')}
                </Text>
                <Text style={styles.uploadInfo}>
                  {t('admin.banners.uploadInfo2')}
                </Text>

                {/* Resim Önizleme (Image Preview) */}
                {formData.image_url && (
                  <View style={styles.imagePreviewContainer}>
                    <Image
                      source={{ uri: formData.image_url }}
                      style={styles.imagePreview}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => setFormData({ ...formData, image_url: '' })}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle" size={24} color="#DC3545" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Manuel URL girişi (Manual URL input) - Opsiyonel */}
                <Text style={styles.label}>{t('admin.banners.manualUrl')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.image_url}
                  onChangeText={(text) => setFormData({ ...formData, image_url: text })}
                  placeholder="https://example.com/image.jpg"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                />

                {/* Buton Metni (Button Text) */}
                <Text style={styles.label}>{t('admin.banners.labelButtonText')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.button_text}
                  onChangeText={(text) => setFormData({ ...formData, button_text: text })}
                  placeholder="Order Now"
                  placeholderTextColor="#999"
                />

                {/* Sıra (Order) */}
                <Text style={styles.label}>{t('admin.banners.labelOrder')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.order_index.toString()}
                  onChangeText={(text) => setFormData({ ...formData, order_index: parseInt(text) || 0 })}
                  placeholder="1"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                />

                {/* Aktif/Pasif (Active/Inactive) */}
                <View style={styles.switchContainer}>
                  <Text style={styles.label}>{t('admin.banners.labelActive')}</Text>
                  <Switch
                    value={formData.is_active}
                    onValueChange={(value) => setFormData({ ...formData, is_active: value })}
                    trackColor={{ false: '#ccc', true: Colors.primary + '40' }}
                    thumbColor={formData.is_active ? Colors.primary : '#999'}
                  />
                </View>

                {/* Kaydet Butonu (Save Button) */}
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveBanner} activeOpacity={0.8}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
                  <Text style={styles.saveButtonText}>
                    {selectedBanner ? t('admin.banners.buttonUpdate') : t('admin.banners.buttonAdd')}
                  </Text>
                </TouchableOpacity>

                <View style={{ height: 50 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Silme Onay Modal (Delete Confirmation Modal) */}
      <ConfirmModal
        visible={showDeleteModal}
        title={t('admin.banners.deleteTitle')}
        message={`"${selectedBanner?.title}" ${t('admin.banners.deleteMessage')}`}
        confirmText={t('admin.banners.deleteConfirm')}
        cancelText={t('admin.banners.deleteCancel')}
        onConfirm={handleDeleteBanner}
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedBanner(null);
        }}
        type="danger"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.small,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  bannerCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.medium,
  },
  bannerImage: {
    width: '100%',
    height: 200,
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  orderBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  orderText: {
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
    color: Colors.white,
  },
  activeBadge: {
    backgroundColor: '#28A745',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  activeBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
    color: Colors.white,
  },
  inactiveBadge: {
    backgroundColor: '#6C757D',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  inactiveBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
    color: Colors.white,
  },
  bannerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.white,
  },
  bannerActions: {
    flexDirection: 'row',
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  activateButton: {
    backgroundColor: '#28A745',
  },
  deactivateButton: {
    backgroundColor: '#6C757D',
  },
  editButton: {
    backgroundColor: '#17A2B8',
  },
  deleteButton: {
    backgroundColor: '#DC3545',
  },
  actionButtonText: {
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
    color: Colors.white,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: '#999',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  emptyButtonText: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: Colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  editModal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    padding: Spacing.lg,
  },
  label: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#333',
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: '#333',
    backgroundColor: Colors.white,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.xs,
    ...Shadows.small,
  },
  uploadButtonText: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: Colors.white,
  },
  uploadInfo: {
    fontSize: FontSizes.xs,
    color: '#666',
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  imagePreviewContainer: {
    position: 'relative',
    marginTop: Spacing.sm,
  },
  imagePreview: {
    width: '100%',
    height: 150,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F0F0F0',
  },
  removeImageButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: 12,
    ...Shadows.medium,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    ...Shadows.medium,
  },
  saveButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.white,
  },
});

export default AdminBanners;

