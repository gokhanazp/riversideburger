// Navigation ref — ekranlar dışından (hook/servis) navigasyon için.
// Ayrı dosyada tutulur ki AppNavigator ile döngüsel import oluşmasın.
import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
