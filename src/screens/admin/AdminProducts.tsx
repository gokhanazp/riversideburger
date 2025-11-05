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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';
import ConfirmModal from '../../components/ConfirmModal';
import { uploadProductImage, deleteImage } from '../../services/imageService';
import { useTranslation } from 'react-i18next';
import { MenuCategory } from '../../types';

// Ürün tipi (Product type)
interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // Fiyat - ülke seçimine göre sembol eklenir (Price - symbol added based on country selection)
  category: string; // Eski kategori (Old category - deprecated)
  category_id?: string; // Yeni kategori ID (New category ID from menu_categories)
  image_url: string;
  stock_status: 'in_stock' | 'out_of_stock';
  is_featured: boolean;
  ingredients?: string[];
  created_at: string;
}

// Admin Ürünler Ekranı (Admin Products Screen)
const AdminProducts = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();

  // Sayfa başlığını ayarla (Set page title)
  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('admin.screenTitles.productManagement'),
    });
  }, [navigation, t, i18n.language]);

  // State'ler (States)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]); // Dinamik kategoriler (Dynamic categories)
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Kategori ismini mevcut dile göre al (Get category name based on current language)
  const getCategoryName = (category: MenuCategory): string => {
    return i18n.language === 'tr' ? category.name_tr : category.name_en;
  };

  // Form state'leri (Form states)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '', // Yeni: Kategori ID (New: Category ID)
    image_url: '',
    stock_status: 'in_stock' as 'in_stock' | 'out_of_stock',
    is_featured: false,
    ingredients: [] as string[],
  });

  // Malzeme input state'i (Ingredient input state)
  const [ingredientInput, setIngredientInput] = useState('');

  // Resim yükleme state'leri (Image upload states)
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sayfa yüklendiğinde kategorileri getir (Fetch categories on page load)
  useEffect(() => {
    fetchCategories();
  }, []);

  // Kategori filtresi değiştiğinde ürünleri getir (Fetch products when filter changes)
  useEffect(() => {
    fetchProducts();
  }, [filterCategory]);

  // Kategorileri getir (Fetch categories)
  const fetchCategories = async () => {
    try {
      console.log('🔍 Fetching categories from menu_categories...');
      const { data, error } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }

      console.log('✅ Categories fetched:', data?.length || 0);
      console.log('📋 Category IDs:', data?.map(c => ({ id: c.id, name: c.name_en })));
      setCategories(data || []);
    } catch (error: any) {
      console.error('❌ Error fetching categories:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: t('admin.categories.errorLoading'),
      });
    }
  };

  // Ürünleri getir (Fetch products)
  const fetchProducts = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching products, filter:', filterCategory);

      let query = supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      // Kategori filtresi (Category filter)
      if (filterCategory !== 'all') {
        query = query.eq('category_id', filterCategory);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Fetch error:', error);
        throw error;
      }

      console.log('✅ Products fetched:', data?.length || 0);
      setProducts(data || []);
    } catch (error: any) {
      console.error('❌ Error fetching products:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: error.message || t('admin.products.errorLoading'),
      });
      setProducts([]); // Hata durumunda boş array
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Yenileme (Refresh)
  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  // Yeni ürün ekle modalını aç (Open add product modal)
  const handleAddProduct = () => {
    setSelectedProduct(null);
    setSelectedFile(null);
    setIngredientInput('');
    setFormData({
      name: '',
      description: '',
      price: '',
      category_id: categories.length > 0 ? categories[0].id : '', // İlk kategoriyi seç (Select first category)
      image_url: '',
      stock_status: 'in_stock',
      is_featured: false,
      ingredients: [],
    });
    setShowEditModal(true);
  };

  // Ürün düzenle modalını aç (Open edit product modal)
  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedFile(null);
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
    });
    setShowEditModal(true);
  };

  // Malzeme ekle (Add ingredient)
  const handleAddIngredient = () => {
    const ingredient = ingredientInput.trim();
    if (ingredient && !formData.ingredients.includes(ingredient)) {
      setFormData({
        ...formData,
        ingredients: [...formData.ingredients, ingredient],
      });
      setIngredientInput('');
    }
  };

  // Malzeme çıkar (Remove ingredient)
  const handleRemoveIngredient = (ingredient: string) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((i) => i !== ingredient),
    });
  };

  // Resim seç (Select image)
  const handleSelectImage = () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Dosya seçildiğinde (When file is selected)
  const handleFileChange = async (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      console.log('📤 Resim yükleniyor...', file.name);

      // Resmi yükle (Upload image)
      const imageUrl = await uploadProductImage(file, selectedProduct?.id);

      // Eski resmi sil (Delete old image if exists)
      if (selectedProduct?.image_url && formData.image_url !== imageUrl) {
        try {
          await deleteImage(selectedProduct.image_url, 'product-images');
        } catch (error) {
          console.warn('Eski resim silinemedi:', error);
        }
      }

      // Form data'yı güncelle (Update form data)
      setFormData({ ...formData, image_url: imageUrl });
      setSelectedFile(file);

      Toast.show({
        type: 'success',
        text1: t('admin.products.imageUploaded'),
        text2: file.name,
      });
    } catch (error: any) {
      console.error('❌ Resim yükleme hatası:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: error.message || t('admin.products.imageUploadError'),
      });
    } finally {
      setUploadingImage(false);
    }
  };

  // Ürün kaydet (Save product)
  const handleSaveProduct = async () => {
    try {
      // Validasyon (Validation)
      if (!formData.name || !formData.price || !formData.image_url) {
        Toast.show({
          type: 'error',
          text1: t('admin.error'),
          text2: t('admin.products.fillAllFields'),
        });
        return;
      }

      // Kategori kontrolü (Category validation)
      if (!formData.category_id) {
        Toast.show({
          type: 'error',
          text1: t('admin.error'),
          text2: t('admin.products.selectCategory'),
        });
        return;
      }

      // Fiyat kontrolü (Price validation)
      const priceValue = parseFloat(formData.price);
      if (isNaN(priceValue) || priceValue <= 0) {
        Toast.show({
          type: 'error',
          text1: t('admin.error'),
          text2: t('admin.products.invalidPrice'),
        });
        return;
      }

      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: priceValue,
        category_id: formData.category_id, // Yeni: Kategori ID (New: Category ID)
        image_url: formData.image_url.trim(),
        stock_status: formData.stock_status,
        is_featured: formData.is_featured,
        ingredients: formData.ingredients,
      };

      console.log('💾 Saving product with category_id:', formData.category_id);
      console.log('📋 Full product data:', productData);

      if (selectedProduct) {
        // Güncelle (Update)
        const { data, error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', selectedProduct.id)
          .select();

        if (error) {
          console.error('❌ Update error:', error);
          throw error;
        }

        console.log('✅ Product updated:', data);

        Toast.show({
          type: 'success',
          text1: t('admin.products.success'),
          text2: t('admin.products.productUpdated'),
        });
      } else {
        // Yeni ekle (Insert)
        const { data, error } = await supabase
          .from('products')
          .insert(productData)
          .select();

        if (error) {
          console.error('❌ Insert error:', error);
          throw error;
        }

        console.log('✅ Product added:', data);

        Toast.show({
          type: 'success',
          text1: t('admin.products.success'),
          text2: t('admin.products.productAdded'),
        });
      }

      setShowEditModal(false);
      fetchProducts();
    } catch (error: any) {
      console.error('❌ Error saving product:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: error.message || t('admin.products.errorSaving'),
      });
    }
  };

  // Ürün sil (Delete product)
  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;

    try {
      const { error } = await supabase.from('products').delete().eq('id', selectedProduct.id);

      if (error) throw error;

      Toast.show({
        type: 'success',
        text1: t('admin.products.success'),
        text2: t('admin.products.productDeleted'),
      });

      setShowDeleteModal(false);
      fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: t('admin.products.errorDeleting'),
      });
    }
  };

  // Stok durumunu değiştir (Toggle stock status)
  const toggleStockStatus = async (product: Product) => {
    try {
      const newStatus = product.stock_status === 'in_stock' ? 'out_of_stock' : 'in_stock';

      const { error } = await supabase
        .from('products')
        .update({ stock_status: newStatus })
        .eq('id', product.id);

      if (error) throw error;

      Toast.show({
        type: 'success',
        text1: t('admin.products.success'),
        text2: t('admin.products.stockUpdated'),
      });

      fetchProducts();
    } catch (error: any) {
      console.error('Error updating stock status:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: t('admin.products.stockUpdateError'),
      });
    }
  };

  // Ürün kartı (Product card)
  const ProductCard = ({ product }: { product: Product }) => (
    <View style={styles.productCard}>
      <Image source={{ uri: product.image_url }} style={styles.productImage} />

      <View style={styles.productInfo}>
        <View style={styles.productHeader}>
          <Text style={styles.productName} numberOfLines={1}>
            {product.name}
          </Text>
          {product.is_featured && (
            <View style={styles.featuredBadge}>
              <Ionicons name="star" size={12} color="#FFD700" />
            </View>
          )}
        </View>

        <Text style={styles.productDescription} numberOfLines={2}>
          {product.description}
        </Text>

        <View style={styles.productFooter}>
          <Text style={styles.productPrice}>
            {product.price.toFixed(2)}
          </Text>
          <View
            style={[
              styles.stockBadge,
              { backgroundColor: product.stock_status === 'in_stock' ? '#28A74520' : '#DC354520' },
            ]}
          >
            <Text
              style={[
                styles.stockText,
                { color: product.stock_status === 'in_stock' ? '#28A745' : '#DC3545' },
              ]}
            >
              {product.stock_status === 'in_stock' ? t('admin.products.inStock') : t('admin.products.outOfStock')}
            </Text>
          </View>
        </View>

        <View style={styles.productActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.stockButton]}
            onPress={() => toggleStockStatus(product)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={product.stock_status === 'in_stock' ? 'close-circle' : 'checkmark-circle'}
              size={18}
              color={product.stock_status === 'in_stock' ? '#DC3545' : '#28A745'}
            />
            <Text
              style={[
                styles.actionButtonText,
                { color: product.stock_status === 'in_stock' ? '#DC3545' : '#28A745' },
              ]}
            >
              {product.stock_status === 'in_stock' ? t('admin.products.removeFromStock') : t('admin.products.addToStock')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleEditProduct(product)}
            activeOpacity={0.7}
          >
            <Ionicons name="create" size={18} color={Colors.primary} />
            <Text style={[styles.actionButtonText, { color: Colors.primary }]}>
              {t('admin.products.editButton')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => {
              setSelectedProduct(product);
              setShowDeleteModal(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="trash" size={18} color="#DC3545" />
            <Text style={[styles.actionButtonText, { color: '#DC3545' }]}>
              {t('admin.products.deleteButton')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Özelleştirme butonu (Customization button) */}
        <TouchableOpacity
          style={styles.customizeButton}
          onPress={() => navigation.navigate('AdminProductCustomization', { product })}
          activeOpacity={0.7}
        >
          <Ionicons name="options" size={18} color="#FF6B35" />
          <Text style={styles.customizeButtonText}>
            {t('admin.products.customizationButton')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('admin.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filtreler ve Ekle Butonu (Filters and Add Button) */}
      <View style={styles.topBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
          <TouchableOpacity
            style={[styles.filterButton, filterCategory === 'all' && styles.filterButtonActive]}
            onPress={() => setFilterCategory('all')}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.filterButtonText, filterCategory === 'all' && styles.filterButtonTextActive]}
            >
              Tümü
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.filterButton, filterCategory === cat.id && styles.filterButtonActive]}
              onPress={() => setFilterCategory(cat.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterCategory === cat.id && styles.filterButtonTextActive,
                ]}
              >
                {getCategoryName(cat)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.addButton} onPress={handleAddProduct} activeOpacity={0.8}>
          <Ionicons name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Ürün listesi (Products list) */}
      <FlatList
        data={products}
        renderItem={({ item }) => <ProductCard product={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="fast-food-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Ürün bulunamadı</Text>
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
                  {selectedProduct ? t('admin.products.editProductTitle') : t('admin.products.addProductTitle')}
                </Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                {/* Ürün Adı (Product Name) */}
                <Text style={styles.label}>{t('admin.products.productNameLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('admin.products.namePlaceholder')}
                  placeholderTextColor="#999"
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                />

                {/* Açıklama (Description) */}
                <Text style={styles.label}>{t('admin.products.descriptionLabel')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder={t('admin.products.descriptionPlaceholder')}
                  placeholderTextColor="#999"
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  multiline
                  numberOfLines={3}
                />

                {/* Fiyat (Price) */}
                <Text style={styles.label}>{t('admin.products.priceLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('admin.products.pricePlaceholder')}
                  placeholderTextColor="#999"
                  value={formData.price}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.helperText}>
                  {t('admin.products.priceHelper')}
                </Text>

                {/* Kategori (Category) */}
                <Text style={styles.label}>{t('admin.products.categoryLabel')}</Text>
                {categories.length === 0 ? (
                  <Text style={styles.helperText}>⚠️ {t('admin.products.categoriesLoading')}</Text>
                ) : (
                  <View style={styles.categoryGrid}>
                    {categories.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryButton,
                          formData.category_id === cat.id && styles.categoryButtonActive,
                        ]}
                        onPress={() => {
                          console.log('🎯 Category selected:', cat.id, cat.name_en);
                          setFormData({ ...formData, category_id: cat.id });
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons
                            name={cat.icon as any}
                            size={18}
                            color={formData.category_id === cat.id ? Colors.primary : '#666'}
                          />
                          <Text
                            style={[
                              styles.categoryButtonText,
                              formData.category_id === cat.id && styles.categoryButtonTextActive,
                              { marginLeft: 6 }
                            ]}
                          >
                            {getCategoryName(cat)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Resim Yükleme (Image Upload) */}
                <Text style={styles.label}>{t('admin.products.productImageLabel')}</Text>

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
                      <Text style={styles.uploadButtonText}>{t('admin.products.uploading')}</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={24} color={Colors.white} />
                      <Text style={styles.uploadButtonText}>
                        {formData.image_url ? t('admin.products.changeImageButton') : t('admin.products.uploadImageButton')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Bilgi mesajı (Info message) */}
                <Text style={styles.uploadInfo}>
                  {t('admin.products.uploadInfo1')}
                </Text>
                <Text style={styles.uploadInfo}>
                  {t('admin.products.uploadInfo2')}
                </Text>

                {/* Resim Önizleme (Image Preview) */}
                {formData.image_url && (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: formData.image_url }} style={styles.imagePreview} />
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
                <Text style={styles.label}>{t('admin.products.manualUrlLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('admin.products.imageUrlPlaceholder')}
                  placeholderTextColor="#999"
                  value={formData.image_url}
                  onChangeText={(text) => setFormData({ ...formData, image_url: text })}
                  autoCapitalize="none"
                />

                {/* Stok Durumu (Stock Status) */}
                <View style={styles.switchRow}>
                  <Text style={styles.label}>{t('admin.products.stockLabel')}</Text>
                  <Switch
                    value={formData.stock_status === 'in_stock'}
                    onValueChange={(value) =>
                      setFormData({ ...formData, stock_status: value ? 'in_stock' : 'out_of_stock' })
                    }
                    trackColor={{ false: '#DDD', true: Colors.primary + '40' }}
                    thumbColor={formData.stock_status === 'in_stock' ? Colors.primary : '#999'}
                  />
                </View>

                {/* Malzemeler (Ingredients) */}
                <Text style={styles.label}>{t('admin.products.ingredientsLabel')}</Text>
                <Text style={styles.helperText}>
                  {t('admin.products.ingredientsHelper')}
                </Text>

                {/* Malzeme ekleme input (Ingredient input) */}
                <View style={styles.ingredientInputContainer}>
                  <TextInput
                    style={styles.ingredientInput}
                    placeholder={t('admin.products.ingredientPlaceholder')}
                    placeholderTextColor="#999"
                    value={ingredientInput}
                    onChangeText={setIngredientInput}
                    onSubmitEditing={handleAddIngredient}
                  />
                  <TouchableOpacity
                    style={styles.addIngredientButton}
                    onPress={handleAddIngredient}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add-circle" size={32} color={Colors.primary} />
                  </TouchableOpacity>
                </View>

                {/* Malzeme listesi (Ingredients list) */}
                {formData.ingredients.length > 0 && (
                  <View style={styles.ingredientsList}>
                    {formData.ingredients.map((ingredient, index) => (
                      <View key={index} style={styles.ingredientChip}>
                        <Text style={styles.ingredientChipText}>{ingredient}</Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveIngredient(ingredient)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close-circle" size={20} color="#DC3545" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Öne Çıkan (Featured) */}
                <View style={styles.switchRow}>
                  <Text style={styles.label}>{t('admin.products.featuredLabel')}</Text>
                  <Switch
                    value={formData.is_featured}
                    onValueChange={(value) => setFormData({ ...formData, is_featured: value })}
                    trackColor={{ false: '#DDD', true: '#FFD70040' }}
                    thumbColor={formData.is_featured ? '#FFD700' : '#999'}
                  />
                </View>
              </ScrollView>

              {/* Kaydet Butonu (Save Button) */}
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveProduct} activeOpacity={0.8}>
                <Text style={styles.saveButtonText}>
                  {selectedProduct ? t('admin.products.updateButton') : t('admin.products.addButton')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Silme Onay Modal (Delete Confirmation Modal) */}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  filtersContainer: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
  },
  filterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: Colors.white,
    marginRight: Spacing.xs,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary,
  },
  filterButtonText: {
    fontSize: FontSizes.sm,
    color: '#666',
  },
  filterButtonTextActive: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    ...Shadows.small,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.small,
  },
  productImage: {
    width: 120,
    height: 120,
    backgroundColor: '#F0F0F0',
  },
  productInfo: {
    flex: 1,
    padding: Spacing.sm,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  productName: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: '#333',
  },
  featuredBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFD70020',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productDescription: {
    fontSize: FontSizes.sm,
    color: '#666',
    marginBottom: Spacing.xs,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  productPrice: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  stockBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  stockText: {
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
  },
  productActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  stockButton: {
    borderColor: '#DDD',
    backgroundColor: Colors.white,
  },
  editButton: {
    borderColor: Colors.primary + '40',
    backgroundColor: Colors.primary + '10',
  },
  deleteButton: {
    borderColor: '#DC354540',
    backgroundColor: '#DC354510',
  },
  actionButtonText: {
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
  },
  customizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#FF6B3540',
    backgroundColor: '#FF6B3510',
  },
  customizeButtonText: {
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
    color: '#FF6B35',
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: Colors.white,
  },
  categoryButtonActive: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary,
  },
  categoryButtonText: {
    fontSize: FontSizes.sm,
    color: '#666',
  },
  categoryButtonTextActive: {
    color: Colors.primary,
    fontWeight: 'bold',
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
    height: 200,
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
  helperText: {
    fontSize: FontSizes.xs,
    color: '#666',
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },
  ingredientInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  ingredientInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addIngredientButton: {
    padding: 4,
  },
  ingredientsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  ingredientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.xs,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  ingredientChipText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  saveButton: {
    margin: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.medium,
  },
  saveButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.white,
  },
});

export default AdminProducts;

