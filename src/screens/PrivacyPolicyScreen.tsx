// Privacy Policy Screen - Gizlilik Politikası Ekranı
// Native ScrollView ile içerik gösterir (Shows content with native ScrollView)
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/theme';

const PrivacyPolicyScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();

  // Türkçe içerik (Turkish content)
  const contentTR = {
    title: 'Gizlilik Politikası',
    lastUpdated: 'Son Güncelleme: 10 Kasım 2024',
    sections: [
      {
        title: '1. Toplanan Bilgiler',
        content: 'Riverside Burgers olarak, kullanıcılarımızın gizliliğine önem veriyoruz. Mobil uygulamamız aracılığıyla aşağıdaki bilgileri topluyoruz:\n\n• Kişisel Bilgiler: Ad, soyad, e-posta adresi, telefon numarası\n• Teslimat Bilgileri: Adres, konum bilgileri\n• Ödeme Bilgileri: Kredi kartı bilgileri (güvenli ödeme sağlayıcıları aracılığıyla)\n• Sipariş Geçmişi: Geçmiş siparişleriniz ve tercihleriniz\n• Cihaz Bilgileri: IP adresi, cihaz tipi, işletim sistemi\n• Kullanım Verileri: Uygulama kullanım istatistikleri',
      },
      {
        title: '2. Bilgilerin Kullanım Amaçları',
        content: 'Topladığımız bilgileri şu amaçlarla kullanırız:\n\n• Sipariş işlemlerini gerçekleştirmek ve takip etmek\n• Hesap oluşturma ve yönetimi\n• Müşteri desteği sağlamak\n• Ödeme işlemlerini güvenli şekilde gerçekleştirmek\n• Uygulama performansını iyileştirmek\n• Kişiselleştirilmiş deneyim sunmak\n• Kampanya ve promosyonlar hakkında bilgilendirme (izninizle)\n• Yasal yükümlülükleri yerine getirmek',
      },
      {
        title: '3. Bilgi Paylaşımı',
        content: 'Kişisel bilgilerinizi asla satmayız. Ancak aşağıdaki durumlarda üçüncü taraflarla paylaşabiliriz:\n\n• Hizmet Sağlayıcılar: Ödeme işlemcileri, teslimat hizmetleri, bulut hizmetleri (Supabase), analitik hizmetler\n• Yasal Gereklilikler: Yasal yükümlülükler, mahkeme kararları, kamu güvenliği\n• İş Transferleri: Şirket birleşmeleri veya satışları durumunda',
      },
      {
        title: '4. Veri Güvenliği',
        content: 'Verilerinizin güvenliği bizim için önceliklidir:\n\n• SSL/TLS şifreleme kullanıyoruz\n• Güvenli veri tabanı (Supabase) kullanıyoruz\n• Düzenli güvenlik güncellemeleri yapıyoruz\n• Erişim kontrolü ve yetkilendirme sistemleri kullanıyoruz\n• Ödeme bilgileri PCI-DSS standartlarına uygun şekilde işlenir',
      },
      {
        title: '5. Kullanıcı Hakları',
        content: 'KVKK (Kişisel Verilerin Korunması Kanunu) ve GDPR kapsamında aşağıdaki haklara sahipsiniz:\n\n• Kişisel verilerinizin işlenip işlenmediğini öğrenme\n• İşlenmişse buna ilişkin bilgi talep etme\n• Verilerin işlenme amacını öğrenme\n• Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme\n• Verilerin eksik veya yanlış işlenmiş olması halinde düzeltilmesini isteme\n• Verilerin silinmesini veya yok edilmesini isteme',
      },
      {
        title: '6. Çerezler (Cookies)',
        content: 'Uygulamamız, kullanıcı deneyimini iyileştirmek için çerezler ve benzeri teknolojiler kullanır:\n\n• Oturum Çerezleri: Giriş durumunuzu korur\n• Tercih Çerezleri: Dil ve para birimi tercihlerinizi saklar\n• Analitik Çerezler: Uygulama kullanımını analiz eder',
      },
      {
        title: '7. Çocukların Gizliliği',
        content: 'Uygulamamız 13 yaşın altındaki çocuklara yönelik değildir. Bilerek 13 yaşın altındaki çocuklardan kişisel bilgi toplamıyoruz. Eğer bir ebeveyn veya vasi olarak çocuğunuzun bize kişisel bilgi verdiğini fark ederseniz, lütfen bizimle iletişime geçin.',
      },
      {
        title: '8. Veri Saklama Süresi',
        content: 'Kişisel verilerinizi yalnızca gerekli olduğu süre boyunca saklarız:\n\n• Aktif hesaplar: Hesap silinene kadar\n• Sipariş kayıtları: Yasal gereklilikler için 10 yıl\n• Pazarlama verileri: İzin iptal edilene kadar\n• Log kayıtları: 6 ay',
      },
      {
        title: '9. İletişim',
        content: 'Gizlilik politikamız hakkında sorularınız veya talepleriniz için bizimle iletişime geçebilirsiniz:\n\n📧 E-posta: privacy@riversideburgers.com\n📧 Destek: support@riversideburgers.com\n📱 Uygulama: Profil > Ayarlar > Yardım & Destek\n\nVeri Sorumlusu:\nRiverside Burgers\nTürkiye',
      },
      {
        title: '10. Değişiklikler',
        content: 'Bu gizlilik politikasını zaman zaman güncelleyebiliriz. Önemli değişiklikler olduğunda sizi uygulama içi bildirim veya e-posta yoluyla bilgilendireceğiz. Politikadaki değişiklikleri düzenli olarak gözden geçirmenizi öneririz.',
      },
      {
        title: '11. Onay',
        content: 'Uygulamamızı kullanarak, bu gizlilik politikasını okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan edersiniz.',
      },
    ],
  };

  // İngilizce içerik (English content)
  const contentEN = {
    title: 'Privacy Policy',
    lastUpdated: 'Last Updated: November 10, 2024',
    sections: [
      {
        title: '1. Information We Collect',
        content: 'At Riverside Burgers, we value the privacy of our users. Through our mobile application, we collect the following information:\n\n• Personal Information: Name, surname, email address, phone number\n• Delivery Information: Address, location information\n• Payment Information: Credit card information (through secure payment providers)\n• Order History: Your past orders and preferences\n• Device Information: IP address, device type, operating system\n• Usage Data: Application usage statistics',
      },
      {
        title: '2. How We Use Your Information',
        content: 'We use the collected information for the following purposes:\n\n• Process and track orders\n• Account creation and management\n• Provide customer support\n• Securely process payments\n• Improve application performance\n• Provide personalized experience\n• Send information about campaigns and promotions (with your consent)\n• Fulfill legal obligations',
      },
      {
        title: '3. Information Sharing',
        content: 'We never sell your personal information. However, we may share it with third parties in the following cases:\n\n• Service Providers: Payment processors, delivery services, cloud services (Supabase), analytics services\n• Legal Requirements: Legal obligations, court orders, public safety\n• Business Transfers: In case of company mergers or sales',
      },
      {
        title: '4. Data Security',
        content: 'The security of your data is our priority:\n\n• We use SSL/TLS encryption\n• We use secure database (Supabase)\n• We perform regular security updates\n• We use access control and authorization systems\n• Payment information is processed in compliance with PCI-DSS standards',
      },
      {
        title: '5. User Rights',
        content: 'Under KVKK (Personal Data Protection Law) and GDPR, you have the following rights:\n\n• Learn whether your personal data is being processed\n• Request information if it is being processed\n• Learn the purpose of data processing\n• Know the third parties to whom data is transferred domestically or abroad\n• Request correction if data is incomplete or incorrectly processed\n• Request deletion or destruction of data',
      },
      {
        title: '6. Cookies',
        content: 'Our application uses cookies and similar technologies to improve user experience:\n\n• Session Cookies: Maintain your login status\n• Preference Cookies: Store your language and currency preferences\n• Analytics Cookies: Analyze application usage',
      },
      {
        title: '7. Children\'s Privacy',
        content: 'Our application is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and become aware that your child has provided us with personal information, please contact us.',
      },
      {
        title: '8. Data Retention Period',
        content: 'We retain your personal data only for as long as necessary:\n\n• Active accounts: Until account deletion\n• Order records: 10 years for legal requirements\n• Marketing data: Until consent is withdrawn\n• Log records: 6 months',
      },
      {
        title: '9. Contact Us',
        content: 'If you have questions or requests regarding our privacy policy, please contact us:\n\n📧 Email: privacy@riversideburgers.com\n📧 Support: support@riversideburgers.com\n📱 App: Profile > Settings > Help & Support\n\nData Controller:\nRiverside Burgers\nTurkey',
      },
      {
        title: '10. Changes to This Policy',
        content: 'We may update this privacy policy from time to time. We will notify you of significant changes through in-app notifications or email. We encourage you to review this policy periodically.',
      },
      {
        title: '11. Consent',
        content: 'By using our application, you acknowledge that you have read, understood, and agree to this privacy policy.',
      },
    ],
  };

  const content = i18n.language === 'tr' ? contentTR : contentEN;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{content.title}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Başlık ve Son Güncelleme (Title and Last Updated) */}
        <View style={styles.titleSection}>
          <View style={styles.iconContainer}>
            <Ionicons name="shield-checkmark" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.lastUpdated}>{content.lastUpdated}</Text>
        </View>

        {/* İçerik Bölümleri (Content Sections) */}
        {content.sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2024 Riverside Burgers. {i18n.language === 'tr' ? 'Tüm hakları saklıdır.' : 'All rights reserved.'}
          </Text>
          <Text style={styles.footerEmoji}>🍔 {i18n.language === 'tr' ? 'Lezzet ve Gizlilik Bir Arada' : 'Great Taste & Privacy Together'} 🍔</Text>
        </View>

        {/* Boşluk (Spacing) */}
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
  titleSection: {
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.white,
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  lastUpdated: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  section: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.md,
  },
  sectionContent: {
    fontSize: FontSizes.md,
    color: Colors.text,
    lineHeight: 24,
  },
  footer: {
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  footerText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  footerEmoji: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: '600',
  },
});

export default PrivacyPolicyScreen;

