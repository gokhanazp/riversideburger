// Help & Support Screen - Yardım ve Destek Ekranı
// SSS ve iletişim bilgileri (FAQ and contact information)
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';

// SSS öğesi tipi (FAQ item type)
interface FAQItem {
  question: string;
  answer: string;
}

const HelpSupportScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // SSS listesi (FAQ list)
  const faqItems: FAQItem[] = i18n.language === 'tr' ? [
    {
      question: '🍔 Nasıl sipariş verebilirim?',
      answer: 'Ana sayfadan menüyü görüntüleyebilir, ürünleri sepete ekleyebilir ve ödeme adımlarını tamamlayarak sipariş verebilirsiniz.',
    },
    {
      question: '💳 Hangi ödeme yöntemlerini kabul ediyorsunuz?',
      answer: 'Kredi kartı, banka kartı ve kapıda nakit ödeme seçeneklerini kabul ediyoruz.',
    },
    {
      question: '🚚 Teslimat süresi ne kadar?',
      answer: 'Ortalama teslimat süremiz 30-45 dakikadır. Yoğun saatlerde bu süre uzayabilir.',
    },
    {
      question: '⭐ Puan sistemi nasıl çalışır?',
      answer: 'Her siparişinizden puan kazanırsınız. Kazandığınız puanları bir sonraki siparişinizde indirim olarak kullanabilirsiniz.',
    },
    {
      question: '📍 Teslimat bölgeleri nereler?',
      answer: 'Şu anda belirli bölgelere teslimat yapıyoruz. Adres eklerken teslimat yapıp yapmadığımızı kontrol edebilirsiniz.',
    },
    {
      question: '🔄 Siparişimi iptal edebilir miyim?',
      answer: 'Sipariş hazırlanmaya başlamadan önce iptal edebilirsiniz. Profil > Sipariş Geçmişi bölümünden iptal işlemini yapabilirsiniz.',
    },
    {
      question: '🎁 Kampanyalar nasıl kullanılır?',
      answer: 'Aktif kampanyalar ana sayfada görüntülenir. Sepet ekranında kampanya kodunu girebilir veya otomatik olarak uygulanmasını sağlayabilirsiniz.',
    },
    {
      question: '📱 Hesabımı nasıl silebilirim?',
      answer: 'Hesap silme talebi için destek ekibimizle iletişime geçmeniz gerekmektedir.',
    },
  ] : [
    {
      question: '🍔 How can I place an order?',
      answer: 'You can view the menu from the home page, add products to your cart, and complete the payment steps to place an order.',
    },
    {
      question: '💳 What payment methods do you accept?',
      answer: 'We accept credit cards, debit cards, and cash on delivery.',
    },
    {
      question: '🚚 How long is the delivery time?',
      answer: 'Our average delivery time is 30-45 minutes. This may be longer during peak hours.',
    },
    {
      question: '⭐ How does the points system work?',
      answer: 'You earn points from every order. You can use your earned points as a discount on your next order.',
    },
    {
      question: '📍 What are the delivery areas?',
      answer: 'We currently deliver to specific areas. You can check if we deliver to your area when adding an address.',
    },
    {
      question: '🔄 Can I cancel my order?',
      answer: 'You can cancel before your order starts being prepared. You can cancel from Profile > Order History.',
    },
    {
      question: '🎁 How do I use campaigns?',
      answer: 'Active campaigns are displayed on the home page. You can enter a campaign code on the cart screen or have it applied automatically.',
    },
    {
      question: '📱 How can I delete my account?',
      answer: 'To request account deletion, you need to contact our support team.',
    },
  ];

  // SSS öğesini aç/kapat (Toggle FAQ item)
  const toggleFAQ = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  // E-posta gönder (Send email)
  const sendEmail = (type: 'support' | 'privacy') => {
    const email = type === 'support' ? 'support@riversideburgers.com' : 'privacy@riversideburgers.com';
    const subject = type === 'support' 
      ? (i18n.language === 'tr' ? 'Destek Talebi' : 'Support Request')
      : (i18n.language === 'tr' ? 'Gizlilik Talebi' : 'Privacy Request');
    
    Linking.openURL(`mailto:${email}?subject=${subject}`).catch(() => {
      Alert.alert(
        i18n.language === 'tr' ? 'Hata' : 'Error',
        i18n.language === 'tr' 
          ? 'E-posta uygulaması açılamadı' 
          : 'Could not open email app'
      );
    });
  };

  // Telefon ara (Call phone)
  const callPhone = () => {
    Linking.openURL('tel:+905551234567').catch(() => {
      Alert.alert(
        i18n.language === 'tr' ? 'Hata' : 'Error',
        i18n.language === 'tr' 
          ? 'Telefon uygulaması açılamadı' 
          : 'Could not open phone app'
      );
    });
  };

  // WhatsApp aç (Open WhatsApp)
  const openWhatsApp = () => {
    Linking.openURL('https://wa.me/905551234567').catch(() => {
      Alert.alert(
        i18n.language === 'tr' ? 'Hata' : 'Error',
        i18n.language === 'tr' 
          ? 'WhatsApp açılamadı' 
          : 'Could not open WhatsApp'
      );
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {i18n.language === 'tr' ? 'Yardım & Destek' : 'Help & Support'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* İletişim Kartları (Contact Cards) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {i18n.language === 'tr' ? '📞 Bize Ulaşın' : '📞 Contact Us'}
          </Text>

          <View style={styles.contactGrid}>
            {/* E-posta (Email) */}
            <TouchableOpacity
              style={styles.contactCard}
              onPress={() => sendEmail('support')}
              activeOpacity={0.7}
            >
              <View style={[styles.contactIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="mail" size={28} color="#2196F3" />
              </View>
              <Text style={styles.contactTitle}>
                {i18n.language === 'tr' ? 'E-posta' : 'Email'}
              </Text>
              <Text style={styles.contactSubtitle}>support@riversideburgers.com</Text>
            </TouchableOpacity>

            {/* Telefon (Phone) */}
            <TouchableOpacity
              style={styles.contactCard}
              onPress={callPhone}
              activeOpacity={0.7}
            >
              <View style={[styles.contactIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="call" size={28} color="#4CAF50" />
              </View>
              <Text style={styles.contactTitle}>
                {i18n.language === 'tr' ? 'Telefon' : 'Phone'}
              </Text>
              <Text style={styles.contactSubtitle}>+90 555 123 45 67</Text>
            </TouchableOpacity>

            {/* WhatsApp */}
            <TouchableOpacity
              style={styles.contactCard}
              onPress={openWhatsApp}
              activeOpacity={0.7}
            >
              <View style={[styles.contactIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="logo-whatsapp" size={28} color="#25D366" />
              </View>
              <Text style={styles.contactTitle}>WhatsApp</Text>
              <Text style={styles.contactSubtitle}>+90 555 123 45 67</Text>
            </TouchableOpacity>

            {/* Çalışma Saatleri (Working Hours) */}
            <View style={[styles.contactCard, styles.infoCard]}>
              <View style={[styles.contactIcon, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="time" size={28} color="#FF9800" />
              </View>
              <Text style={styles.contactTitle}>
                {i18n.language === 'tr' ? 'Çalışma Saatleri' : 'Working Hours'}
              </Text>
              <Text style={styles.contactSubtitle}>
                {i18n.language === 'tr' ? 'Her gün 10:00 - 23:00' : 'Every day 10:00 - 23:00'}
              </Text>
            </View>
          </View>
        </View>

        {/* SSS (FAQ) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {i18n.language === 'tr' ? '❓ Sık Sorulan Sorular' : '❓ Frequently Asked Questions'}
          </Text>

          {faqItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.faqItem}
              onPress={() => toggleFAQ(index)}
              activeOpacity={0.7}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{item.question}</Text>
                <Ionicons
                  name={expandedIndex === index ? 'chevron-up' : 'chevron-down'}
                  size={24}
                  color={Colors.primary}
                />
              </View>
              {expandedIndex === index && (
                <Text style={styles.faqAnswer}>{item.answer}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Ek Bilgiler (Additional Info) */}
        <View style={styles.section}>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={24} color={Colors.primary} />
            <Text style={styles.infoText}>
              {i18n.language === 'tr'
                ? 'Sorununuz çözülmediyse lütfen yukarıdaki iletişim kanallarından bize ulaşın. Size en kısa sürede yardımcı olacağız.'
                : 'If your issue is not resolved, please contact us through the channels above. We will help you as soon as possible.'}
            </Text>
          </View>
        </View>

        {/* Footer boşluk (Footer spacing) */}
        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.primary,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  contactCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    ...Shadows.small,
  },
  infoCard: {
    opacity: 0.9,
  },
  contactIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  contactTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  contactSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  faqItem: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    ...Shadows.small,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginRight: Spacing.sm,
  },
  faqAnswer: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    lineHeight: 22,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    ...Shadows.small,
  },
  infoText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginLeft: Spacing.md,
    lineHeight: 22,
  },
});

export default HelpSupportScreen;

