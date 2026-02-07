import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Animated,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, StatusLabels, StatusColors, Spacing, BorderRadius, Shadows } from '../constants';
import { Order } from '../types';
import { getMockOrders } from '../data/mockOrders';

type NavigationProp = NativeStackNavigationProp<any>;

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Order[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const searchTimeout = setTimeout(() => {
      const orders = getMockOrders();
      const filtered = orders.filter(order => 
        order.customerName.toLowerCase().includes(query.toLowerCase()) ||
        order.productName.toLowerCase().includes(query.toLowerCase()) ||
        order.orderNumber.toLowerCase().includes(query.toLowerCase())
      );
      setResults(filtered);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  function renderOrderItem({ item }: { item: Order }) {
    const statusInfo = StatusColors[item.status];
    
    return (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          Keyboard.dismiss();
          navigation.navigate('OrderDetail', { orderId: item.id });
        }}
      >
        <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
        <View style={styles.resultContent}>
          <Text style={styles.orderNumber}>{item.orderNumber}</Text>
          <Text style={styles.customerName}>{item.customerName}</Text>
          <Text style={styles.productName}>{item.productName}</Text>
        </View>
        <View style={styles.resultRight}>
          <Text style={styles.price}>{item.totalAmount.toLocaleString('tr-TR')} ₺</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {StatusLabels[item.status]}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Sipariş, müşteri veya ürün ara..."
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Results */}
      {query.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Arama Yapın</Text>
          <Text style={styles.emptySubtitle}>
            Sipariş numarası, müşteri adı{'\n'}veya ürün adı ile arayın
          </Text>
        </View>
      ) : results.length === 0 && !isSearching ? (
        <View style={styles.emptyState}>
          <Ionicons name="file-tray-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Sonuç Bulunamadı</Text>
          <Text style={styles.emptySubtitle}>
            "{query}" için sonuç yok
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text style={styles.resultsCount}>
              {results.length} sonuç bulundu
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  listContent: {
    padding: Spacing.md,
  },
  resultsCount: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.md,
  },
  resultContent: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 2,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  productName: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  resultRight: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 20,
  },
});
