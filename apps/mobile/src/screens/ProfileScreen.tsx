import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Shadows, Spacing, BorderRadius } from '../constants';

export default function ProfileScreen() {
  const [notifications, setNotifications] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(true);
  
  const headerFade = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.stagger(100, cardAnims.map(anim =>
      Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true })
    )).start();
  }, []);

  const roleLabels: Record<string, string> = {
    owner: 'Sahip',
    admin: 'Yönetici',
    office: 'Ofis',
    worker: 'Usta',
    member: 'Üye',
  };

  const mockUser = {
    name: 'Mehmet Yılmaz',
    email: 'mehmet@renkflow.com',
    role: 'admin',
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        style={styles.header}
      >
        <Animated.View style={[styles.avatarContainer, { opacity: headerFade }]}>
          <LinearGradient
            colors={['#fff', 'rgba(255,255,255,0.8)']}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {mockUser.name.charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
          
          <Text style={styles.name}>{mockUser.name}</Text>
          <Text style={styles.email}>{mockUser.email}</Text>
          
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={14} color={Colors.primary} />
            <Text style={styles.roleText}>{roleLabels[mockUser.role]}</Text>
          </View>
        </Animated.View>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Stats */}
        <Animated.View style={[styles.statsContainer, {
          opacity: cardAnims[0],
          transform: [{ translateY: cardAnims[0].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }]}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>24</Text>
            <Text style={styles.statLabel}>Sipariş</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>5</Text>
            <Text style={styles.statLabel}>Bekleyen</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>19</Text>
            <Text style={styles.statLabel}>Tamamlanan</Text>
          </View>
        </Animated.View>

        {/* Settings */}
        <Animated.View style={[styles.section, {
          opacity: cardAnims[1],
          transform: [{ translateY: cardAnims[1].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }]}>
          <Text style={styles.sectionTitle}>Ayarlar</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.info + '20' }]}>
                <Ionicons name="notifications-outline" size={20} color={Colors.info} />
              </View>
              <View>
                <Text style={styles.settingText}>Bildirimler</Text>
                <Text style={styles.settingSubtext}>Sipariş güncellemelerini al</Text>
              </View>
            </View>
            <Switch
              value={notifications}
              onValueChange={(value) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setNotifications(value);
              }}
              trackColor={{ false: Colors.surface, true: Colors.primary }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.accent + '20' }]}>
                <Ionicons name="moon-outline" size={20} color={Colors.accent} />
              </View>
              <View>
                <Text style={styles.settingText}>Karanlık Mod</Text>
                <Text style={styles.settingSubtext}>Göz yormayan tema</Text>
              </View>
            </View>
            <Switch
              value={darkMode}
              onValueChange={(value) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDarkMode(value);
              }}
              trackColor={{ false: Colors.surface, true: Colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </Animated.View>

        {/* Actions */}
        <Animated.View style={[styles.section, {
          opacity: cardAnims[2],
          transform: [{ translateY: cardAnims[2].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }]}>
          <Text style={styles.sectionTitle}>Hesap</Text>
          
          <TouchableOpacity 
            style={styles.actionItem}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.success + '20' }]}>
                <Ionicons name="person-outline" size={20} color={Colors.success} />
              </View>
              <Text style={styles.settingText}>Profili Düzenle</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionItem}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.warning + '20' }]}>
                <Ionicons name="key-outline" size={20} color={Colors.warning} />
              </View>
              <Text style={styles.settingText}>Şifre Değiştir</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionItem}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.primary + '20' }]}>
                <Ionicons name="help-circle-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.settingText}>Yardım & Destek</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </Animated.View>

        {/* Logout */}
        <Animated.View style={[styles.logoutContainer, {
          opacity: cardAnims[3],
          transform: [{ translateY: cardAnims[3].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }]}>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            <Text style={styles.logoutText}>Çıkış Yap</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>Renkflow</Text>
          <Text style={styles.appVersion}>Versiyon 1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.primary,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: Spacing.sm,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  section: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
  },
  settingSubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  logoutContainer: {
    marginBottom: Spacing.md,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error + '15',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.error,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginBottom: 100,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  appVersion: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
