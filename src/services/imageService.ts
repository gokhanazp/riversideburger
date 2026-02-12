// Image Service - Resim yükleme ve boyutlandırma servisi
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../lib/supabase';

/**
 * Resmi boyutlandır ve optimize et (Resize and optimize image)
 * @param file - Yüklenecek dosya veya URI (File to upload or URI)
 * @param maxWidth - Maksimum genişlik (Maximum width)
 * @param maxHeight - Maksimum yükseklik (Maximum height)
 * @param quality - Kalite (0-1 arası) (Quality 0-1)
 * @returns Optimize edilmiş blob (Optimized blob)
 */
export const resizeImage = async (
  file: File | string,
  maxWidth: number = 1200,
  maxHeight: number = 800,
  quality: number = 0.8
): Promise<Blob> => {
  // Mobile implementation (Expo Image Manipulator)
  if (Platform.OS !== 'web') {
    if (typeof file !== 'string') {
      throw new Error('Mobile platformda dosya URI string olmalıdır');
    }

    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        file,
        [{ resize: { width: maxWidth } }], // Sadece genişliğe göre scale et, height otomatik ayarlanır
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
      );

      const response = await fetch(manipResult.uri);
      const blob = await response.blob();
      
      console.log('✅ Resim boyutlandırıldı (Mobile):', {
         originalUri: file,
         newUri: manipResult.uri,
         newSize: `${(blob.size / 1024).toFixed(2)} KB`,
         newDimensions: `${manipResult.width}x${manipResult.height}`,
      });

      return blob;
    } catch (error) {
       console.error('Mobile resize error:', error);
       throw new Error('Mobil resim işleme hatası');
    }
  }

  // Web implementation (Canvas)
  return new Promise((resolve, reject) => {
    if (typeof file === 'string') {
       reject(new Error('Web platformunda File nesnesi gereklidir'));
       return;
    }
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        // Canvas oluştur (Create canvas)
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Boyutları hesapla (Calculate dimensions)
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        // Canvas boyutlarını ayarla (Set canvas dimensions)
        canvas.width = width;
        canvas.height = height;

        // Resmi çiz (Draw image)
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context oluşturulamadı'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Blob'a çevir (Convert to blob)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log('✅ Resim boyutlandırıldı:', {
                originalSize: `${(file.size / 1024).toFixed(2)} KB`,
                newSize: `${(blob.size / 1024).toFixed(2)} KB`,
                originalDimensions: `${img.width}x${img.height}`,
                newDimensions: `${width}x${height}`,
              });
              resolve(blob);
            } else {
              reject(new Error('Blob oluşturulamadı'));
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Resim yüklenemedi'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Dosya okunamadı'));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Dosya boyutunu kontrol et (Check file size)
 * @param file - Kontrol edilecek dosya veya URI (File to check or URI)
 * @param maxSizeMB - Maksimum boyut (MB) (Maximum size in MB)
 * @returns Geçerli mi? (Is valid?)
 */
export const validateFileSize = (file: File | any, maxSizeMB: number = 5): boolean => {
  // File object on web has .size property
  if (Platform.OS === 'web' && file.size) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
  }
  return true; // Mobile assumption: usually handled by picker or checked after blob creation
};

/**
 * Dosya tipini kontrol et (Check file type)
 * @param file - Kontrol edilecek dosya veya URI (File to check)
 * @returns Geçerli mi? (Is valid?)
 */
export const validateFileType = (file: File | string): boolean => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (Platform.OS === 'web' && typeof file !== 'string') {
     return validTypes.includes(file.type);
  }
  // Mobile check extension from URI
  if (typeof file === 'string') {
      const ext = file.split('.').pop()?.toLowerCase();
      return ['jpg', 'jpeg', 'png', 'webp'].includes(ext || '');
  }
  return true;
};

/**
 * Ürün resmi yükle (Upload product image)
 * @param file - Yüklenecek dosya veya URI (File to upload or URI string)
 * @param productId - Ürün ID (Product ID)
 * @returns Resim URL'si (Image URL)
 */
export const uploadProductImage = async (
  file: File | string,
  productId?: string
): Promise<string> => {
  try {
    const isWeb = Platform.OS === 'web';
    console.log('📤 Ürün resmi yükleniyor...', {
      platform: Platform.OS,
      type: typeof file,
    });

    // Dosya tipini kontrol et (Check file type)
    if (!validateFileType(file)) {
      throw new Error('Geçersiz dosya tipi. Sadece JPEG, PNG ve WebP desteklenir.');
    }

    // Dosya boyutunu kontrol et (Check file size)
    if (isWeb && !validateFileSize(file, 5)) {
      throw new Error('Dosya boyutu 5MB\'dan büyük olamaz.');
    }

    // Resmi boyutlandır (Resize image)
    const resizedBlob = await resizeImage(file, 800, 800, 0.85);

    // Benzersiz dosya adı oluştur (Generate unique filename)
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    
    let fileExt = 'jpg';
    if (typeof file === 'string') {
        const ext = file.split('.').pop();
        if (ext) fileExt = ext;
    } else if (typeof File !== 'undefined' && file instanceof File) {
        fileExt = file.name.split('.').pop() || 'jpg';
    }
    
    const fileName = productId
      ? `${productId}_${timestamp}.${fileExt}`
      : `product_${timestamp}_${randomString}.${fileExt}`;

    // Supabase Storage'a yükle (Upload to Supabase Storage)
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, resizedBlob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('❌ Yükleme hatası:', error);
      throw error;
    }

    // Public URL al (Get public URL)
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(data.path);

    console.log('✅ Ürün resmi yüklendi:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error: any) {
    console.error('❌ Ürün resmi yükleme hatası:', error);
    throw error;
  }
};

/**
 * Banner resmi yükle (Upload banner image)
 * @param file - Yüklenecek dosya veya URI (File to upload or URI)
 * @param bannerId - Banner ID (Banner ID)
 * @returns Resim URL'si (Image URL)
 */
export const uploadBannerImage = async (
  file: File | string,
  bannerId?: string
): Promise<string> => {
  try {
    console.log('📤 Banner resmi yükleniyor...');

    // Dosya tipini kontrol et (Check file type)
    if (!validateFileType(file)) {
      throw new Error('Geçersiz dosya tipi. Sadece JPEG, PNG ve WebP desteklenir.');
    }

    // Resmi boyutlandır (Resize image - banner için daha büyük)
    const resizedBlob = await resizeImage(file, 1920, 1080, 0.85);

    // Benzersiz dosya adı oluştur (Generate unique filename)
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);

    let fileExt = 'jpg';
    if (typeof file === 'string') {
        const ext = file.split('.').pop();
        if (ext) fileExt = ext;
    } else if (typeof File !== 'undefined' && file instanceof File) {
        fileExt = file.name.split('.').pop() || 'jpg';
    }

    const fileName = bannerId
      ? `${bannerId}_${timestamp}.${fileExt}`
      : `banner_${timestamp}_${randomString}.${fileExt}`;

    // Supabase Storage'a yükle (Upload to Supabase Storage)
    const { data, error } = await supabase.storage
      .from('banner-images')
      .upload(fileName, resizedBlob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('❌ Yükleme hatası:', error);
      throw error;
    }

    // Public URL al (Get public URL)
    const { data: urlData } = supabase.storage
      .from('banner-images')
      .getPublicUrl(data.path);

    console.log('✅ Banner resmi yüklendi:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error: any) {
    console.error('❌ Banner resmi yükleme hatası:', error);
    throw error;
  }
};

/**
 * Resmi sil (Delete image)
 * @param imageUrl - Silinecek resim URL'si (Image URL to delete)
 * @param bucket - Bucket adı (Bucket name)
 */
export const deleteImage = async (
  imageUrl: string,
  bucket: 'product-images' | 'banner-images'
): Promise<void> => {
  try {
    // URL'den dosya yolunu çıkar (Extract file path from URL)
    const urlParts = imageUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];

    console.log('🗑️ Resim siliniyor:', fileName);

    const { error } = await supabase.storage.from(bucket).remove([fileName]);

    if (error) {
      console.error('❌ Silme hatası:', error);
      throw error;
    }

    console.log('✅ Resim silindi');
  } catch (error: any) {
    console.error('❌ Resim silme hatası:', error);
    throw error;
  }
};
