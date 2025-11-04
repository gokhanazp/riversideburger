import { supabase } from '../lib/supabase';
import {
  ProductOptionCategory,
  ProductOption,
  ProductAvailableOption,
  CategoryWithOptions,
  OrderItemCustomization,
} from '../types/customization';

// Ürün özelleştirme servisi (Product customization service)
export const customizationService = {
  // Tüm kategorileri getir (Get all categories)
  async getAllCategories(): Promise<ProductOptionCategory[]> {
    try {
      const { data, error } = await supabase
        .from('product_option_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  },

  // Kategoriye göre seçenekleri getir (Get options by category)
  async getOptionsByCategory(categoryId: string): Promise<ProductOption[]> {
    try {
      const { data, error } = await supabase
        .from('product_options')
        .select('*')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching options:', error);
      throw error;
    }
  },

  // Ürün için mevcut özelleştirmeleri getir (Get available customizations for product)
  async getProductCustomizations(productId: string): Promise<CategoryWithOptions[]> {
    try {
      // 1. Ürün için mevcut kategorileri getir
      const { data: availableOptions, error: availableError } = await supabase
        .from('product_available_options')
        .select('*')
        .eq('product_id', productId);

      if (availableError) throw availableError;

      if (!availableOptions || availableOptions.length === 0) {
        return [];
      }

      // 2. Her kategori için detayları ve seçenekleri getir
      const categoryIds = availableOptions.map((opt) => opt.category_id);

      const { data: categories, error: categoriesError } = await supabase
        .from('product_option_categories')
        .select('*')
        .in('id', categoryIds)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (categoriesError) throw categoriesError;

      const { data: options, error: optionsError } = await supabase
        .from('product_options')
        .select('*')
        .in('category_id', categoryIds)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (optionsError) throw optionsError;

      // 3. Kategorileri ve seçenekleri birleştir
      const result: CategoryWithOptions[] = (categories || []).map((category) => {
        const availableOption = availableOptions.find(
          (opt) => opt.category_id === category.id
        );
        const categoryOptions = (options || []).filter(
          (opt) => opt.category_id === category.id
        );

        return {
          category,
          options: categoryOptions,
          is_required: availableOption?.is_required || false,
          max_selections: availableOption?.max_selections,
        };
      });

      return result;
    } catch (error) {
      console.error('Error fetching product customizations:', error);
      throw error;
    }
  },

  // Ürüne özelleştirme seçenekleri ekle (Add customization options to product)
  async addProductCustomization(
    productId: string,
    categoryId: string,
    isRequired: boolean = false,
    maxSelections?: number
  ): Promise<ProductAvailableOption> {
    try {
      const { data, error } = await supabase
        .from('product_available_options')
        .insert({
          product_id: productId,
          category_id: categoryId,
          is_required: isRequired,
          max_selections: maxSelections,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding product customization:', error);
      throw error;
    }
  },

  // Üründen özelleştirme seçeneğini kaldır (Remove customization option from product)
  async removeProductCustomization(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('product_available_options')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing product customization:', error);
      throw error;
    }
  },

  // Ürün için spesifik seçenekleri getir (Get specific options for product)
  async getProductSpecificOptions(productId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('product_specific_options')
        .select(`
          id,
          option_id,
          is_required,
          is_default,
          product_options!inner (
            id,
            name,
            name_en,
            description,
            price,
            display_order,
            category_id,
            product_option_categories!inner (
              id,
              name,
              name_en,
              display_order
            )
          )
        `)
        .eq('product_id', productId);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Veriyi düzenle (Format data)
      const formatted = (data || []).map((item: any) => ({
        id: item.id,
        option_id: item.option_id,
        is_required: item.is_required,
        is_default: item.is_default,
        option: {
          id: item.product_options.id,
          name: item.product_options.name,
          name_en: item.product_options.name_en,
          description: item.product_options.description,
          price: item.product_options.price,
          display_order: item.product_options.display_order,
          category: item.product_options.product_option_categories,
        },
      }));

      // Manuel sıralama (Manual sorting)
      formatted.sort((a, b) => {
        const catOrderA = a.option.category.display_order || 0;
        const catOrderB = b.option.category.display_order || 0;
        if (catOrderA !== catOrderB) return catOrderA - catOrderB;
        return (a.option.display_order || 0) - (b.option.display_order || 0);
      });

      console.log('✅ getProductSpecificOptions result:', formatted);
      return formatted;
    } catch (error) {
      console.error('❌ Error fetching product specific options:', error);
      throw error;
    }
  },

  // Ürüne spesifik seçenek ekle (Add specific option to product)
  async addProductSpecificOption(
    productId: string,
    optionId: string,
    isRequired: boolean = false,
    isDefault: boolean = false
  ): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('product_specific_options')
        .insert({
          product_id: productId,
          option_id: optionId,
          is_required: isRequired,
          is_default: isDefault,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding product specific option:', error);
      throw error;
    }
  },

  // Üründen spesifik seçeneği kaldır (Remove specific option from product)
  async removeProductSpecificOption(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('product_specific_options')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing product specific option:', error);
      throw error;
    }
  },

  // Ürünün spesifik seçeneğini güncelle (Update product specific option)
  async updateProductSpecificOption(
    id: string,
    isRequired: boolean,
    isDefault: boolean
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('product_specific_options')
        .update({
          is_required: isRequired,
          is_default: isDefault,
        })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating product specific option:', error);
      throw error;
    }
  },

  // Kategoriye göre tüm seçenekleri getir (Get all options by category)
  async getCategoryOptions(categoryId: string): Promise<ProductOption[]> {
    try {
      const { data, error } = await supabase
        .from('product_options')
        .select('*')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching category options:', error);
      throw error;
    }
  },

  // Sipariş özelleştirmelerini kaydet (Save order customizations)
  async saveOrderCustomizations(
    orderId: string,
    productId: string,
    productName: string,
    selectedOptions: Array<{
      option_id: string;
      option_name: string;
      option_price: number;
    }>,
    specialInstructions?: string
  ): Promise<void> {
    try {
      // Seçilen her seçenek için kayıt oluştur
      const customizations = selectedOptions.map((opt) => ({
        order_id: orderId,
        product_id: productId,
        product_name: productName,
        option_id: opt.option_id,
        option_name: opt.option_name,
        option_price: opt.option_price,
        quantity: 1,
        special_instructions: specialInstructions,
      }));

      const { error } = await supabase
        .from('order_item_customizations')
        .insert(customizations);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving order customizations:', error);
      throw error;
    }
  },

  // Sipariş özelleştirmelerini getir (Get order customizations)
  async getOrderCustomizations(orderId: string): Promise<OrderItemCustomization[]> {
    try {
      const { data, error } = await supabase
        .from('order_item_customizations')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching order customizations:', error);
      throw error;
    }
  },

  // Yeni kategori oluştur (Create new category) - Admin only
  async createCategory(
    name: string,
    nameEn?: string,
    description?: string,
    displayOrder: number = 0
  ): Promise<ProductOptionCategory> {
    try {
      const { data, error } = await supabase
        .from('product_option_categories')
        .insert({
          name,
          name_en: nameEn,
          description,
          display_order: displayOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  },

  // Yeni seçenek oluştur (Create new option) - Admin only
  async createOption(
    categoryId: string,
    name: string,
    price: number,
    nameEn?: string,
    description?: string,
    displayOrder: number = 0
  ): Promise<ProductOption> {
    try {
      const { data, error } = await supabase
        .from('product_options')
        .insert({
          category_id: categoryId,
          name,
          name_en: nameEn,
          description,
          price,
          display_order: displayOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating option:', error);
      throw error;
    }
  },

  // Kategoriyi güncelle (Update category) - Admin only
  async updateCategory(
    id: string,
    updates: Partial<ProductOptionCategory>
  ): Promise<ProductOptionCategory> {
    try {
      const { data, error } = await supabase
        .from('product_option_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  },

  // Seçeneği güncelle (Update option) - Admin only
  async updateOption(
    id: string,
    updates: Partial<ProductOption>
  ): Promise<ProductOption> {
    try {
      const { data, error } = await supabase
        .from('product_options')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating option:', error);
      throw error;
    }
  },

  // Kategoriyi sil (Delete category) - Admin only
  async deleteCategory(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('product_option_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  },

  // Seçeneği sil (Delete option) - Admin only
  async deleteOption(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('product_options')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting option:', error);
      throw error;
    }
  },
};

