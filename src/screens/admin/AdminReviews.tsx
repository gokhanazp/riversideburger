import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  TextInput,
  Modal,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { Colors, Spacing, Shadows } from '../../constants/theme';
import {
  getAllReviews,
  getPendingReviews,
  approveReview,
  rejectReview,
} from '../../services/reviewService';
import { Review } from '../../types/database.types';
import { supabase } from '../../lib/supabase';
import { sendLocalNotification } from '../../services/notificationService';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

type FilterType = 'all' | 'pending' | 'approved' | 'rejected';

const AdminReviews = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<FilterType>('pending');

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [approveReviewId, setApproveReviewId] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    fetchReviews();
  }, [filter]);

  useEffect(() => {
    const channel = supabase.channel('admin-new-reviews').on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reviews' },
        async (payload) => {
          const { data: reviewData } = await supabase.from('reviews').select(`*, user:users(full_name), product:products(name)`).eq('id', payload.new.id).single();
          if (reviewData) {
            if (Platform.OS !== 'web') {
               await sendLocalNotification(t('admin.reviews.newReviewToast'), `${reviewData.user?.full_name} - ${reviewData.product?.name}`, { reviewId: reviewData.id }, 'orders');
            }
            Toast.show({ type: 'info', text1: t('admin.reviews.newReviewToast'), text2: `${reviewData.user?.full_name}` });
            fetchReviews();
          }
        }
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      let data: Review[];
      if (filter === 'pending') data = await getPendingReviews();
      else if (filter === 'all') data = await getAllReviews();
      else {
        const all = await getAllReviews();
        data = all.filter(r => filter === 'approved' ? r.is_approved : r.is_rejected);
      }
      setReviews(data);
    } catch (error) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.reviews.errorLoading') });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleApproveConfirm = async () => {
    if (!approveReviewId) return;
    try {
      await approveReview(approveReviewId);
      Toast.show({ type: 'success', text1: t('admin.success'), text2: t('admin.reviews.reviewApproved') });
      setApproveModalVisible(false);
      await fetchReviews();
    } catch {
      Toast.show({ type: 'error', text1: t('admin.error') });
    }
  };

  const handleRejectConfirm = async () => {
    if (!selectedReviewId || !rejectionReason.trim()) return;
    try {
      await rejectReview(selectedReviewId, rejectionReason);
      Toast.show({ type: 'success', text1: t('admin.success'), text2: t('admin.reviews.reviewRejected') });
      setRejectModalVisible(false);
      setRejectionReason('');
      fetchReviews();
    } catch {
      Toast.show({ type: 'error', text1: t('admin.error') });
    }
  };

  const renderStars = (rating: number) => (
      <View style={{flexDirection:'row', gap:2}}>
        {[1,2,3,4,5].map(s => <Ionicons key={s} name={s<=rating?'star':'star-outline'} size={14} color={s<=rating?'#FFD700':'#DDD'} />)}
      </View>
  );

  const renderItem = ({ item, index }: { item: Review, index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()} style={styles.card}>
      <View style={styles.cardHeader}>
          {item.product_id ? (
              <Image source={{ uri: item.product?.image_url }} style={styles.prodImg} />
          ) : (
              <View style={styles.restIcon}><Ionicons name="restaurant" size={24} color={Colors.primary} /></View>
          )}
          <View style={{flex:1}}>
              <Text style={styles.prodName}>{item.product_id ? item.product?.name : t('admin.reviews.restaurantReview')}</Text>
              <Text style={styles.userName}>{item.user?.full_name}</Text>
              <View style={{flexDirection:'row', alignItems:'center', gap:8, marginTop:2}}>
                  {renderStars(item.rating)}
                  <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
          </View>
          <View style={[styles.statusTag, item.is_approved ? styles.stApp : item.is_rejected ? styles.stRej : styles.stPen]}>
              <Text style={[styles.statusText, item.is_approved ? {color:'#4CAF50'} : item.is_rejected ? {color:'#F44336'} : {color:'#FF9800'}]}>
                  {item.is_approved ? t('admin.reviews.statusApproved') : item.is_rejected ? t('admin.reviews.statusRejected') : t('admin.reviews.statusPending')}
              </Text>
          </View>
      </View>
      
      {item.comment && <Text style={styles.comment}>{item.comment}</Text>}
      
      {!item.is_approved && !item.is_rejected && (
          <View style={styles.actions}>
              <TouchableOpacity style={[styles.actBtn, {backgroundColor:'#4CAF50'}]} onPress={() => { setApproveReviewId(item.id); setApproveModalVisible(true); }}>
                  <Ionicons name="checkmark" size={18} color="#FFF" />
                  <Text style={styles.actText}>{t('admin.reviews.buttonApprove')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actBtn, {backgroundColor:'#F44336'}]} onPress={() => { setSelectedReviewId(item.id); setRejectModalVisible(true); }}>
                  <Ionicons name="close" size={18} color="#FFF" />
                  <Text style={styles.actText}>{t('admin.reviews.buttonReject')}</Text>
              </TouchableOpacity>
          </View>
      )}
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a1a1a', '#333']} style={styles.header}>
        <View style={styles.breadcrumb}>
            <Text style={styles.breadText}>Admin</Text>
            <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
            <Text style={styles.breadText}>Panel</Text>
            <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
            <Text style={[styles.breadText, styles.breadActive]}>{t('admin.reviews.headerTitle')}</Text>
        </View>
        <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('admin.reviews.headerTitle')}</Text>
            <TouchableOpacity onPress={() => {setLoading(true); fetchReviews();}} style={styles.iconBtn}>
                <Ionicons name="refresh" size={20} color="#FFF" />
            </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.tabs}>
         {['pending', 'approved', 'rejected', 'all'].map((f) => (
             <TouchableOpacity key={f} onPress={() => setFilter(f as FilterType)} style={[styles.tab, filter===f && styles.tabActive]}>
                 <Text style={[styles.tabText, filter===f && styles.tabTextActive]}>
                     {f==='pending' ? t('admin.reviews.statusPending') : f==='approved' ? t('admin.reviews.statusApproved') : f==='rejected' ? t('admin.reviews.statusRejected') : t('admin.reviews.filterAll')}
                 </Text>
             </TouchableOpacity>
         ))}
      </View>

      {loading ? (
          <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
          <FlatList
            data={reviews}
            renderItem={renderItem}
            contentContainerStyle={{padding: 20}}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchReviews();}} />}
            ListEmptyComponent={<Text style={styles.empty}>{t('admin.reviews.noReviews')}</Text>}
          />
      )}

      {/* MODALS */}
      <Modal visible={approveModalVisible} transparent animationType="fade">
          <View style={styles.modalBg}>
              <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>{t('admin.reviews.approveTitle')}</Text>
                  <Text style={styles.modalDesc}>{t('admin.reviews.approveConfirm')}</Text>
                  <View style={styles.modalActs}>
                      <TouchableOpacity onPress={() => setApproveModalVisible(false)} style={styles.modalCancel}><Text style={styles.modalBtnText}>{t('common.cancel')}</Text></TouchableOpacity>
                      <TouchableOpacity onPress={handleApproveConfirm} style={styles.modalOk}><Text style={[styles.modalBtnText, {color:'#FFF'}]}>{t('admin.reviews.approve')}</Text></TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

      <Modal visible={rejectModalVisible} transparent animationType="fade">
          <View style={styles.modalBg}>
              <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>{t('admin.reviews.modalTitle')}</Text>
                  <TextInput style={styles.reasonInput} placeholder={t('admin.reviews.modalPlaceholder')} multiline value={rejectionReason} onChangeText={setRejectionReason} />
                  <View style={styles.modalActs}>
                      <TouchableOpacity onPress={() => setRejectModalVisible(false)} style={styles.modalCancel}><Text style={styles.modalBtnText}>{t('admin.reviews.modalCancel')}</Text></TouchableOpacity>
                      <TouchableOpacity onPress={handleRejectConfirm} style={[styles.modalOk, {backgroundColor:'#F44336'}]}><Text style={[styles.modalBtnText, {color:'#FFF'}]}>{t('admin.reviews.modalConfirm')}</Text></TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingTop: 50, paddingBottom: 25, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, ...Shadows.medium },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15, opacity: 0.8 },
  breadText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 },
  breadActive: { color: '#FFF', opacity: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', padding: 16, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE' },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: '#888' },
  tabTextActive: { color: '#FFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 16, ...Shadows.small },
  cardHeader: { flexDirection: 'row', gap: 12 },
  prodImg: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#EEE' },
  restIcon: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center' },
  prodName: { fontSize: 14, fontWeight: '800', color: Colors.text },
  userName: { fontSize: 12, color: '#666' },
  date: { fontSize: 10, color: '#999' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  stApp: { backgroundColor: '#E8F5E9' },
  stRej: { backgroundColor: '#FFEBEE' },
  stPen: { backgroundColor: '#FFF3E0' },
  statusText: { fontSize: 10, fontWeight: '800' },
  comment: { marginTop: 12, fontSize: 13, color: '#444', lineHeight: 20, backgroundColor:'#FAFAFA', padding:10, borderRadius:8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  actText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  empty: { textAlign: 'center', color: '#AAA', marginTop: 40 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  modalDesc: { color: '#666', marginBottom: 20 },
  modalActs: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 16 },
  modalOk: { backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  modalBtnText: { fontWeight: '700', color: '#666' },
  reasonInput: { backgroundColor: '#F9F9F9', borderRadius: 12, padding: 12, height: 100, textAlignVertical: 'top', marginBottom: 20 },
});

export default AdminReviews;
