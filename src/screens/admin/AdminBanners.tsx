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
  Dimensions,
  StatusBar,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';
import ConfirmModal from '../../components/ConfirmModal';
import { uploadBannerImage, deleteImage } from '../../services/imageService';

const { width } = Dimensions.get('window');

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

const AdminBanners = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
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
    button_text: 'Order Now',
    button_link: '/menu',
    order_index: 0,
    is_active: true,
  });

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [linkType, setLinkType] = useState<'none' | 'product' | 'category' | 'url'>('none');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    fetchBanners();
    fetchSelectionData();
  }, []);

  const fetchSelectionData = async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        supabase.from('products').select('id, name').eq('is_active', true).order('name'),
        supabase.from('menu_categories').select('id, name_en, name_tr').eq('is_active', true).order('display_order')
      ]);
      if (productsRes.data) setProducts(productsRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Error fetching selection data:', error);
    }
  };

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('banners').select('*').order('order_index', { ascending: true });
      if (error) throw error;
      setBanners(data || []);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.banners.errorLoading') });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBanners();
  };

  const handleAddBanner = () => {
    setSelectedBanner(null);
    setFormData({
      title: '', subtitle: '', image_url: '', button_text: 'Order Now', button_link: '/menu',
      order_index: (banners.length > 0 ? Math.max(...banners.map(b => b.order_index)) : 0) + 1,
      is_active: true,
    });
    setLinkType('none');
    setShowEditModal(true);
  };

  const handleEditBanner = (banner: Banner) => {
    setSelectedBanner(banner);
    setFormData({
      title: banner.title, subtitle: banner.subtitle || '', image_url: banner.image_url,
      button_text: banner.button_text || '', button_link: banner.button_link || '',
      order_index: banner.order_index, is_active: banner.is_active,
    });
    if (banner.button_link?.startsWith('product:')) {
      setLinkType('product');
      setSelectedProductId(banner.button_link.split(':')[1]);
    } else if (banner.button_link?.startsWith('category:')) {
      setLinkType('category');
      setSelectedCategoryId(banner.button_link.split(':')[1]);
    } else if (banner.button_link) {
      setLinkType('url');
    } else {
      setLinkType('none');
    }
    setShowEditModal(true);
  };

  const handleSelectImage = async () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [16, 9], quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        handleImageUpload(result.assets[0].uri);
      }
    }
  };

  const handleImageUpload = async (fileOrUri: File | string) => {
    try {
      setUploadingImage(true);
      const imageUrl = await uploadBannerImage(fileOrUri, selectedBanner?.id);
      setFormData({ ...formData, image_url: imageUrl });
      Toast.show({ type: 'success', text1: t('admin.banners.imageUploaded') });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.banners.errorUploading') });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveBanner = async () => {
    if (!formData.title || !formData.image_url) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.banners.errorRequired') });
      return;
    }
    try {
      const bannerData = {
        title: formData.title.trim(), subtitle: formData.subtitle.trim() || null,
        image_url: formData.image_url.trim(), button_text: formData.button_text.trim() || null,
        button_link: formData.button_link.trim() || null, order_index: formData.order_index,
        is_active: formData.is_active,
      };
      if (selectedBanner) {
        await supabase.from('banners').update(bannerData).eq('id', selectedBanner.id);
        Toast.show({ type: 'success', text1: t('admin.banners.bannerUpdated') });
      } else {
        await supabase.from('banners').insert(bannerData);
        Toast.show({ type: 'success', text1: t('admin.banners.bannerAdded') });
      }
      setShowEditModal(false);
      fetchBanners();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.banners.errorSaving') });
    }
  };

  const handleDeleteBanner = async () => {
    if (!selectedBanner) return;
    try {
      await supabase.from('banners').delete().eq('id', selectedBanner.id);
      Toast.show({ type: 'success', text1: t('admin.banners.bannerDeleted') });
      setShowDeleteModal(false);
      fetchBanners();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.banners.errorDeleting') });
    }
  };

  const BannerCard = ({ banner, index }: { banner: Banner, index: number }) => (
    <Animated.View 
        entering={FadeInDown.delay(index * 100).springify()}
        style={styles.bannerCard}
    >
      <View style={styles.imageBox}>
          <Image source={{ uri: banner.image_url }} style={styles.bannerImage} />
          <View style={styles.imageOverlay}>
              <View style={styles.tagRow}>
                  <View style={styles.orderBadge}><Text style={styles.orderText}>#{banner.order_index}</Text></View>
                  <View style={[styles.statusBadge, { backgroundColor: banner.is_active ? Colors.success : Colors.textMuted }]}>
                      <Text style={styles.statusText}>{banner.is_active ? t('admin.banners.statusActive') : t('admin.banners.statusInactive')}</Text>
                  </View>
              </View>
              <View style={styles.bannerTextContainer}>
                  <Text style={styles.bannerTitleText} numberOfLines={1}>{banner.title}</Text>
                  {banner.subtitle && <Text style={styles.bannerSubtitleText} numberOfLines={1}>{banner.subtitle}</Text>}
              </View>
          </View>
      </View>
      <View style={styles.cardActionsFull}>
          <TouchableOpacity 
            style={[styles.actionBtnFull, styles.editBtnMain]}
            onPress={() => handleEditBanner(banner)}
          >
              <Ionicons name="create-outline" size={18} color={Colors.white} />
              <Text style={styles.actionBtnText}>{t('admin.banners.buttonEdit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtnFull, styles.deleteBtnMain]}
            onPress={() => { setSelectedBanner(banner); setShowDeleteModal(true); }}
          >
              <Ionicons name="trash-outline" size={18} color={Colors.white} />
              <Text style={styles.actionBtnText}>{t('admin.banners.buttonDelete')}</Text>
          </TouchableOpacity>
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
              <Text style={[styles.breadText, styles.breadActive]}>{t('admin.banners.headerTitle')}</Text>
          </View>
          
          <View style={styles.headerTop}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
                  <Ionicons name="arrow-back" size={20} color={Colors.white} />
              </TouchableOpacity>
              <Text style={styles.pageTitle}>{t('admin.banners.headerTitle')}</Text>
              <TouchableOpacity style={styles.roundBtn} onPress={onRefresh}>
                  <Ionicons name="refresh" size={18} color={Colors.white} />
              </TouchableOpacity>
          </View>
          <View style={styles.headerStats}>
              <View>
                  <Text style={styles.statCount}>{banners.length}</Text>
                  <Text style={styles.statLabel}>{t('admin.banners.totalBanners')}</Text>
              </View>
              <TouchableOpacity style={styles.addBannerBtn} onPress={handleAddBanner}>
                  <LinearGradient colors={[Colors.primary, Colors.primary + 'AA']} style={styles.addGradient}>
                      <Ionicons name="add-circle" size={22} color={Colors.white} />
                      <Text style={styles.addBtnText}>{t('admin.banners.buttonAdd')}</Text>
                  </LinearGradient>
              </TouchableOpacity>
          </View>
      </LinearGradient>

      {loading && !refreshing ? (
          <View style={styles.loader}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
          <FlatList
            data={banners}
            renderItem={({ item, index }) => <BannerCard banner={item} index={index} />}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyView}>
                <Ionicons name="images-outline" size={64} color="#ddd" />
                <Text style={styles.emptyMsg}>{t('admin.banners.emptyText')}</Text>
              </View>
            }
          />
      )}

      {/* Slide Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
          <View style={styles.modalBack}>
              <View style={styles.modalSheet}>
                  <View style={styles.sheetHeader}>
                      <Text style={styles.sheetTitle}>{selectedBanner ? t('admin.banners.modalTitleEdit') : t('admin.banners.modalTitleAdd')}</Text>
                      <TouchableOpacity onPress={() => setShowEditModal(false)} style={styles.sheetClose}>
                          <Ionicons name="close" size={24} color="#333" />
                      </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
                      <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>{t('admin.banners.labelTitle')}</Text>
                          <TextInput 
                            style={styles.sheetInput}
                            value={formData.title}
                            onChangeText={v => setFormData({...formData, title: v})}
                            placeholder={i18n.language === 'tr' ? 'Kampanya Başlığı' : 'Campaign Title'}
                          />
                      </View>
                      
                      <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>{t('admin.banners.labelImage')}</Text>
                          <TouchableOpacity style={styles.mediaUpload} onPress={handleSelectImage}>
                              {uploadingImage ? (
                                  <ActivityIndicator color={Colors.primary} />
                              ) : formData.image_url ? (
                                  <View style={styles.previewContainer}>
                                      <Image source={{uri: formData.image_url}} style={styles.uploadPreview} />
                                      <View style={styles.preOverlay}>
                                          <View style={styles.changeBadge}>
                                              <Ionicons name="camera" size={16} color={Colors.white} />
                                              <Text style={styles.changeBadgeText}>{t('admin.banners.changeImage')}</Text>
                                          </View>
                                      </View>
                                  </View>
                              ) : (
                                  <View style={styles.uploadPlaceholder}>
                                      <Ionicons name="image-outline" size={40} color={Colors.primary} />
                                      <Text style={styles.mediaText}>{t('admin.banners.uploadImage')}</Text>
                                  </View>
                              )}
                          </TouchableOpacity>
                      </View>

                      {Platform.OS === 'web' && <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={e => {
                          const file = e.target.files?.[0]; if(file) handleImageUpload(file);
                      }} />}

                      <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>{t('admin.banners.labelSubtitle')}</Text>
                          <TextInput 
                            style={styles.sheetInput}
                            value={formData.subtitle}
                            onChangeText={v => setFormData({...formData, subtitle: v})}
                            placeholder={i18n.language === 'tr' ? 'Açıklama' : 'Description'}
                          />
                      </View>

                      <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>{t('admin.banners.labelButtonText')}</Text>
                          <TextInput 
                            style={styles.sheetInput}
                            value={formData.button_text}
                            onChangeText={v => setFormData({...formData, button_text: v})}
                            placeholder={i18n.language === 'tr' ? 'Buton Yazısı' : 'Button Text'}
                          />
                      </View>

                      {/* Banner Link Section - RESTORED */}
                      <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>{t('admin.banners.labelLinkType')}</Text>
                          <View style={styles.linkTypes}>
                              {[
                                { id: 'none', label: t('admin.banners.linkTypeNone') },
                                { id: 'product', label: t('admin.banners.linkTypeProduct') },
                                { id: 'category', label: t('admin.banners.linkTypeCategory') },
                                { id: 'url', label: t('admin.banners.linkTypeUrl') }
                              ].map(type => (
                                  <TouchableOpacity 
                                    key={type.id} 
                                    style={[styles.typeBtn, linkType === type.id && styles.typeBtnActive]}
                                    onPress={() => {
                                        setLinkType(type.id as any);
                                        if (type.id === 'none') setFormData({ ...formData, button_link: '' });
                                    }}
                                  >
                                      <Text style={[styles.typeBtnText, linkType === type.id && styles.typeBtnTextActive]}>{type.label}</Text>
                                  </TouchableOpacity>
                              ))}
                          </View>
                      </View>

                      {linkType === 'product' && (
                          <View style={styles.selectorWrapper}>
                              <Text style={styles.miniLabel}>{t('admin.banners.labelSelectProduct')}</Text>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
                                  {products.map(p => (
                                      <TouchableOpacity 
                                        key={p.id} 
                                        style={[styles.chip, selectedProductId === p.id && styles.chipActive]}
                                        onPress={() => {
                                            setSelectedProductId(p.id);
                                            setFormData({ ...formData, button_link: `product:${p.id}` });
                                        }}
                                      >
                                          <Text style={[styles.chipText, selectedProductId === p.id && styles.chipTextActive]}>{p.name}</Text>
                                      </TouchableOpacity>
                                  ))}
                              </ScrollView>
                          </View>
                      )}

                      {linkType === 'category' && (
                          <View style={styles.selectorWrapper}>
                              <Text style={styles.miniLabel}>{t('admin.banners.labelSelectCategory')}</Text>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
                                  {categories.map(cat => (
                                      <TouchableOpacity 
                                        key={cat.id} 
                                        style={[styles.chip, selectedCategoryId === cat.id && styles.chipActive]}
                                        onPress={() => {
                                            setSelectedCategoryId(cat.id);
                                            setFormData({ ...formData, button_link: `category:${cat.id}` });
                                        }}
                                      >
                                          <Text style={[styles.chipText, selectedCategoryId === cat.id && styles.chipTextActive]}>
                                              {i18n.language === 'tr' ? cat.name_tr : cat.name_en}
                                          </Text>
                                      </TouchableOpacity>
                                  ))}
                              </ScrollView>
                          </View>
                      )}

                      {linkType === 'url' && (
                          <View style={styles.inputGroup}>
                              <TextInput 
                                style={styles.sheetInput}
                                value={formData.button_link}
                                onChangeText={t => setFormData({ ...formData, button_link: t })}
                                placeholder="https://..."
                                autoCapitalize="none"
                              />
                          </View>
                      )}

                      <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>{t('admin.banners.labelOrder')}</Text>
                          <TextInput 
                            style={styles.sheetInput}
                            value={formData.order_index.toString()}
                            onChangeText={t => setFormData({...formData, order_index: parseInt(t) || 0})}
                            placeholder="1"
                            keyboardType="number-pad"
                          />
                      </View>

                      <View style={styles.rowItem}>
                          <View style={{flex: 1}}>
                            <Text style={styles.inputLabel}>{t('admin.banners.labelActive')}</Text>
                            <Text style={styles.helperText}>{i18n.language === 'tr' ? 'Banner ana sayfada gösterilsin mi?' : 'Show banner on homepage?'}</Text>
                          </View>
                          <Switch value={formData.is_active} onValueChange={v => setFormData({...formData, is_active: v})} trackColor={{ false: '#eee', true: Colors.success + '40' }} thumbColor={formData.is_active ? Colors.success : '#999'} />
                      </View>

                      <TouchableOpacity style={styles.saveBtn} onPress={handleSaveBanner} disabled={uploadingImage}>
                          <Text style={styles.saveBtnText}>{selectedBanner ? t('admin.banners.buttonUpdate') : t('admin.banners.buttonAdd')}</Text>
                      </TouchableOpacity>
                      <View style={{height: 60}} />
                  </ScrollView>
              </View>
          </View>
      </Modal>

      <ConfirmModal
        visible={showDeleteModal}
        title={t('admin.banners.deleteTitle')}
        message={`"${selectedBanner?.title}" ${t('admin.banners.deleteMessage')}`}
        onConfirm={handleDeleteBanner}
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
  pageTitle: { fontSize: 24, fontWeight: '900', color: Colors.white },
  headerStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 30 },
  statCount: { fontSize: 28, fontWeight: '900', color: Colors.white },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '700', textTransform: 'uppercase' },
  addBannerBtn: { borderRadius: 20, overflow: 'hidden' },
  addGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 50, gap: 10 },
  addBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  listContainer: { padding: 20, gap: 20, paddingBottom: 100 },
  bannerCard: { backgroundColor: Colors.white, borderRadius: 32, overflow: 'hidden', ...Shadows.medium },
  imageBox: { height: 200, position: 'relative', backgroundColor: '#eee' },
  bannerImage: { width: '100%', height: '100%' },
  imageOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', padding: 20, justifyContent: 'space-between' },
  tagRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  orderText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { color: Colors.white, fontWeight: '800', fontSize: 11, textTransform: 'uppercase' },
  bannerTextContainer: { marginBottom: 10 },
  bannerTitleText: { fontSize: 22, fontWeight: '900', color: Colors.white },
  bannerSubtitleText: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  cardActionsFull: { flexDirection: 'row', padding: 12, gap: 12 },
  actionBtnFull: { flex: 1, flexDirection: 'row', height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 8 },
  editBtnMain: { backgroundColor: '#17A2B8' },
  deleteBtnMain: { backgroundColor: Colors.primary },
  actionBtnText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
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
  miniLabel: { fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 8 },
  sheetInput: { backgroundColor: '#F8F9FA', borderRadius: 20, padding: 18, fontSize: 16, color: '#333', borderWidth: 1, borderColor: '#eee' },
  mediaUpload: { borderRadius: 28, overflow: 'hidden', backgroundColor: '#F8F9FA' },
  uploadPlaceholder: { height: 180, borderStyle: 'dashed', borderWidth: 2, borderColor: '#ddd', borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  previewContainer: { height: 180, position: 'relative' },
  uploadPreview: { width: '100%', height: '100%' },
  preOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  changeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 8 },
  changeBadgeText: { color: Colors.white, fontWeight: '700', fontSize: 12 },
  mediaText: { marginTop: 12, fontSize: 14, color: Colors.primary, fontWeight: '700' },
  linkTypes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 5 },
  typeBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#eee', backgroundColor: '#fdfdfd' },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnText: { fontSize: 13, color: '#666', fontWeight: '700' },
  typeBtnTextActive: { color: Colors.white },
  selectorWrapper: { marginBottom: 20, backgroundColor: '#f9f9f9', padding: 12, borderRadius: 20 },
  hScroll: { marginTop: 5 },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 15, backgroundColor: Colors.white, borderWidth: 1, borderColor: '#eee', marginRight: 10 },
  chipActive: { backgroundColor: Colors.primary + '15', borderColor: Colors.primary },
  chipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  chipTextActive: { color: Colors.primary, fontWeight: '800' },
  rowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 35, backgroundColor: '#f8f9fa', padding: 20, borderRadius: 24 },
  helperText: { fontSize: 12, color: '#888', marginTop: 4 },
  saveBtn: { height: 64, backgroundColor: Colors.primary, borderRadius: 24, justifyContent: 'center', alignItems: 'center', ...Shadows.medium },
  saveBtnText: { color: Colors.white, fontSize: 17, fontWeight: '900' },
});

export default AdminBanners;
