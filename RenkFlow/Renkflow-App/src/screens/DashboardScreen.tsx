import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, StatusColors, Shadows, Spacing, BorderRadius } from '../constants';
import { getMockOrders } from '../data/mockOrders';

const { width } = Dimensions.get('window');
type NavigationProp = NativeStackNavigationProp<any>;

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const orders = getMockOrders();
  
  const headerFade = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.stagger(100, cardAnims.map(anim =>
      Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true })
    )).start();
  }, []);

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    inProduction: orders.filter(o => o.status === 'in_production').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    totalRevenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
  };

  const recentOrders = orders.slice(0, 3);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        style={styles.header}
      >
        <Animated.View style={[styles.headerContent, { opacity: headerFade }]}>
          <View>
            <Text style={styles.greeting}>Merhaba! 👋</Text>
            <Text style={styles.headerTitle}>Renkflow</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('Search');
              }}
            >
              <Ionicons name="search" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('Notifications');
              }}
            >
              <Ionicons name="notifications" size={22} color="#fff" />
              <View style={styles.notificationBadge}>
                <Text style={styles.badgeText}>2</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Revenue Card */}
        <Animated.View style={{
          opacity: cardAnims[0],
          transform: [{ translateY: cardAnims[0].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }}>
          <LinearGradient
            colors={[Colors.accent, Colors.accentLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.revenueCard}
          >
            <View style={styles.revenueHeader}>
              <Text style={styles.revenueLabel}>Toplam Gelir</Text>
              <Ionicons name="trending-up" size={24} color="rgba(255,255,255,0.8)" />
            </View>
            <Text style={styles.revenueAmount}>
              {stats.totalRevenue.toLocaleString('tr-TR')} ₺
            </Text>
            <Text style={styles.revenueSubtext}>
              {stats.total} siparişten
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* Stats Grid */}
        <Animated.View style={[styles.statsGrid, {
          opacity: cardAnims[1],
          transform: [{ translateY: cardAnims[1].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }]}>
          <TouchableOpacity 
            style={[styles.statCard, { borderLeftColor: Colors.pending }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('Siparişler');
            }}
          >
            <View style={[styles.statIcon, { backgroundColor: StatusColors.pending.bg }]}>
              <Ionicons name="time-outline" size={22} color={Colors.pending} />
            </View>
            <Text style={styles.statNumber}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Bekleyen</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statCard, { borderLeftColor: Colors.in_production }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('Siparişler');
            }}
          >
            <View style={[styles.statIcon, { backgroundColor: StatusColors.in_production.bg }]}>
              <Ionicons name="construct-outline" size={22} color={Colors.in_production} />
            </View>
            <Text style={styles.statNumber}>{stats.inProduction}</Text>
            <Text style={styles.statLabel}>Üretimde</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statCard, { borderLeftColor: Colors.delivered }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('Siparişler');
            }}
          >
            <View style={[styles.statIcon, { backgroundColor: StatusColors.delivered.bg }]}>
              <Ionicons name="checkmark-circle-outline" size={22} color={Colors.delivered} />
            </View>
            <Text style={styles.statNumber}>{stats.delivered}</Text>
            <Text style={styles.statLabel}>Teslim</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View style={[styles.section, {
          opacity: cardAnims[2],
          transform: [{ translateY: cardAnims[2].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }]}>
          <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate('NewOrder');
              }}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryLight]}
                style={styles.actionGradient}
              >
                <Ionicons name="add-circle-outline" size={28} color="#fff" />
              </LinearGradient>
              <Text style={styles.actionText}>Yeni Sipariş</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate('Search');
              }}
            >
              <LinearGradient
                colors={[Colors.info, Colors.infoLight]}
                style={styles.actionGradient}
              >
                <Ionicons name="search-outline" size={28} color="#fff" />
              </LinearGradient>
              <Text style={styles.actionText}>Sipariş Ara</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate('Customers');
              }}
            >
              <LinearGradient
                colors={[Colors.success, Colors.successLight]}
                style={styles.actionGradient}
              >
                <Ionicons name="people-outline" size={28} color="#fff" />
              </LinearGradient>
              <Text style={styles.actionText}>Müşteriler</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Recent Orders */}
        <Animated.View style={[styles.section, {
          opacity: cardAnims[3],
          transform: [{ translateY: cardAnims[3].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Son Siparişler</Text>
            <TouchableOpacity 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('Siparişler');
              }}
            >
              <Text style={styles.seeAllText}>Tümünü Gör</Text>
            </TouchableOpacity>
          </View>
          
          {recentOrders.map((order, index) => {
            const statusInfo = StatusColors[order.status];
            return (
              <TouchableOpacity
                key={order.id}
                style={styles.recentOrderItem}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate('Siparişler', { 
                    screen: 'OrderDetail',
                    params: { orderId: order.id }
                  });
                }}
              >
                <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
                <View style={styles.recentOrderInfo}>
                  <Text style={styles.recentOrderName}>{order.customerName}</Text>
                  <Text style={styles.recentOrderProduct}>{order.productName}</Text>
                </View>
                <Text style={styles.recentOrderPrice}>
                  {order.totalAmount.toLocaleString('tr-TR')} ₺
                </Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        {/* Add Order FAB spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          navigation.navigate('NewOrder');
        }}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.primaryLight]}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.accent,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  revenueCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  revenueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  revenueLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  revenueAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
  },
  revenueSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actionGradient: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.small,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  recentOrderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.md,
  },
  recentOrderInfo: {
    flex: 1,
  },
  recentOrderName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  recentOrderProduct: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  recentOrderPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    marginRight: Spacing.sm,
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: Spacing.lg,
    borderRadius: 28,
    ...Shadows.large,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
