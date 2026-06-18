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
  StatusBar,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows } from '../../constants/theme';
import Toast from 'react-native-toast-message';
import ConfirmModal from '../../components/ConfirmModal';
import { uploadPartnerLogo } from '../../services/imageService';
import {
  DeliveryPartner,
  getAllDeliveryPartners,
  createDeliveryPartner,
  updateDeliveryPartner,
  deleteDeliveryPartner,
  isDeliveryPartnersSectionEnabled,
  setDeliveryPartnersSectionEnabled,
} from '../../services/deliveryPartnerService';

const AdminDeliveryPartners = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  const isTr = i18n.language === 'tr';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [sectionEnabled, setSectionEnabled] = useState(true);
  const [togglingSection, setTogglingSection] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<DeliveryPartner | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    link_url: '',
    display_order: 0,
    is_active: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [list, enabled] = await Promise.all([
        getAllDeliveryPartners(),
        isDeliveryPartnersSectionEnabled(),
      ]);
      setPartners(list);
      setSectionEnabled(enabled);
    } catch (error) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.deliveryPartners.errorLoading') });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleToggleSection = async (value: boolean) => {
    setSectionEnabled(value);
    setTogglingSection(true);
    try {
      await setDeliveryPartnersSectionEnabled(value);
      Toast.show({
        type: 'success',
        text1: value ? t('admin.deliveryPartners.sectionEnabled') : t('admin.deliveryPartners.sectionDisabled'),
      });
    } catch (error) {
      setSectionEnabled(!value); // geri al (revert)
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.deliveryPartners.errorSaving') });
    } finally {
      setTogglingSection(false);
    }
  };

  const handleAdd = () => {
    setSelectedPartner(null);
    setFormData({
      name: '',
      logo_url: '',
      link_url: '',
      display_order: (partners.length > 0 ? Math.max(...partners.map(p => p.display_order)) : 0) + 1,
      is_active: true,
    });
    setShowEditModal(true);
  };

  const handleEdit = (partner: DeliveryPartner) => {
    setSelectedPartner(partner);
    setFormData({
      name: partner.name,
      logo_url: partner.logo_url,
      link_url: partner.link_url || '',
      display_order: partner.display_order,
      is_active: partner.is_active,
    });
    setShowEditModal(true);
  };

  const handleSelectImage = async () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        handleImageUpload(result.assets[0].uri);
      }
    }
  };

  const handleImageUpload = async (fileOrUri: File | string) => {
    try {
      setUploadingImage(true);
      const url = await uploadPartnerLogo(fileOrUri, selectedPartner?.id);
      setFormData(prev => ({ ...prev, logo_url: url }));
      Toast.show({ type: 'success', text1: t('admin.deliveryPartners.imageUploaded') });
    } catch (error) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.deliveryPartners.errorUploading') });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.logo_url.trim()) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.deliveryPartners.errorRequired') });
      return;
    }
    try {
      const payload = {
        name: formData.name.trim(),
        logo_url: formData.logo_url.trim(),
        link_url: formData.link_url.trim() || null,
        display_order: formData.display_order,
        is_active: formData.is_active,
      };
      if (selectedPartner) {
        await updateDeliveryPartner(selectedPartner.id, payload);
        Toast.show({ type: 'success', text1: t('admin.deliveryPartners.partnerUpdated') });
      } else {
        await createDeliveryPartner(payload);
        Toast.show({ type: 'success', text1: t('admin.deliveryPartners.partnerAdded') });
      }
      setShowEditModal(false);
      fetchData();
    } catch (error) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.deliveryPartners.errorSaving') });
    }
  };

  const handleDelete = async () => {
    if (!selectedPartner) return;
    try {
      await deleteDeliveryPartner(selectedPartner.id);
      Toast.show({ type: 'success', text1: t('admin.deliveryPartners.partnerDeleted') });
      setShowDeleteModal(false);
      fetchData();
    } catch (error) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.deliveryPartners.errorSaving') });
    }
  };

  const PartnerCard = ({ partner, index }: { partner: DeliveryPartner; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()} style={styles.card}>
      <View style={styles.logoBox}>
        <Image source={{ uri: partner.logo_url }} style={styles.logoImage} resizeMode="contain" />
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardTopRow}>
          <Text style={styles.partnerName} numberOfLines={1}>{partner.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: partner.is_active ? Colors.success : Colors.textMuted }]}>
            <Text style={styles.statusText}>
              {partner.is_active ? t('admin.deliveryPartners.statusActive') : t('admin.deliveryPartners.statusInactive')}
            </Text>
          </View>
        </View>
        <Text style={styles.orderText}>#{partner.display_order}</Text>
        <View style={styles.cardActions}>
          <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => handleEdit(partner)}>
            <Ionicons name="create-outline" size={18} color={Colors.white} />
            <Text style={styles.actionBtnText}>{t('admin.deliveryPartners.buttonEdit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => { setSelectedPartner(partner); setShowDeleteModal(true); }}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.white} />
            <Text style={styles.actionBtnText}>{t('admin.deliveryPartners.buttonDelete')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a1a1a', '#333']} style={styles.headerArea}>
        <View style={styles.breadcrumb}>
          <Text style={styles.breadText}>Admin</Text>
          <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
          <Text style={styles.breadText}>Panel</Text>
          <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
          <Text style={[styles.breadText, styles.breadActive]}>{t('admin.deliveryPartners.headerTitle')}</Text>
        </View>

        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>{t('admin.deliveryPartners.headerTitle')}</Text>
          <TouchableOpacity style={styles.roundBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerStats}>
          <View>
            <Text style={styles.statCount}>{partners.length}</Text>
            <Text style={styles.statLabel}>{t('admin.deliveryPartners.totalPartners')}</Text>
          </View>
          <TouchableOpacity style={styles.addBtnWrap} onPress={handleAdd}>
            <LinearGradient colors={[Colors.primary, Colors.primary + 'AA']} style={styles.addGradient}>
              <Ionicons name="add-circle" size={22} color={Colors.white} />
              <Text style={styles.addBtnText}>{t('admin.deliveryPartners.buttonAdd')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Bölümü komple aç/kapa (master section toggle) */}
      <View style={styles.masterToggleCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.masterToggleTitle}>{t('admin.deliveryPartners.sectionToggleTitle')}</Text>
          <Text style={styles.masterToggleDesc}>{t('admin.deliveryPartners.sectionToggleDesc')}</Text>
        </View>
        {togglingSection ? (
          <ActivityIndicator color={Colors.primary} style={{ marginLeft: 12 }} />
        ) : (
          <Switch
            value={sectionEnabled}
            onValueChange={handleToggleSection}
            trackColor={{ false: '#eee', true: Colors.success + '40' }}
            thumbColor={sectionEnabled ? Colors.success : '#999'}
          />
        )}
      </View>

      {loading && !refreshing ? (
        <View style={styles.loader}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={partners}
          renderItem={({ item, index }) => <PartnerCard partner={item} index={index} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <Ionicons name="bicycle-outline" size={64} color="#ddd" />
              <Text style={styles.emptyMsg}>{t('admin.deliveryPartners.emptyText')}</Text>
            </View>
          }
        />
      )}

      {/* Ekle / Düzenle modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalBack}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {selectedPartner ? t('admin.deliveryPartners.modalTitleEdit') : t('admin.deliveryPartners.modalTitleAdd')}
              </Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)} style={styles.sheetClose}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('admin.deliveryPartners.labelName')}</Text>
                <TextInput
                  style={styles.sheetInput}
                  value={formData.name}
                  onChangeText={v => setFormData({ ...formData, name: v })}
                  placeholder={isTr ? 'Örn. DoorDash' : 'e.g. DoorDash'}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('admin.deliveryPartners.labelLogo')}</Text>
                <TouchableOpacity style={styles.mediaUpload} onPress={handleSelectImage}>
                  {uploadingImage ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : formData.logo_url ? (
                    <View style={styles.previewContainer}>
                      <Image source={{ uri: formData.logo_url }} style={styles.uploadPreview} resizeMode="contain" />
                      <View style={styles.preOverlay}>
                        <View style={styles.changeBadge}>
                          <Ionicons name="camera" size={16} color={Colors.white} />
                          <Text style={styles.changeBadgeText}>{t('admin.deliveryPartners.changeImage')}</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.uploadPlaceholder}>
                      <Ionicons name="image-outline" size={40} color={Colors.primary} />
                      <Text style={styles.mediaText}>{t('admin.deliveryPartners.uploadImage')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {Platform.OS === 'web' && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => { const file = e.target.files?.[0]; if (file) handleImageUpload(file); }}
                />
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('admin.deliveryPartners.labelLogoUrl')}</Text>
                <TextInput
                  style={styles.sheetInput}
                  value={formData.logo_url}
                  onChangeText={v => setFormData({ ...formData, logo_url: v })}
                  placeholder="https://..."
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('admin.deliveryPartners.labelLink')}</Text>
                <TextInput
                  style={styles.sheetInput}
                  value={formData.link_url}
                  onChangeText={v => setFormData({ ...formData, link_url: v })}
                  placeholder={isTr ? 'https://... (opsiyonel)' : 'https://... (optional)'}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('admin.deliveryPartners.labelOrder')}</Text>
                <TextInput
                  style={styles.sheetInput}
                  value={formData.display_order.toString()}
                  onChangeText={v => setFormData({ ...formData, display_order: parseInt(v) || 0 })}
                  placeholder="1"
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.rowItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t('admin.deliveryPartners.labelActive')}</Text>
                  <Text style={styles.helperText}>{t('admin.deliveryPartners.activeHelper')}</Text>
                </View>
                <Switch
                  value={formData.is_active}
                  onValueChange={v => setFormData({ ...formData, is_active: v })}
                  trackColor={{ false: '#eee', true: Colors.success + '40' }}
                  thumbColor={formData.is_active ? Colors.success : '#999'}
                />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={uploadingImage}>
                <Text style={styles.saveBtnText}>
                  {selectedPartner ? t('admin.deliveryPartners.buttonUpdate') : t('admin.deliveryPartners.buttonAdd')}
                </Text>
              </TouchableOpacity>
              <View style={{ height: 60 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={showDeleteModal}
        title={t('admin.deliveryPartners.deleteTitle')}
        message={`"${selectedPartner?.name}" ${t('admin.deliveryPartners.deleteMessage')}`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        type="danger"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  headerArea: { paddingTop: 60, paddingBottom: 30, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, ...Shadows.medium },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15, opacity: 0.8 },
  breadText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 },
  breadActive: { color: Colors.white, opacity: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: 22, fontWeight: '900', color: Colors.white },
  headerStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 30 },
  statCount: { fontSize: 28, fontWeight: '900', color: Colors.white },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '700', textTransform: 'uppercase' },
  addBtnWrap: { borderRadius: 20, overflow: 'hidden' },
  addGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 50, gap: 10 },
  addBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  masterToggleCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    marginHorizontal: 20, marginTop: 16, padding: 20, borderRadius: 24, ...Shadows.medium,
  },
  masterToggleTitle: { fontSize: 15, fontWeight: '800', color: Colors.text },
  masterToggleDesc: { fontSize: 12, color: '#888', marginTop: 4, lineHeight: 17 },
  listContainer: { padding: 20, gap: 16, paddingBottom: 100 },
  card: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: 24, overflow: 'hidden', ...Shadows.medium, padding: 14, gap: 14 },
  logoBox: { width: 90, height: 90, borderRadius: 18, backgroundColor: '#F4F5F7', justifyContent: 'center', alignItems: 'center' },
  logoImage: { width: 70, height: 70 },
  cardInfo: { flex: 1, justifyContent: 'center' },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  partnerName: { fontSize: 17, fontWeight: '800', color: Colors.text, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { color: Colors.white, fontWeight: '800', fontSize: 10, textTransform: 'uppercase' },
  orderText: { fontSize: 12, color: '#999', fontWeight: '700', marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 6 },
  editBtn: { backgroundColor: '#17A2B8' },
  deleteBtn: { backgroundColor: Colors.primary },
  actionBtnText: { color: Colors.white, fontWeight: '800', fontSize: 12 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyView: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100, gap: 16 },
  emptyMsg: { color: '#ccc', fontWeight: '700' },
  modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 36, borderTopRightRadius: 36, maxHeight: '92%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#f1f1f1' },
  sheetTitle: { fontSize: 22, fontWeight: '900', color: Colors.text },
  sheetClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  sheetBody: { padding: 24 },
  inputGroup: { marginBottom: 24 },
  inputLabel: { fontSize: 13, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 },
  sheetInput: { backgroundColor: '#F8F9FA', borderRadius: 20, padding: 18, fontSize: 16, color: '#333', borderWidth: 1, borderColor: '#eee' },
  mediaUpload: { borderRadius: 28, overflow: 'hidden', backgroundColor: '#F8F9FA' },
  uploadPlaceholder: { height: 160, borderStyle: 'dashed', borderWidth: 2, borderColor: '#ddd', borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  previewContainer: { height: 160, position: 'relative', backgroundColor: '#F4F5F7' },
  uploadPreview: { width: '100%', height: '100%' },
  preOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
  changeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 8 },
  changeBadgeText: { color: Colors.white, fontWeight: '700', fontSize: 12 },
  mediaText: { marginTop: 12, fontSize: 14, color: Colors.primary, fontWeight: '700' },
  rowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 35, backgroundColor: '#f8f9fa', padding: 20, borderRadius: 24 },
  helperText: { fontSize: 12, color: '#888', marginTop: 4 },
  saveBtn: { height: 64, backgroundColor: Colors.primary, borderRadius: 24, justifyContent: 'center', alignItems: 'center', ...Shadows.medium },
  saveBtnText: { color: Colors.white, fontSize: 17, fontWeight: '900' },
});

export default AdminDeliveryPartners;
