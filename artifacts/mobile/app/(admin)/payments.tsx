import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, Pressable, RefreshControl } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/hooks/useColors';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { customFetch } from '@workspace/api-client-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

function formatSGT(dateStr: string | null | undefined) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', dateStyle: 'medium', timeStyle: 'short' });
}

function statusColor(status: string, colors: any) {
  switch (status) {
    case 'Pending': return colors.warning;
    case 'Paid': return colors.warning;
    case 'Succeeded': return colors.success;
    case 'Processed': return colors.success;
    case 'Failed': return colors.destructive;
    case 'Rejected': return colors.destructive;
    default: return colors.mutedForeground;
  }
}

export default function AdminPayments() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'payments' | 'withdrawals'>('payments');

  const { data: payments, isLoading: paymentsLoading, refetch: refetchPayments } = useQuery({
    queryKey: ['adminPayments'],
    queryFn: async () => {
      const res: any = await customFetch('/api/admin/payments?status=Paid', { headers: { 'Content-Type': 'application/json' } });
      return res;
    },
    enabled: !!user && user.role === 'admin',
  });

  const { data: withdrawals, isLoading: withdrawalsLoading, refetch: refetchWithdrawals } = useQuery({
    queryKey: ['adminWithdrawals'],
    queryFn: async () => {
      const res: any = await customFetch('/api/admin/withdrawals?status=Pending', { headers: { 'Content-Type': 'application/json' } });
      return res;
    },
    enabled: !!user && user.role === 'admin',
  });

  const verifyPayment = async (paymentId: number) => {
    try {
      await customFetch(`/api/admin/payments/${paymentId}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      queryClient.invalidateQueries({ queryKey: ['adminPayments'] });
      Alert.alert('Verified', 'Payment marked as verified.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to verify payment');
    }
  };

  const rejectPayment = async (paymentId: number) => {
    Alert.alert(
      'Reject Payment?',
      'This will mark the payment as failed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await customFetch(`/api/admin/payments/${paymentId}/reject`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
              });
              queryClient.invalidateQueries({ queryKey: ['adminPayments'] });
              Alert.alert('Rejected', 'Payment marked as failed.');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to reject payment');
            }
          },
        },
      ]
    );
  };

  const processWithdrawal = async (withdrawalId: number) => {
    Alert.alert(
      'Process Withdrawal?',
      'Confirm you have transferred the funds to the tutor\'s bank account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process',
          onPress: async () => {
            try {
              await customFetch(`/api/withdrawals/${withdrawalId}/approve`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
              });
              queryClient.invalidateQueries({ queryKey: ['adminWithdrawals'] });
              Alert.alert('Processed', 'Withdrawal marked as processed.');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to process withdrawal');
            }
          },
        },
      ]
    );
  };

  const rejectWithdrawal = async (withdrawalId: number) => {
    Alert.alert(
      'Reject Withdrawal?',
      'This will refund the balance back to the tutor.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await customFetch(`/api/withdrawals/${withdrawalId}/reject`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
              });
              queryClient.invalidateQueries({ queryKey: ['adminWithdrawals'] });
              Alert.alert('Rejected', 'Withdrawal rejected and balance refunded.');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to reject withdrawal');
            }
          },
        },
      ]
    );
  };

  const renderPayment = ({ item }: { item: any }) => (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>{item.question?.title || 'Unknown'}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            by {item.student?.name} • to {item.tutor?.name}
          </Text>
        </View>
        <Badge label={item.status} variant={item.status === 'Paid' ? 'warning' : 'default'} />
      </View>
      <View style={styles.details}>
        <Text style={[styles.amount, { color: colors.primary }]}>SGD {item.amount?.toFixed(2)}</Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>Ref: {item.paynowRef || `TM-${item.paymentId}`}</Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>{formatSGT(item.createdAt)}</Text>
      </View>
      <View style={styles.actions}>
        <Button
          title="Verify"
          variant="primary"
          size="sm"
          onPress={() => verifyPayment(item.paymentId)}
          style={{ flex: 1 }}
        />
        <Button
          title="Reject"
          variant="outline"
          size="sm"
          onPress={() => rejectPayment(item.paymentId)}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );

  const renderWithdrawal = ({ item }: { item: any }) => (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Withdrawal Request</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            by {item.tutor?.name || 'Tutor'}
          </Text>
        </View>
        <Badge label={item.status} variant={item.status === 'Pending' ? 'warning' : 'default'} />
      </View>
      <View style={styles.details}>
        <Text style={[styles.amount, { color: colors.primary }]}>SGD {item.amount?.toFixed(2)}</Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>Method: {item.method}</Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>Bank: {item.bankDetails || '-'}</Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>Requested: {formatSGT(item.requestedAt)}</Text>
      </View>
      <View style={styles.actions}>
        <Button
          title="Process"
          variant="primary"
          size="sm"
          onPress={() => processWithdrawal(item.withdrawalId)}
          style={{ flex: 1 }}
        />
        <Button
          title="Reject"
          variant="outline"
          size="sm"
          onPress={() => rejectWithdrawal(item.withdrawalId)}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );

  const isLoading = activeTab === 'payments' ? paymentsLoading : withdrawalsLoading;
  const data = activeTab === 'payments' ? payments : withdrawals;
  const refetch = activeTab === 'payments' ? refetchPayments : refetchWithdrawals;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.tabs, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={[styles.tab, activeTab === 'payments' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('payments')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'payments' ? colors.primary : colors.mutedForeground }]}>
            Payments ({payments?.length || 0})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'withdrawals' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('withdrawals')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'withdrawals' ? colors.primary : colors.mutedForeground }]}>
            Withdrawals ({withdrawals?.length || 0})
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String(activeTab === 'payments' ? item.paymentId : item.withdrawalId)}
          renderItem={activeTab === 'payments' ? renderPayment : renderWithdrawal}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              title={`No ${activeTab}`}
              description={`No pending ${activeTab} to review.`}
              icon={activeTab === 'payments' ? 'credit-card' : 'dollar-sign'}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: '500' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  subtitle: { fontSize: 13, marginTop: 2 },
  details: { marginBottom: 12, gap: 4 },
  amount: { fontSize: 20, fontWeight: '700' },
  meta: { fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8 },
});
