// Review Order Screen - Sipariş Değerlendirme Ekranı
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Colors, Spacing } from '../constants/theme';
import { getReviewableProducts, createReview } from '../services/reviewService';

interface ReviewableProduct {
  id: string;
  name: string;
  image_url: string;
  order_id: string;
}

interface ProductReview {
  product_id: string;
  rating: number;
  comment: string;
}

const ReviewOrderScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { orderId } = route.params as { orderId: string };

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<ReviewableProduct[]>([]);
  const [reviews, setReviews] = useState<Map<string, ProductReview>>(new Map());

  useEffect(() => {
    fetchReviewableProducts();
  }, [orderId]);

  const fetchReviewableProducts = async () => {
    try {
      setLoading(true);
      const data = await getReviewableProducts(orderId);
      setProducts(data);

      // Her ürün için varsayılan değerlendirme oluştur (Create default review for each product)
      const initialReviews = new Map<string, ProductReview>();
      data.forEach((product: ReviewableProduct) => {
        initialReviews.set(product.id, {
          product_id: product.id,
          rating: 0,
          comment: '',
        });
      });
      setReviews(initialReviews);
    } catch (error: any) {
      console.error('Fetch reviewable products error:', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Ürünler yüklenirken bir hata oluştu',
      });
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Yıldız seçimi (Star selection)
  const handleRatingChange = (productId: string, rating: number) => {
    const currentReview = reviews.get(productId);
    if (currentReview) {
      const updatedReview = { ...currentReview, rating };
      setReviews(new Map(reviews.set(productId, updatedReview)));
    }
  };

  // Yorum değişikliği (Comment change)
  const handleCommentChange = (productId: string, comment: string) => {
    const currentReview = reviews.get(productId);
    if (currentReview) {
      const updatedReview = { ...currentReview, comment };
      setReviews(new Map(reviews.set(productId, updatedReview)));
    }
  };

  // Değerlendirmeleri gönder (Submit reviews)
  const handleSubmit = async () => {
    try {
      // En az bir ürün için puan verilmiş mi kontrol et (Check if at least one product has rating)
      const hasAnyRating = Array.from(reviews.values()).some(review => review.rating > 0);
      
      if (!hasAnyRating) {
        Alert.alert('Uyarı', 'Lütfen en az bir ürün için puan verin.');
        return;
      }

      setSubmitting(true);

      // Sadece puan verilmiş ürünleri gönder (Submit only rated products)
      const reviewsToSubmit = Array.from(reviews.values()).filter(review => review.rating > 0);

      for (const review of reviewsToSubmit) {
        await createReview(
          orderId,
          review.product_id,
          review.rating,
          review.comment || undefined
        );
      }

      Toast.show({
        type: 'success',
        text1: 'Başarılı!',
        text2: 'Değerlendirmeniz alındı. Admin onayından sonra yayınlanacak.',
      });

      navigation.goBack();
    } catch (error: any) {
      console.error('Submit reviews error:', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: error.message || 'Değerlendirme gönderilemedi',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Yıldız render (Render stars)
  const renderStars = (productId: string, currentRating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => handleRatingChange(productId, star)}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= currentRating ? 'star' : 'star-outline'}
              size={36}
              color={star <= currentRating ? '#FFD700' : '#CCC'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="checkmark-circle-outline" size={80} color="#CCC" />
        <Text style={styles.emptyTitle}>Tüm Ürünler Değerlendirildi</Text>
        <Text style={styles.emptyText}>Bu siparişteki tüm ürünleri zaten değerlendirdiniz.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIconButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Siparişi Değerlendir</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Açıklama (Description) */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>
              Değerlendirmeniz admin onayından sonra yayınlanacaktır.
            </Text>
          </View>

          {/* Ürünler (Products) */}
          {products.map((product) => {
            const review = reviews.get(product.id);
            if (!review) return null;

            return (
              <View key={product.id} style={styles.productCard}>
                {/* Ürün Bilgisi (Product Info) */}
                <View style={styles.productHeader}>
                  <Image source={{ uri: product.image_url }} style={styles.productImage} />
                  <Text style={styles.productName}>{product.name}</Text>
                </View>

                {/* Yıldızlar (Stars) */}
                <View style={styles.ratingSection}>
                  <Text style={styles.ratingLabel}>Puanınız:</Text>
                  {renderStars(product.id, review.rating)}
                  {review.rating > 0 && (
                    <Text style={styles.ratingText}>
                      {review.rating === 1 && '😞 Çok Kötü'}
                      {review.rating === 2 && '😕 Kötü'}
                      {review.rating === 3 && '😐 Orta'}
                      {review.rating === 4 && '😊 İyi'}
                      {review.rating === 5 && '😍 Mükemmel'}
                    </Text>
                  )}
                </View>

                {/* Yorum (Comment) */}
                {review.rating > 0 && (
                  <View style={styles.commentSection}>
                    <Text style={styles.commentLabel}>Yorumunuz (Opsiyonel):</Text>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Ürün hakkında düşüncelerinizi paylaşın..."
                      placeholderTextColor="#999"
                      multiline
                      numberOfLines={4}
                      value={review.comment}
                      onChangeText={(text) => handleCommentChange(product.id, text)}
                      maxLength={500}
                    />
                    <Text style={styles.characterCount}>
                      {review.comment.length}/500
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          {/* Gönder Butonu (Submit Button) */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.submitButtonText}>Değerlendirmeyi Gönder</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backIconButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
    color: '#666',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '10',
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.md,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  productCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: 12,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  productName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  ratingSection: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: Spacing.sm,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: Spacing.sm,
  },
  commentSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: Spacing.sm,
  },
  commentInput: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: Spacing.md,
    fontSize: 14,
    color: '#333',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
});

export default ReviewOrderScreen;

