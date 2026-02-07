import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, StatusLabels, StatusColors, Shadows, Spacing, BorderRadius } from '../constants';
import { Order } from '../types';
import { getMockOrders } from '../data/mockOrders';

const { width } = Dimensions.get('window');
type NavigationProp = NativeStackNavigationProp<any>;

interface OrderCardProps {
  order: Order;
  index: number;
  onPress: () => void;
}

function OrderCard({ order, index, onPress }: OrderCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const statusInfo = StatusColors[order.status];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View 
      style={{
        opacity: fadeAnim,
        transform: [{ translateY }, { scale: scaleAnim }],
      }}
    >
      <TouchableOpacity
        style={styles.orderCard}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {/* Gradient Border Effect */}
        <LinearGradient
          colors={[statusInfo.color + '40', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        />
        
        <View style={styles.cardContent}>
          {/* Header */}
          <View style={styles.orderHeader}>
            <View style={styles.orderNumberContainer}>
              <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Ionicons name={statusInfo.icon as any} size={12} color={statusInfo.color} />
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {StatusLabels[order.status]}
              </Text>
            </View>
          </View>

          {/* Customer */}
          <Text style={styles.customerName}>{order.customerName}</Text>
          
          {/* Product */}
          <View style={styles.productRow}>
            <Ionicons name="cube-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.productName}>{order.productName}</Text>
          </View>

          {/* Footer */}
          <View style={styles.orderFooter}>
            <View style={styles.footerItem}>
              <Text style={styles.quantityBadge}>{order.quantity}x</Text>
            </View>
            {order.deliveryDate && (
              <View style={styles.footerItem}>
                <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.footerText}>
                  {new Date(order.deliveryDate).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </View>
            )}
            <View style={styles.priceContainer}>
              <Text style={styles.priceText}>
                {order.totalAmount.toLocaleString('tr-TR')} {order.currency}
              </Text>
            </View>
          </View>
        </View>

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const navigation = useNavigation<NavigationProp>();
  const headerFade = useRef(new Animated.Value(0)).current;
  const filterFade = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      loadOrders();
      Animated.stagger(150, [
        Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(filterFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, [])
  );

  function loadOrders() {
    const data = getMockOrders();
    setOrders(data);
  }

  async function onRefresh() {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise(resolve => setTimeout(resolve, 800));
    loadOrders();
    setIsRefreshing(false);
  }

  const filteredOrders = filter === 'all' 
    ? orders 
    : orders.filter(o => o.status === filter);

  const statusCounts = {
    all: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    in_production: orders.filter(o => o.status === 'in_production').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        style={styles.header}
      >
        <Animated.View style={[styles.headerContent, { opacity: headerFade }]}>
          <View>
            <Text style={styles.headerTitle}>Siparişler</Text>
            <Text style={styles.headerSubtitle}>{orders.length} aktif sipariş</Text>
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
          </View>
        </Animated.View>
      </LinearGradient>

      {/* Filter Tabs */}
      <Animated.View 
        style={[styles.filterContainer, { opacity: filterFade }]}
      >
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => { setFilter('all'); Haptics.selectionAsync(); }}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Tümü ({statusCounts.all})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'pending' && styles.filterTabActive]}
          onPress={() => { setFilter('pending'); Haptics.selectionAsync(); }}
        >
          <View style={[styles.filterDot, { backgroundColor: Colors.pending }]} />
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            {statusCounts.pending}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'in_production' && styles.filterTabActive]}
          onPress={() => { setFilter('in_production'); Haptics.selectionAsync(); }}
        >
          <View style={[styles.filterDot, { backgroundColor: Colors.in_production }]} />
          <Text style={[styles.filterText, filter === 'in_production' && styles.filterTextActive]}>
            {statusCounts.in_production}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'delivered' && styles.filterTabActive]}
          onPress={() => { setFilter('delivered'); Haptics.selectionAsync(); }}
        >
          <View style={[styles.filterDot, { backgroundColor: Colors.delivered }]} />
          <Text style={[styles.filterText, filter === 'delivered' && styles.filterTextActive]}>
            {statusCounts.delivered}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        renderItem={({ item, index }) => (
          <OrderCard
            order={item}
            index={index}
            onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Bu kategoride sipariş yok</Text>
          </View>
        }
      />

      {/* FAB */}
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
    paddingBottom: 20,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundLight,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 120,
  },
  orderCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.medium,
  },
  cardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  cardContent: {
    flex: 1,
    padding: Spacing.md,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  orderNumberContainer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  orderNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  customerName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  productName: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  orderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quantityBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent,
    backgroundColor: Colors.accent + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  priceContainer: {
    marginLeft: 'auto',
  },
  priceText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  arrowContainer: {
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textMuted,
    marginTop: Spacing.md,
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
