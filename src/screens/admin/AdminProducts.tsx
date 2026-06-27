import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  TextInput,
  ScrollView,
  Switch,
  Platform,
  Alert,
  Dimensions,
  StatusBar
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';
import ConfirmModal from '../../components/ConfirmModal';
import { uploadProductImage, deleteImage } from '../../services/imageService';
import { useTranslation } from 'react-i18next';
import { MenuCategory } from '../../types';

const { width } = Dimensions.get('window');

// Ürün tipi (Product type)
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  category_id?: string;
  image_url: string;
  stock_status: 'in_stock' | 'out_of_stock';
  is_featured: boolean;
  ingredients?: string[];
  calories?: number | null;
  display_order?: number;
  created_at: string;
  updated_at?: string;
}

const AdminProducts = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // State'ler
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    image_url: '',
    stock_status: 'in_stock' as 'in_stock' | 'out_of_stock',
    is_featured: false,
    ingredients: [] as string[],
    calories: '',
    display_order: 0,
  });

  const [ingredientInput, setIngredientInput] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [localImagePreview, setLocalImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [filterCategory]);

  const getCategoryName = (category: MenuCategory): string => {
    return i18n.language === 'tr' ? category.name_tr : category.name_en;
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProducts = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      let query = supabase
        .from('products')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (filterCategory !== 'all') {
        query = query.eq('category_id', filterCategory);
      }

      const { data, error } = await query;
      if (error) throw error;

      setProducts(data || []);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.products.errorLoading') });
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setLocalImagePreview(null);
    setIngredientInput('');
    setFormData({
      name: '',
      description: '',
      price: '',
      category_id: categories.length > 0 ? categories[0].id : '',
      image_url: '',
      stock_status: 'in_stock',
      is_featured: false,
      ingredients: [],
      calories: '',
      display_order: 0,
    });
    setShowEditModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setLocalImagePreview(null);
    setIngredientInput('');
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      category_id: product.category_id || (categories.length > 0 ? categories[0].id : ''),
      image_url: product.image_url,
      stock_status: product.stock_status,
      is_featured: product.is_featured,
      ingredients: product.ingredients || [],
      calories: product.calories != null ? product.calories.toString() : '',
      display_order: product.display_order || 0,
    });
    setShowEditModal(true);
  };

  const handleSaveProduct = async () => {
    if (!formData.name || !formData.price || !formData.image_url || !formData.category_id) {
        Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.products.fillAllFields') });
        return;
    }

    try {
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        category_id: formData.category_id,
        image_url: formData.image_url.trim(),
        stock_status: formData.stock_status,
        is_featured: formData.is_featured,
        ingredients: formData.ingredients,
        calories: formData.calories.trim() ? parseInt(formData.calories) : null,
        display_order: formData.display_order,
      };

      if (selectedProduct) {
        const { error } = await supabase.from('products').update(productData).eq('id', selectedProduct.id);
        if (error) throw error;
        Toast.show({ type: 'success', text1: t('admin.products.success'), text2: t('admin.products.productUpdated') });
      } else {
        const { error } = await supabase.from('products').insert(productData);
        if (error) throw error;
        Toast.show({ type: 'success', text1: t('admin.products.success'), text2: t('admin.products.productAdded') });
      }

      setShowEditModal(false);
      await fetchProducts(true);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.products.errorSaving') });
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', selectedProduct.id);
      if (error) throw error;
      Toast.show({ type: 'success', text1: t('admin.products.success'), text2: t('admin.products.productDeleted') });
      setShowDeleteModal(false);
      fetchProducts();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.products.errorDeleting') });
    }
  };

  const handleSelectImage = async () => {
      if (Platform.OS === 'web' && fileInputRef.current) {
        // Aynı DOM input tekrar kullanıldığı için value'yu sıfırla;
        // aksi halde aynı/benzer dosya seçilince onChange tetiklenmez.
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true, aspect: [1, 1], quality: 0.8,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          handleImageUpload(result.assets[0].uri);
        }
      }
    };
  
    const handleImageUpload = async (fileOrUri: File | string) => {
      try {
        setUploadingImage(true);
        const imageUrl = await uploadProductImage(fileOrUri, selectedProduct?.id);
        setFormData(prev => ({ ...prev, image_url: imageUrl }));
        setLocalImagePreview(typeof fileOrUri === 'string' ? fileOrUri : URL.createObjectURL(fileOrUri));
        Toast.show({ type: 'success', text1: t('admin.products.imageUploaded') });
      } catch (error: any) {
        Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.products.imageUploadError') });
      } finally {
        setUploadingImage(false);
      }
    };
  
  const handleAddIngredient = () => {
    if (ingredientInput.trim() && !formData.ingredients.includes(ingredientInput.trim())) {
      setFormData(prev => ({ ...prev, ingredients: [...prev.ingredients, ingredientInput.trim()] }));
      setIngredientInput('');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const ProductCard = ({ product, index }: { product: Product, index: number }) => (
    <Animated.View 
      entering={FadeInDown.delay(index * 50).springify()} 
      layout={Layout.springify()}
      style={styles.productCard}
    >
      <View style={styles.imageSection}>
        <Image 
            source={{ uri: product.image_url }} 
            style={styles.productImage} 
            onError={() => {}} // Fallback logic can be added
        />
        <View style={styles.imageOverlay}>
             <View style={[styles.stockBadge, { backgroundColor: product.stock_status === 'in_stock' ? Colors.success : Colors.error }]}>
                <Ionicons name={product.stock_status === 'in_stock' ? 'checkmark-circle' : 'close-circle'} size={12} color={Colors.white} />
                <Text style={styles.stockText}>{product.stock_status === 'in_stock' ? t('admin.products.inStock') : t('admin.products.outOfStock')}</Text>
             </View>
             {product.is_featured && (
                 <View style={styles.featuredBadge}>
                     <Ionicons name="star" size={10} color="#B8860B" />
                     <Text style={styles.featuredText}>{t('admin.products.featured')}</Text>
                 </View>
             )}
        </View>
      </View>

      <View style={styles.contentSection}>
          <View style={styles.headerRow}>
              <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
              <Text style={styles.productPrice}>{product.price.toFixed(2)}₺</Text>
          </View>
          
          <Text style={styles.productCategory}>
              {categories.find(c => c.id === product.category_id)?.name_tr || product.category || 'Kategori Yok'}
          </Text>

          <View style={styles.actionRow}>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.editBtn]} 
                onPress={() => handleEditProduct(product)}
              >
                  <Ionicons name="create-outline" size={14} color={Colors.white} />
                  <Text style={styles.actionBtnText}>{t('common.edit')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionBtn, styles.customBtn]} 
                onPress={() => navigation.navigate('AdminProductCustomization', { product })}
              >
                 <Ionicons name="options-outline" size={14} color={Colors.white} />
                 <Text style={styles.actionBtnText}>{t('admin.products.custom')}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionBtn, styles.deleteBtn]} 
                onPress={() => { setSelectedProduct(product); setShowDeleteModal(true); }}
              >
                  <Ionicons name="trash-outline" size={14} color={Colors.white} />
                  <Text style={styles.actionBtnText}>{t('common.delete')}</Text>
              </TouchableOpacity>
          </View>
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a1a1a', '#333']} style={styles.topSection}>
        <View style={styles.breadcrumb}>
            <Text style={styles.breadText}>Admin</Text>
            <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
            <Text style={styles.breadText}>Panel</Text>
            <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
            <Text style={[styles.breadText, styles.breadActive]}>{t('admin.products.title')}</Text>
        </View>

        <View style={styles.headerNav}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={22} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.pageTitle}>{t('admin.products.title')}</Text>
            <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
                <Ionicons name="refresh" size={20} color={Colors.white} />
            </TouchableOpacity>
        </View>

        <View style={styles.searchBarWrapper}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.4)" style={styles.searchIcon} />
            <TextInput 
                style={styles.searchInput}
                placeholder={t('admin.products.searchPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={searchQuery}
                onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
            )}
        </View>
      </LinearGradient>

      <View style={styles.categoryFilterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={{paddingHorizontal: 20, gap: 10}}>
              <TouchableOpacity
                style={[styles.catChip, filterCategory === 'all' && styles.catChipActive]}
                onPress={() => setFilterCategory('all')}
              >
                  <Text style={[styles.catChipText, filterCategory === 'all' && styles.catChipTextActive]}>{t('common.all')}</Text>
              </TouchableOpacity>
              {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catChip, filterCategory === cat.id && styles.catChipActive]}
                    onPress={() => setFilterCategory(cat.id)}
                  >
                      <Text style={[styles.catChipText, filterCategory === cat.id && styles.catChipTextActive]}>{getCategoryName(cat)}</Text>
                  </TouchableOpacity>
              ))}
          </ScrollView>
      </View>

      <FlatList
        data={filteredProducts}
        renderItem={({ item, index }) => <ProductCard product={item} index={index} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
            <View style={styles.emptyView}>
                <Ionicons name="fast-food-outline" size={64} color="#DDD" />
                <Text style={styles.emptyText}>{t('admin.products.noProductsFound')}</Text>
            </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={handleAddProduct}>
          <LinearGradient colors={[Colors.primary, '#FF6B6B']} style={styles.fabGradient}>
              <Ionicons name="add" size={30} color={Colors.white} />
          </LinearGradient>
      </TouchableOpacity>
      
      {/* Edit Modal - Modern Full Screen Sheet */}
      <Modal visible={showEditModal} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedProduct ? t('admin.products.editProductTitle') : t('admin.products.addProductTitle')}</Text>
                  <TouchableOpacity onPress={() => setShowEditModal(false)} style={styles.closeModalBtn}>
                      <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {/* Image Upload Area */}
                  <TouchableOpacity style={styles.imageUploadArea} onPress={handleSelectImage}>
                      {uploadingImage ? (
                          <ActivityIndicator color={Colors.primary} />
                      ) : (localImagePreview || formData.image_url) ? (
                          <View style={styles.previewContainer}>
                              <Image source={{ uri: localImagePreview || formData.image_url }} style={styles.previewImage} />
                              <View style={styles.changeImageOverlay}>
                                  <Ionicons name="camera" size={24} color="#FFF" />
                                  <Text style={styles.changeImageText}>{t('admin.products.changeImage')}</Text>
                              </View>
                          </View>
                      ) : (
                          <View style={styles.uploadPlaceholder}>
                              <Ionicons name="cloud-upload-outline" size={40} color={Colors.primary} />
                              <Text style={styles.uploadText}>{t('admin.products.uploadImageButton')}</Text>
                          </View>
                      )}
                      
                      {Platform.OS === 'web' && (
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(file);
                                e.target.value = '';
                            }}
                        />
                      )}
                  </TouchableOpacity>

                  {/* Manuel URL girişi */}
                  <View style={styles.inputGroup}>
                      <Text style={styles.label}>{t('admin.products.manualUrlLabel')}</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.image_url}
                        onChangeText={v => setFormData({ ...formData, image_url: v })}
                        placeholder={t('admin.products.imageUrlPlaceholder')}
                        placeholderTextColor="#BBB"
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                      />
                  </View>

                  <View style={styles.inputGroup}>
                      <Text style={styles.label}>{t('admin.products.productNameLabel')}</Text>
                      <TextInput 
                        style={styles.input} 
                        value={formData.name}
                        onChangeText={v => setFormData({...formData, name: v})}
                        placeholder={t('admin.products.namePlaceholder')}
                      />
                  </View>

                  <View style={styles.rowInputs}>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                          <Text style={styles.label}>{t('admin.products.priceLabel')}</Text>
                          <TextInput 
                            style={styles.input} 
                            value={formData.price}
                            onChangeText={t => setFormData({...formData, price: t})}
                            keyboardType="numeric"
                            placeholder="0.00"
                          />
                      </View>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>{t('admin.products.sortOrderLabel')}</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.display_order.toString()}
                                onChangeText={t => setFormData({...formData, display_order: parseInt(t) || 0})}
                                keyboardType="numeric"
                            />
                      </View>
                  </View>

                  <View style={styles.inputGroup}>
                      <Text style={styles.label}>{t('admin.products.caloriesLabel')}</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.calories}
                        onChangeText={v => setFormData({...formData, calories: v.replace(/[^0-9]/g, '')})}
                        keyboardType="numeric"
                        placeholder="450"
                      />
                      <Text style={styles.helperText}>{t('admin.products.caloriesHelper')}</Text>
                  </View>

                  <View style={styles.inputGroup}>
                      <Text style={styles.label}>{t('admin.products.categoryLabel')}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catSelectScroll}>
                          {categories.map(cat => (
                              <TouchableOpacity
                                key={cat.id}
                                style={[styles.catSelectChip, formData.category_id === cat.id && styles.catSelectChipActive]}
                                onPress={() => setFormData({...formData, category_id: cat.id})}
                              >
                                  <Text style={[styles.catSelectText, formData.category_id === cat.id && styles.catSelectTextActive]}>{getCategoryName(cat)}</Text>
                              </TouchableOpacity>
                          ))}
                      </ScrollView>
                  </View>

                  <View style={styles.inputGroup}>
                      <Text style={styles.label}>{t('admin.products.descriptionLabel')}</Text>
                      <TextInput 
                        style={[styles.input, styles.textArea]} 
                        value={formData.description}
                        onChangeText={v => setFormData({...formData, description: v})}
                        multiline
                        numberOfLines={4}
                        placeholder={t('admin.products.descriptionPlaceholder')}
                      />
                  </View>

                  <View style={styles.inputGroup}>
                      <Text style={styles.label}>{t('admin.products.ingredientsLabel')}</Text>
                      <View style={styles.ingInputWrap}>
                          <TextInput 
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                            value={ingredientInput}
                            onChangeText={setIngredientInput}
                            placeholder={t('admin.products.ingredientPlaceholder')}
                            onSubmitEditing={handleAddIngredient}
                          />
                          <TouchableOpacity style={styles.addIngBtn} onPress={handleAddIngredient}>
                              <Ionicons name="add" size={24} color={Colors.white} />
                          </TouchableOpacity>
                      </View>
                      <View style={styles.ingList}>
                          {formData.ingredients.map((ing, i) => (
                              <View key={i} style={styles.ingChip}>
                                  <Text style={styles.ingText}>{ing}</Text>
                                  <TouchableOpacity onPress={() => setFormData({...formData, ingredients: formData.ingredients.filter(x => x !== ing)})}>
                                      <Ionicons name="close-circle" size={16} color="#888" />
                                  </TouchableOpacity>
                              </View>
                          ))}
                      </View>
                  </View>

                  <View style={styles.switchesContainer}>
                      <View style={styles.switchRow}>
                          <Text style={styles.switchLabel}>{t('admin.products.stockLabel')}</Text>
                          <Switch 
                            value={formData.stock_status === 'in_stock'}
                            onValueChange={v => setFormData({...formData, stock_status: v ? 'in_stock' : 'out_of_stock'})}
                            trackColor={{ false: '#eee', true: Colors.success + '40' }}
                            thumbColor={formData.stock_status === 'in_stock' ? Colors.success : '#999'}
                          />
                      </View>
                      <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
                          <Text style={styles.switchLabel}>{t('admin.products.featuredLabel')}</Text>
                          <Switch 
                            value={formData.is_featured}
                            onValueChange={v => setFormData({...formData, is_featured: v})}
                            trackColor={{ false: '#eee', true: '#FFD70040' }}
                            thumbColor={formData.is_featured ? '#FFD700' : '#999'}
                          />
                      </View>
                  </View>

                  <TouchableOpacity style={styles.saveBigBtn} onPress={handleSaveProduct}>
                      <Text style={styles.saveBigBtnText}>{selectedProduct ? t('admin.products.updateButton') : t('admin.products.addButton')}</Text>
                  </TouchableOpacity>
                  <View style={{height: 100}} />
              </ScrollView>
          </View>
      </Modal>

      <ConfirmModal
        visible={showDeleteModal}
        title={t('admin.products.deleteTitle')}
        message={`"${selectedProduct?.name}" ${t('admin.products.deleteMessage')}`}
        confirmText={t('admin.products.deleteConfirmButton')}
        cancelText={t('admin.products.deleteCancelButton')}
        onConfirm={handleDeleteProduct}
        onCancel={() => setShowDeleteModal(false)}
        type="danger"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  topSection: { paddingTop: 50, paddingBottom: 24, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, ...Shadows.medium },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, opacity: 0.8 },
  breadText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 },
  breadActive: { color: Colors.white, opacity: 1 },
  headerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: 22, fontWeight: '900', color: Colors.white },
  searchBarWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 18, paddingHorizontal: 16, height: 50 },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, color: Colors.white, fontSize: 15 },
  categoryFilterContainer: { marginTop: 20, marginBottom: 10 },
  catScroll: { paddingBottom: 10 },
  catChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 16, backgroundColor: Colors.white, borderWidth: 1, borderColor: '#EEE' },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { fontWeight: '700', color: '#666', fontSize: 13 },
  catChipTextActive: { color: Colors.white },
  listContainer: { padding: 20, paddingBottom: 100 },
  productCard: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: 24, marginBottom: 16, overflow: 'hidden', ...Shadows.small },
  imageSection: { width: 110, height: 110, position: 'relative' },
  productImage: { width: '100%', height: '100%' },
  imageOverlay: { position: 'absolute', top: 6, left: 6, gap: 4 },
  stockBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  stockText: { color: Colors.white, fontSize: 8, fontWeight: '900' },
  featuredBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFFBE6', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  featuredText: { color: '#B8860B', fontSize: 8, fontWeight: '900' },
  contentSection: { flex: 1, padding: 14, justifyContent: 'space-between' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  productName: { fontSize: 16, fontWeight: '800', color: Colors.text, flex: 1, marginRight: 8 },
  productPrice: { fontSize: 16, fontWeight: '900', color: Colors.primary },
  productCategory: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', width: '100%' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, gap: 4, flex: 1 },
  actionBtnText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  editBtn: { backgroundColor: '#17A2B8' },
  customBtn: { backgroundColor: '#6C757D' },
  deleteBtn: { backgroundColor: Colors.error },
  fab: { position: 'absolute', bottom: 30, right: 30, ...Shadows.large },
  fabGradient: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  emptyView: { alignItems: 'center', marginTop: 100, gap: 16 },
  emptyText: { color: '#CCC', fontWeight: '700' },
  modalContainer: { flex: 1, backgroundColor: '#FAFAFA' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE', backgroundColor: Colors.white },
  modalTitle: { fontSize: 18, fontWeight: '900', color: Colors.text },
  closeModalBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  modalBody: { padding: 20 },
  imageUploadArea: { height: 200, backgroundColor: '#FFF', borderRadius: 24, borderWidth: 2, borderColor: '#EEE', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 24, overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  uploadPlaceholder: { alignItems: 'center', gap: 10 },
  uploadText: { color: Colors.primary, fontWeight: '700' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '800', color: '#999', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: Colors.white, borderWidth: 1, borderColor: '#EEE', borderRadius: 16, padding: 16, fontSize: 16, color: Colors.text },
  helperText: { fontSize: 12, color: '#999', marginTop: 6 },
  textArea: { height: 100, textAlignVertical: 'top' },
  rowInputs: { flexDirection: 'row', gap: 16 },
  catSelectScroll: { flexDirection: 'row' },
  catSelectChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE', marginRight: 10 },
  catSelectChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catSelectText: { fontWeight: '600', color: '#666' },
  catSelectTextActive: { color: Colors.white },
  ingInputWrap: { flexDirection: 'row', gap: 10 },
  addIngBtn: { width: 50, backgroundColor: Colors.primary, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  ingList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  ingChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#EEE' },
  ingText: { fontWeight: '600', color: '#555', fontSize: 13 },
  switchesContainer: { backgroundColor: Colors.white, borderRadius: 20, padding: 20, marginBottom: 30, borderWidth: 1, borderColor: '#EEE' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  switchLabel: { fontSize: 16, fontWeight: '700', color: Colors.text },
  saveBigBtn: { backgroundColor: Colors.primary, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', ...Shadows.medium },
  saveBigBtnText: { color: Colors.white, fontSize: 18, fontWeight: '900' },
  previewContainer: { width: '100%', height: '100%', position: 'relative' },
  changeImageOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', gap: 8 },
  changeImageText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});

export default AdminProducts;
