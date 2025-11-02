// Ürün özelleştirme tipleri (Product customization types)

// Seçenek kategorisi (Option category)
export interface ProductOptionCategory {
  id: string;
  name: string;
  name_en?: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Ürün seçeneği (Product option)
export interface ProductOption {
  id: string;
  category_id: string;
  name: string;
  name_en?: string;
  description?: string;
  price: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// Ürün için mevcut seçenekler (Available options for product)
export interface ProductAvailableOption {
  id: string;
  product_id: string;
  category_id: string;
  is_required: boolean;
  max_selections?: number;
  created_at: string;
}

// Sipariş ürün özelleştirmesi (Order item customization)
export interface OrderItemCustomization {
  id: string;
  order_id: string;
  product_id?: string;
  product_name: string;
  option_id?: string;
  option_name: string;
  option_price: number;
  quantity: number;
  special_instructions?: string;
  created_at: string;
}

// Kategori ile seçenekleri (Category with options)
export interface CategoryWithOptions {
  category: ProductOptionCategory;
  options: ProductOption[];
  is_required: boolean;
  max_selections?: number;
}

// Seçilen özelleştirme (Selected customization)
export interface SelectedCustomization {
  option: ProductOption;
  category: ProductOptionCategory;
}

// Özel notlar (Special instructions)
export interface SpecialInstructions {
  text: string;
}

// Özelleştirme özeti (Customization summary)
export interface CustomizationSummary {
  selectedOptions: SelectedCustomization[];
  specialInstructions?: string;
  totalExtraPrice: number;
}

