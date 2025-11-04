// Icon Picker Component - Icon Seçici Bileşeni
// Admin panelde kategori iconları seçmek için (For selecting category icons in admin panel)
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';

// Popüler icon listesi (Popular icon list)
const POPULAR_ICONS = [
  { name: 'fast-food-outline', label: 'Fast Food' },
  { name: 'restaurant-outline', label: 'Restaurant' },
  { name: 'pizza-outline', label: 'Pizza' },
  { name: 'cafe-outline', label: 'Cafe' },
  { name: 'beer-outline', label: 'Beer' },
  { name: 'wine-outline', label: 'Wine' },
  { name: 'ice-cream-outline', label: 'Ice Cream' },
  { name: 'leaf-outline', label: 'Leaf' },
  { name: 'fish-outline', label: 'Fish' },
  { name: 'nutrition-outline', label: 'Nutrition' },
  { name: 'egg-outline', label: 'Egg' },
  { name: 'flame-outline', label: 'Flame' },
  { name: 'water-outline', label: 'Water' },
  { name: 'sunny-outline', label: 'Sunny' },
  { name: 'moon-outline', label: 'Moon' },
  { name: 'star-outline', label: 'Star' },
  { name: 'heart-outline', label: 'Heart' },
  { name: 'gift-outline', label: 'Gift' },
  { name: 'cart-outline', label: 'Cart' },
  { name: 'basket-outline', label: 'Basket' },
  { name: 'bag-outline', label: 'Bag' },
  { name: 'pricetag-outline', label: 'Price Tag' },
  { name: 'ribbon-outline', label: 'Ribbon' },
  { name: 'trophy-outline', label: 'Trophy' },
  { name: 'medal-outline', label: 'Medal' },
  { name: 'sparkles-outline', label: 'Sparkles' },
  { name: 'flash-outline', label: 'Flash' },
  { name: 'thunderstorm-outline', label: 'Thunderstorm' },
  { name: 'rainy-outline', label: 'Rainy' },
  { name: 'cloudy-outline', label: 'Cloudy' },
];

interface IconPickerProps {
  selectedIcon: string;
  onSelectIcon: (icon: string) => void;
  label?: string;
}

const IconPicker: React.FC<IconPickerProps> = ({ selectedIcon, onSelectIcon, label }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Icon'ları filtrele (Filter icons)
  const filteredIcons = POPULAR_ICONS.filter((icon) =>
    icon.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    icon.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Icon seç (Select icon)
  const handleSelectIcon = (iconName: string) => {
    onSelectIcon(iconName);
    setModalVisible(false);
    setSearchQuery('');
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      {/* Seçili icon gösterimi (Selected icon display) */}
      <TouchableOpacity
        style={styles.selectedIconContainer}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <View style={styles.iconPreview}>
          <Ionicons name={selectedIcon as any} size={32} color={Colors.primary} />
        </View>
        <View style={styles.selectedIconInfo}>
          <Text style={styles.selectedIconName}>{selectedIcon}</Text>
          <Text style={styles.changeText}>Değiştirmek için tıklayın</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>

      {/* Icon seçim modalı (Icon selection modal) */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal başlığı (Modal header) */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Icon Seç</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {/* Arama kutusu (Search box) */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Icon ara..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Icon listesi (Icon list) */}
            <FlatList
              data={filteredIcons}
              keyExtractor={(item) => item.name}
              numColumns={4}
              contentContainerStyle={styles.iconList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.iconItem,
                    selectedIcon === item.name && styles.iconItemSelected,
                  ]}
                  onPress={() => handleSelectIcon(item.name)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.name as any}
                    size={28}
                    color={selectedIcon === item.name ? Colors.white : Colors.primary}
                  />
                  <Text
                    style={[
                      styles.iconLabel,
                      selectedIcon === item.name && styles.iconLabelSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color={Colors.textSecondary} />
                  <Text style={styles.emptyText}>Icon bulunamadı</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  selectedIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  iconPreview: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  selectedIconInfo: {
    flex: 1,
  },
  selectedIconName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  changeText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '80%',
    ...Shadows.large,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  iconList: {
    padding: Spacing.md,
  },
  iconItem: {
    flex: 1,
    aspectRatio: 1,
    margin: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconItemSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  iconLabel: {
    fontSize: FontSizes.xs,
    color: Colors.text,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  iconLabelSelected: {
    color: Colors.white,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
});

export default IconPicker;

