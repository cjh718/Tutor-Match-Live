import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminGetUsers, useAdminSuspendUser, getAdminGetUsersQueryKey } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';

export default function AdminDashboard() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: users, isLoading, error, refetch, isRefetching } = useAdminGetUsers({}, {
    query: {
      queryKey: getAdminGetUsersQueryKey({}),
      enabled: !!user && user.role === 'admin'
    }
  });

  const suspendMutation = useAdminSuspendUser();

  const handleToggleSuspend = async (userId: number, currentStatus: boolean) => {
    try {
      await suspendMutation.mutateAsync({
        userId,
        data: { suspended: !currentStatus }
      });
      queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey({}) });
    } catch (e) {
      console.error(e);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.foreground }]}>{item.name}</Text>
          <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{item.email}</Text>
        </View>
        <Badge 
          label={item.role.toUpperCase()} 
          variant={item.role === 'student' ? 'blue' : item.role === 'tutor' ? 'warning' : 'default'} 
        />
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: item.suspended ? colors.destructive : colors.success }]} />
          <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
            {item.suspended ? 'Suspended' : 'Active'}
          </Text>
        </View>
        {item.role !== 'admin' && (
          <Button
            title={item.suspended ? 'Unsuspend' : 'Suspend'}
            variant={item.suspended ? 'outline' : 'destructive'}
            size="sm"
            onPress={() => handleToggleSuspend(item.userId, item.suspended)}
            loading={suspendMutation.isPending && suspendMutation.variables?.userId === item.userId}
          />
        )}
      </View>
    </Card>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.listContent, { paddingTop: insets.top + 16 }]}>
          {[1, 2, 3, 4].map(i => (
            <Card key={i} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Skeleton width={120} height={20} style={{ marginBottom: 8 }} />
                  <Skeleton width={180} height={16} />
                </View>
                <Skeleton width={60} height={24} borderRadius={12} />
              </View>
            </Card>
          ))}
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.destructive, marginBottom: 16 }}>Failed to load users</Text>
        <Button title="Retry" onPress={() => refetch()} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={users}
        keyExtractor={(item) => item.userId.toString()}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListEmptyComponent={<EmptyState title="No users found" icon="users" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  userInfo: {
    flex: 1,
    marginRight: 16,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0', // Handled properly with colors in render if needed
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
