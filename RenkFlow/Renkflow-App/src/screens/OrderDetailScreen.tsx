import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, StatusLabels, StatusColors, Shadows, Spacing, BorderRadius } from '../constants';
import { Order } from '../types';
import { getMockOrderById, updateMockOrderStatus } from '../data/mockOrders';

type RouteParams = {
  OrderDetail: { orderId: string };
};

const STATUSES: Order['status'][] = ['pending', 'in_production', 'delivered'];

export default function OrderDetailScreen() {
  const [order, setOrder] = useState<Order | null>(null);
  const route = useRoute<RouteProp<RouteParams, 'OrderDetail'>>();
  const navigation = useNavigation();
  const { orderId } = route.params;
  
  const fadeAnims = useRef(STATUSES.map(() => new Animated.Value(0))).current;
  const cardAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const data = getMockOrderById(orderId);
    if (data) setOrder(data);
    
    // Animate cards
    Animated.stagger(100, cardAnims.map(anim =>
      Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true })
    )).start();
  }, [orderId]);

  function handleStatusChange(newStatus: Order['status']) {
    if (!order || order.status === newStatus) return;
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const updated = updateMockOrderStatus(order.id, newStatus);
    if (updated) {
      setOrder({ ...updated });
    }
  }

  function handleCall() {
    if (order?.customerPhone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Linking.openURL(`tel:${order.customerPhone}`);
    }
  }

  function handleEmail() {
    if (order?.customerEmail) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Linking.openURL(`mailto:${order.customerEmail}`);
    }
  }

  if (!order) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorText}>Sipariş bulunamadı</Text>
      </View>
    );
  }

  const statusInfo = StatusColors[order.status];

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[statusInfo.color, statusInfo.color + 'CC']}
        style={styles.header}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <Text style={styles.headerOrderNumber}>{order.orderNumber}</Text>
        <View style={styles.headerStatus}>
          <Ionicons name={statusInfo.icon as any} size={16} color="#fff" />
          <Text style={styles.headerStatusText}>{StatusLabels[order.status]}</Text>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Customer Card */}
        <Animated.View style={[styles.card, { 
          opacity: cardAnims[0],
          transform: [{ translateY: cardAnims[0].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={20} color={Colors.primary} />
            <Text style={styles.cardTitle}>Müşteri</Text>
          </View>
          
          <Text style={styles.customerName}>{order.customerName}</Text>
          
          <View style={styles.contactButtons}>
            {order.customerPhone && (
              <TouchableOpacity style={styles.contactButton} onPress={handleCall}>
                <LinearGradient
                  colors={[Colors.success, Colors.successLight]}
                  style={styles.contactGradient}
                >
                  <Ionicons name="call" size={18} color="#fff" />
                  <Text style={styles.contactButtonText}>Ara</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            {order.customerEmail && (
              <TouchableOpacity style={styles.contactButton} onPress={handleEmail}>
                <LinearGradient
                  colors={[Colors.info, Colors.infoLight]}
                  style={styles.contactGradient}
                >
                  <Ionicons name="mail" size={18} color="#fff" />
                  <Text style={styles.contactButtonText}>E-posta</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Product Card */}
        <Animated.View style={[styles.card, { 
          opacity: cardAnims[1],
          transform: [{ translateY: cardAnims[1].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="cube-outline" size={20} color={Colors.primary} />
            <Text style={styles.cardTitle}>Ürün Detayları</Text>
          </View>
          
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{order.productName}</Text>
            <View style={styles.quantityBadge}>
              <Text style={styles.quantityText}>{order.quantity} adet</Text>
            </View>
          </View>

          {order.deliveryDate && (
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>Teslim Tarihi</Text>
              <Text style={styles.infoValue}>
                {new Date(order.deliveryDate).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Toplam Tutar</Text>
            <Text style={styles.priceValue}>
              {order.totalAmount.toLocaleString('tr-TR')} {order.currency}
            </Text>
          </View>
        </Animated.View>

        {/* Notes Card */}
        {order.notes && (
          <Animated.View style={[styles.card, { 
            opacity: cardAnims[2],
            transform: [{ translateY: cardAnims[2].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
          }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
              <Text style={styles.cardTitle}>Notlar</Text>
            </View>
            <Text style={styles.notesText}>{order.notes}</Text>
          </Animated.View>
        )}

        {/* Status Change */}
        <Animated.View style={[styles.card, { 
          opacity: cardAnims[3],
          transform: [{ translateY: cardAnims[3].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="swap-horizontal-outline" size={20} color={Colors.primary} />
            <Text style={styles.cardTitle}>Durumu Değiştir</Text>
          </View>
          
          <View style={styles.statusButtons}>
            {STATUSES.map((status) => {
              const info = StatusColors[status];
              const isActive = order.status === status;
              
              return (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusButton,
                    { borderColor: info.color },
                    isActive && { backgroundColor: info.color },
                  ]}
                  onPress={() => handleStatusChange(status)}
                  disabled={isActive}
                >
                  <Ionicons 
                    name={info.icon as any} 
                    size={22} 
                    color={isActive ? '#fff' : info.color} 
                  />
                  <Text style={[
                    styles.statusButtonText,
                    { color: isActive ? '#fff' : info.color },
                  ]}>
                    {StatusLabels[status]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* Timestamps */}
        <View style={styles.timestamps}>
          <View style={styles.timestampRow}>
            <Text style={styles.timestampLabel}>Oluşturulma</Text>
            <Text style={styles.timestampValue}>
              {new Date(order.createdAt).toLocaleString('tr-TR')}
            </Text>
          </View>
          <View style={styles.timestampRow}>
            <Text style={styles.timestampLabel}>Son Güncelleme</Text>
            <Text style={styles.timestampValue}>
              {new Date(order.updatedAt).toLocaleString('tr-TR')}
            </Text>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    marginTop: Spacing.md,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerOrderNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  headerStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  contactButton: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  contactGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  productInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  quantityBadge: {
    backgroundColor: Colors.accent + '20',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  priceLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
  },
  notesText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 24,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: Spacing.xs,
  },
  statusButtonText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  timestamps: {
    paddingVertical: Spacing.md,
    marginBottom: 100,
  },
  timestampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  timestampLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  timestampValue: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
