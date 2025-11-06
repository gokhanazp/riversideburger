// Admin Reviews Screen - Admin Yorum Yönetimi Ekranı
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { Colors, Spacing } from '../../constants/theme';
import {
  getAllReviews,
  getPendingReviews,
  approveReview,
  rejectReview,
} from '../../services/reviewService';
import { Review } from '../../types/database.types';

type FilterType = 'all' | 'pending' | 'approved' | 'rejected';

const AdminReviews = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<FilterType>('pending');
  
  // Reddetme modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchReviews();
  }, [filter]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      let data: Review[];

      if (filter === 'pending') {
        data = await getPendingReviews();
      } else if (filter === 'all') {
        data = await getAllReviews();
      } else {
        // approved veya rejected için filtreleme
        const allData = await getAllReviews();
        data = allData.filter((review) => {
          if (filter === 'approved') return review.is_approved;
          if (filter === 'rejected') return review.is_rejected;
          return true;
        });
      }

      setReviews(data);
    } catch (error: any) {
      console.error('Fetch reviews error:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: t('admin.reviews.errorLoading'),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReviews();
  };

  const handleApprove = async (reviewId: string) => {
    console.log('🔘 handleApprove called, showing Alert...');
    Alert.alert(
      t('admin.reviews.approveTitle'),
      t('admin.reviews.approveConfirm'),
      [
        {
          text: t('admin.reviews.approve'),
          onPress: () => {
            console.log('✅ Approve button pressed in Alert');
            performApproval(reviewId);
          },
        },
        {
          text: t('admin.categories.cancel'),
          style: 'cancel',
          onPress: () => console.log('❌ Cancel button pressed in Alert')
        },
      ]
    );
  };

  const performApproval = async (reviewId: string) => {
    try {
      console.log('🔄 Starting approval for review:', reviewId);
      await approveReview(reviewId);
      console.log('✅ Approval successful, showing toast...');
      Toast.show({
        type: 'success',
        text1: t('admin.reviews.success'),
        text2: t('admin.reviews.reviewApproved'),
      });
      console.log('🔄 Refreshing reviews list...');
      await fetchReviews();
      console.log('✅ Reviews list refreshed');
    } catch (error: any) {
      console.error('❌ Error in performApproval:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: error.message || t('admin.reviews.errorApproving'),
      });
    }
  };

  const handleRejectPress = (reviewId: string) => {
    setSelectedReviewId(reviewId);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedReviewId) return;

    if (!rejectionReason.trim()) {
      Alert.alert(t('admin.error'), t('admin.reviews.rejectReasonRequired'));
      return;
    }

    try {
      await rejectReview(selectedReviewId, rejectionReason);
      Toast.show({
        type: 'success',
        text1: t('admin.reviews.success'),
        text2: t('admin.reviews.reviewRejected'),
      });
      setRejectModalVisible(false);
      setSelectedReviewId(null);
      setRejectionReason('');
      fetchReviews();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: error.message || t('admin.reviews.errorRejecting'),
      });
    }
  };

  // Yıldızları render et (Render stars)
  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={16}
            color={star <= rating ? '#FFD700' : '#CCC'}
          />
        ))}
      </View>
    );
  };

  // Durum badge'i (Status badge)
  const renderStatusBadge = (review: Review) => {
    if (review.is_approved) {
      return (
        <View style={[styles.statusBadge, styles.approvedBadge]}>
          <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
          <Text style={styles.approvedText}>{t('admin.reviews.statusApproved')}</Text>
        </View>
      );
    }
    if (review.is_rejected) {
      return (
        <View style={[styles.statusBadge, styles.rejectedBadge]}>
          <Ionicons name="close-circle" size={14} color="#F44336" />
          <Text style={styles.rejectedText}>{t('admin.reviews.statusRejected')}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusBadge, styles.pendingBadge]}>
        <Ionicons name="time-outline" size={14} color="#FF9800" />
        <Text style={styles.pendingText}>{t('admin.reviews.statusPending')}</Text>
      </View>
    );
  };

  const renderReviewItem = ({ item }: { item: Review }) => (
    <View style={styles.reviewCard}>
      {/* Header - Ürün veya Restoran ve Kullanıcı Bilgisi */}
      <View style={styles.reviewHeader}>
        {item.product_id ? (
          // Ürün yorumu (Product review)
          <>
            <Image
              source={{ uri: item.product?.image_url }}
              style={styles.productImage}
            />
            <View style={styles.headerInfo}>
              <Text style={styles.productName}>{item.product?.name}</Text>
              <Text style={styles.userName}>
                {item.user?.full_name || item.user?.email}
              </Text>
              <Text style={styles.dateText}>
                {new Date(item.created_at).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </>
        ) : (
          // Restoran yorumu (Restaurant review)
          <>
            <View style={styles.restaurantIconContainer}>
              <Ionicons name="restaurant" size={32} color={Colors.primary} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.productName}>{t('admin.reviews.restaurantReview')}</Text>
              <Text style={styles.userName}>
                {item.user?.full_name || item.user?.email}
              </Text>
              <Text style={styles.dateText}>
                {new Date(item.created_at).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </>
        )}
        {renderStatusBadge(item)}
      </View>

      {/* Rating */}
      <View style={styles.ratingSection}>
        {renderStars(item.rating)}
        <Text style={styles.ratingText}>
          {item.rating === 1 && t('admin.reviews.rating1')}
          {item.rating === 2 && t('admin.reviews.rating2')}
          {item.rating === 3 && t('admin.reviews.rating3')}
          {item.rating === 4 && t('admin.reviews.rating4')}
          {item.rating === 5 && t('admin.reviews.rating5')}
        </Text>
      </View>

      {/* Yorum */}
      {item.comment && (
        <View style={styles.commentSection}>
          <Text style={styles.commentText}>{item.comment}</Text>
        </View>
      )}

      {/* Red Nedeni (Rejection Reason) */}
      {item.is_rejected && item.rejection_reason && (
        <View style={styles.rejectionReasonBox}>
          <Text style={styles.rejectionReasonLabel}>{t('admin.reviews.rejectionReasonLabel')}</Text>
          <Text style={styles.rejectionReasonText}>{item.rejection_reason}</Text>
        </View>
      )}

      {/* Aksiyon Butonları (Action Buttons) - Sadece pending için */}
      {!item.is_approved && !item.is_rejected && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => {
              console.log('🔘 Approve button clicked for review:', item.id);
              handleApprove(item.id);
            }}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            <Text style={styles.actionButtonText}>{t('admin.reviews.buttonApprove')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleRejectPress(item.id)}
          >
            <Ionicons name="close-circle" size={20} color="#FFF" />
            <Text style={styles.actionButtonText}>{t('admin.reviews.buttonReject')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.reviews.headerTitle')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'pending' && styles.filterTabActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            {t('admin.reviews.filterPending')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'approved' && styles.filterTabActive]}
          onPress={() => setFilter('approved')}
        >
          <Text style={[styles.filterText, filter === 'approved' && styles.filterTextActive]}>
            {t('admin.reviews.filterApproved')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'rejected' && styles.filterTabActive]}
          onPress={() => setFilter('rejected')}
        >
          <Text style={[styles.filterText, filter === 'rejected' && styles.filterTextActive]}>
            {t('admin.reviews.filterRejected')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            {t('admin.reviews.filterAll')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Reviews List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t('admin.reviews.loading')}</Text>
        </View>
      ) : reviews.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="chatbubbles-outline" size={80} color="#CCC" />
          <Text style={styles.emptyTitle}>{t('admin.reviews.emptyTitle')}</Text>
          <Text style={styles.emptyText}>
            {filter === 'pending' && t('admin.reviews.emptyPending')}
            {filter === 'approved' && t('admin.reviews.emptyApproved')}
            {filter === 'rejected' && t('admin.reviews.emptyRejected')}
            {filter === 'all' && t('admin.reviews.emptyAll')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={reviews}
          renderItem={renderReviewItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      {/* Reddetme Modal (Rejection Modal) */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('admin.reviews.modalTitle')}</Text>
            <Text style={styles.modalDescription}>
              {t('admin.reviews.modalDescription')}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('admin.reviews.modalPlaceholder')}
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              maxLength={200}
            />
            <Text style={styles.characterCount}>{rejectionReason.length}/200</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>{t('admin.reviews.modalCancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleRejectConfirm}
              >
                <Text style={styles.modalConfirmText}>{t('admin.reviews.modalConfirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    backgroundColor: Colors.primary,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  filterTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#FFF',
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
  },
  listContent: {
    padding: Spacing.md,
  },
  reviewCard: {
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
  reviewHeader: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    gap: 12,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  restaurantIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userName: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 11,
    color: '#999',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  pendingBadge: {
    backgroundColor: '#FF9800' + '20',
  },
  approvedBadge: {
    backgroundColor: '#4CAF50' + '20',
  },
  rejectedBadge: {
    backgroundColor: '#F44336' + '20',
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF9800',
  },
  approvedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4CAF50',
  },
  rejectedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F44336',
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  commentSection: {
    backgroundColor: '#F9F9F9',
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.sm,
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  rejectionReasonBox: {
    backgroundColor: '#FFF3E0',
    padding: Spacing.md,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
    marginBottom: Spacing.sm,
  },
  rejectionReasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800',
    marginBottom: 4,
  },
  rejectionReasonText: {
    fontSize: 13,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: Spacing.sm,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: Spacing.md,
  },
  modalInput: {
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
    marginBottom: Spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#E0E0E0',
  },
  modalConfirmButton: {
    backgroundColor: '#F44336',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
});

export default AdminReviews;

