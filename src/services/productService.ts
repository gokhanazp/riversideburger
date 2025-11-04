import { supabase } from '../lib/supabase';
import { Product, Category } from '../types/database.types';

// Tüm ürünleri getir (Get all products)
export const getProducts = async (): Promise<Product[]> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Get products error:', error);
    throw error;
  }
};

// Kategoriye göre ürünleri getir (Get products by category)
export const getProductsByCategory = async (categoryId: string): Promise<Product[]> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Get products by category error:', error);
    throw error;
  }
};

// Tek ürün getir (Get single product)
export const getProduct = async (id: string): Promise<Product | null> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Get product error:', error);
    return null;
  }
};

// Ürün oluştur (Create product) - ADMIN
export const createProduct = async (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select('*, category:categories(*)')
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Create product error:', error);
    throw error;
  }
};

// Ürün güncelle (Update product) - ADMIN
export const updateProduct = async (
  id: string,
  updates: Partial<Omit<Product, 'id' | 'created_at'>>
): Promise<Product> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, category:categories(*)')
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Update product error:', error);
    throw error;
  }
};

// Ürün sil (Delete product) - ADMIN
export const deleteProduct = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error: any) {
    console.error('Delete product error:', error);
    throw error;
  }
};

// Ürün aktif/pasif yap (Toggle product active status) - ADMIN
export const toggleProductActive = async (id: string, isActive: boolean): Promise<Product> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, category:categories(*)')
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Toggle product active error:', error);
    throw error;
  }
};

// Ürün ara (Search products)
export const searchProducts = async (query: string): Promise<Product[]> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Search products error:', error);
    throw error;
  }
};

// Tüm kategorileri getir (Get all categories)
// Yeni menu_categories tablosundan çeker (Fetches from new menu_categories table)
export const getCategories = async (): Promise<Category[]> => {
  try {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    // menu_categories formatını Category formatına çevir (Convert menu_categories format to Category format)
    const categories: Category[] = (data || []).map((cat: any) => ({
      id: cat.id,
      name: cat.name_en, // Varsayılan olarak İngilizce (Default to English)
      name_tr: cat.name_tr,
      name_en: cat.name_en,
      icon: cat.icon,
      order: cat.display_order,
      is_active: cat.is_active,
    }));

    return categories;
  } catch (error: any) {
    console.error('Get categories error:', error);
    throw error;
  }
};

// Kategori oluştur (Create category) - ADMIN
export const createCategory = async (category: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert(category)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Create category error:', error);
    throw error;
  }
};

// Kategori güncelle (Update category) - ADMIN
export const updateCategory = async (
  id: string,
  updates: Partial<Omit<Category, 'id' | 'created_at'>>
): Promise<Category> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Update category error:', error);
    throw error;
  }
};

// Kategori sil (Delete category) - ADMIN
export const deleteCategory = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error: any) {
    console.error('Delete category error:', error);
    throw error;
  }
};

