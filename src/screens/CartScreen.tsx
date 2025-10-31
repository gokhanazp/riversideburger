import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { CartItem } from '../types';
import Toast from 'react-native-toast-message';
import ConfirmModal from '../components/ConfirmModal';

// Sepet ekranı (Cart screen)
const CartScreen = ({ navigation }: any) => {
  const { items, updateQuantity, removeItem, getTotalPrice, clearCart } = useCartStore();
  const { isAuthenticated } = useAuthStore();

  // Modal state'leri (Modal states)
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

  // Sipariş onaylama işlevi (Order confirmation handler)
  const handleCheckout = () => {
    if (items.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Sepet Boş',
        text2: 'Lütfen sepete ürün ekleyin',
      });
      return;
    }

    // Giriş kontrolü (Check if user is authenticated)
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    // Sipariş onay modal'ını göster (Show checkout confirmation modal)
    setShowCheckoutModal(true);
  };

  // Giriş modal onayı (Login modal confirm)
  const handleLoginConfirm = () => {
    setShowLoginModal(false);
    navigation.navigate('Login');
  };

  // Sipariş onayı (Checkout confirm)
  const handleCheckoutConfirm = () => {
    setShowCheckoutModal(false);
    // Burada sipariş API'sine gönderilir (Order would be sent to API here)
    clearCart();
    Toast.show({
      type: 'success',
      text1: '🎉 Sipariş Alındı!',
      text2: 'Siparişiniz başarıyla oluşturuldu',
    });
  };

  // Ürün silme onayı (Item removal confirmation)
  const handleRemoveItem = (itemId: string, itemName: string) => {
    setItemToDelete({ id: itemId, name: itemName });
    setShowDeleteModal(true);
  };

  // Silme onayı (Delete confirm)
  const handleDeleteConfirm = () => {
    if (itemToDelete) {
      removeItem(itemToDelete.id);
      Toast.show({
        type: 'success',
        text1: '🗑️ Ürün Silindi',
        text2: `${itemToDelete.name} sepetten çıkarıldı`,
      });
    }
    setShowDeleteModal(false);
    setItemToDelete(null);
  };

  // Sepet öğesi kartı componenti (Cart item card component)
  const CartItemCard = ({ item }: { item: CartItem }) => (
    <View style={styles.cartCard}>
      <Image source={{ uri: item.image }} style={styles.cartImage} />
      <View style={styles.cartInfo}>
        <Text style={styles.cartName}>{item.name}</Text>
        <Text style={styles.cartPrice}>₺{item.price.toFixed(2)}</Text>
        <View style={styles.quantityContainer}>
          {/* Azalt butonu (Decrease button) */}
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => updateQuantity(item.id, item.quantity - 1)}
            activeOpacity={0.7}
          >
            <Text style={styles.quantityButtonText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.quantityText}>{item.quantity}</Text>
          {/* Artır butonu (Increase button) */}
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => updateQuantity(item.id, item.quantity + 1)}
            activeOpacity={0.7}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* Sil butonu (Delete button) */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleRemoveItem(item.id, item.name)}
        activeOpacity={0.7}
      >
        <Text style={styles.deleteButtonText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  // Boş sepet görünümü (Empty cart view)
  const EmptyCart = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🛒</Text>
      <Text style={styles.emptyTitle}>Sepetiniz Boş</Text>
      <Text style={styles.emptySubtitle}>Menüden ürün ekleyerek başlayın</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {items.length === 0 ? (
        <EmptyCart />
      ) : (
        <>
          {/* Sepet listesi (Cart list) */}
          <FlatList
            data={items}
            renderItem={({ item }) => <CartItemCard item={item} />}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.cartList}
            showsVerticalScrollIndicator={false}
          />

          {/* Alt özet ve ödeme bölümü (Bottom summary and checkout section) */}
          <View style={styles.footer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ara Toplam:</Text>
              <Text style={styles.summaryValue}>₺{getTotalPrice().toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Servis Ücreti:</Text>
              <Text style={styles.summaryValue}>₺0.00</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Toplam:</Text>
              <Text style={styles.totalValue}>₺{getTotalPrice().toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              style={styles.checkoutButton}
              onPress={handleCheckout}
              activeOpacity={0.8}
            >
              <Text style={styles.checkoutButtonText}>Siparişi Onayla</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Giriş gerekli modal (Login required modal) */}
      <ConfirmModal
        visible={showLoginModal}
        title="Giriş Gerekli"
        message="Sipariş vermek için giriş yapmanız gerekiyor."
        confirmText="Giriş Yap"
        cancelText="İptal"
        onConfirm={handleLoginConfirm}
        onCancel={() => setShowLoginModal(false)}
        type="default"
      />

      {/* Sipariş onay modal (Checkout confirmation modal) */}
      <ConfirmModal
        visible={showCheckoutModal}
        title="Sipariş Onayı"
        message={`Toplam: ₺${getTotalPrice().toFixed(2)}\n\nSiparişinizi onaylıyor musunuz?`}
        confirmText="Onayla"
        cancelText="İptal"
        onConfirm={handleCheckoutConfirm}
        onCancel={() => setShowCheckoutModal(false)}
        type="success"
      />

      {/* Ürün silme modal (Delete item modal) */}
      <ConfirmModal
        visible={showDeleteModal}
        title="Ürünü Sil"
        message={`${itemToDelete?.name || 'Bu ürün'} sepetten çıkarılsın mı?`}
        confirmText="Sil"
        cancelText="İptal"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setShowDeleteModal(false);
          setItemToDelete(null);
        }}
        type="danger"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  cartList: {
    padding: Spacing.md,
  },
  cartCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    ...Shadows.small,
  },
  cartImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
  },
  cartInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: 'space-between',
  },
  cartName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  cartPrice: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  quantityText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginHorizontal: Spacing.md,
    minWidth: 30,
    textAlign: 'center',
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.sm,
  },
  deleteButtonText: {
    fontSize: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadows.large,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  totalRow: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  totalValue: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  checkoutButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  checkoutButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.white,
  },
});

export default CartScreen;

