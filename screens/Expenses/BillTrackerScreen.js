import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { 
  calculateBalances,
  getUserExpenseSummary,
  markSettlementDone,
  subscribeToTripExpenses
} from '../../utils/firebase/expenseService';
import { getTripMembersWithProfiles } from '../../utils/firebase/memberService';

const BillTrackerScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const auth = getAuth();
  
  const { tripId } = route.params;
  
  const [trip, setTrip] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balances, setBalances] = useState(null);
  const [userSummary, setUserSummary] = useState(null);

  useEffect(() => {
  if (!tripId) {
    Alert.alert('Error', 'No trip ID provided');
    navigation.goBack();
    return;
  }

  let unsubscribeTrip = null;
  let unsubscribeExpenses = null;

  const init = async () => {
    try {
      // First get trip data
      const tripDoc = await getDoc(doc(db, 'trips', tripId));
      if (!tripDoc.exists()) {
        Alert.alert('Error', 'Trip not found');
        navigation.goBack();
        return;
      }

      const tripData = { id: tripDoc.id, ...tripDoc.data() };
      setTrip(tripData);
      
      // Get members with profiles
      const membersWithProfiles = await getTripMembersWithProfiles(tripData);
      setMembers(membersWithProfiles);
      
      // Then subscribe to expenses
      unsubscribeExpenses = subscribeToTripExpenses(tripId, (expensesList) => {
        setExpenses(expensesList);
        if (membersWithProfiles.length > 0) {
          calculateAllBalances(expensesList, membersWithProfiles);
        }
      });
      
    } catch (error) {
      console.error('Error initializing:', error);
      Alert.alert('Error', 'Failed to load trip data');
      setLoading(false);
    }
  };

  init();

  return () => {
    if (unsubscribeTrip) unsubscribeTrip();
    if (unsubscribeExpenses) unsubscribeExpenses();
  };
}, [tripId]);

  const calculateAllBalances = (expensesList, membersList) => {
    const currentUserId = auth.currentUser.uid;
    
    // Calculate balances
    const balanceData = calculateBalances(
      expensesList,
      membersList.map(m => ({ id: m.id })),
      currentUserId
    );
    setBalances(balanceData);
    
    // Calculate user summary
    const summary = getUserExpenseSummary(expensesList, currentUserId);
    setUserSummary(summary);
    
    setLoading(false);
    setRefreshing(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Re-fetch members
    if (trip) {
      const membersWithProfiles = await getTripMembersWithProfiles(trip);
      setMembers(membersWithProfiles);
      calculateAllBalances(expenses, membersWithProfiles);
    }
  };

  const handleAddExpense = () => {
    navigation.navigate('AddExpense', { 
      tripId,
      members: members.map(m => ({ 
        id: m.id, 
        name: m.displayName || m.email,
        avatar: m.photoURL 
      }))
    });
  };

  const handleSettle = (settlement) => {
    Alert.alert(
      'Mark as Settled',
      `Have you settled ₹${settlement.amount} with ${getMemberName(settlement.toUserId)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Settled',
          style: 'default',
          onPress: async () => {
            try {
              // In a real app, you'd call markSettlementDone
              // For now, we'll just show a message
              Alert.alert('Success', `Settlement marked as completed`);
              
              // TODO: Implement actual settlement marking
              // await markSettlementDone(settlement.id);
              
              // Refresh data
              handleRefresh();
            } catch (error) {
              console.error('Error settling:', error);
              Alert.alert('Error', 'Failed to mark settlement');
            }
          },
        },
      ]
    );
  };

  const handleViewAllExpenses = () => {
    navigation.navigate('ExpenseList', { tripId });
  };

  const getMemberName = (userId) => {
    const member = members.find(m => m.id === userId);
    return member?.displayName || member?.email || 'User';
  };

  const getMemberAvatar = (userId) => {
    const member = members.find(m => m.id === userId);
    return member?.photoURL;
  };

  const getMemberInitials = (userId) => {
    const member = members.find(m => m.id === userId);
    const name = member?.displayName || member?.email || 'U';
    return name.charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading expenses...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expense Tracker</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddExpense}
        >
          <Ionicons name="add" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* User Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="person-circle" size={24} color="#007AFF" />
            <Text style={styles.summaryTitle}>Your Summary</Text>
          </View>
          
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Total Paid</Text>
              <Text style={[styles.summaryStatValue, styles.paidColor]}>
                ₹{userSummary?.totalPaid || 0}
              </Text>
            </View>
            
            <View style={styles.summaryDivider} />
            
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Total Owed</Text>
              <Text style={[styles.summaryStatValue, styles.owedColor]}>
                ₹{userSummary?.totalOwed || 0}
              </Text>
            </View>
            
            <View style={styles.summaryDivider} />
            
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Net Balance</Text>
              <Text style={[
                styles.summaryStatValue,
                (balances?.netBalance || 0) >= 0 ? styles.positiveColor : styles.negativeColor
              ]}>
                {balances?.netBalance >= 0 ? '+' : ''}₹{Math.abs(balances?.netBalance || 0)}
              </Text>
            </View>
          </View>
          
          <View style={styles.summaryFooter}>
            <Text style={styles.summaryFooterText}>
              {balances?.netBalance >= 0 ? 'You are owed money' : 'You owe money'}
            </Text>
          </View>
        </View>

        {/* Settlements Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="swap-horizontal" size={20} color="#4CAF50" />
            <Text style={styles.sectionTitle}>Settlements</Text>
            {balances?.userSpecificSettlements?.length > 0 && (
              <Text style={styles.sectionCount}>
                ({balances.userSpecificSettlements.length})
              </Text>
            )}
          </View>
          
          {!balances?.userSpecificSettlements || balances.userSpecificSettlements.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>All settled up!</Text>
              <Text style={styles.emptyStateSubtext}>No pending settlements</Text>
            </View>
          ) : (
            balances.userSpecificSettlements.map((settlement, index) => {
              const isUserOwed = settlement.toUserId === auth.currentUser.uid;
              const otherUserId = isUserOwed ? settlement.fromUserId : settlement.toUserId;
              
              return (
                <View key={index} style={styles.settlementCard}>
                  <View style={styles.settlementAvatar}>
                    <Text style={styles.settlementAvatarText}>
                      {getMemberInitials(otherUserId)}
                    </Text>
                  </View>
                  
                  <View style={styles.settlementInfo}>
                    <Text style={styles.settlementName}>
                      {getMemberName(otherUserId)}
                    </Text>
                    <Text style={styles.settlementDescription}>
                      {isUserOwed 
                        ? `Owes you ₹${settlement.amount}`
                        : `You owe ₹${settlement.amount}`
                      }
                    </Text>
                  </View>
                  
                  <View style={styles.settlementActions}>
                    {!isUserOwed && (
                      <TouchableOpacity
                        style={styles.payButton}
                        onPress={() => handleSettle(settlement)}
                      >
                        <Ionicons name="cash" size={18} color="#fff" />
                        <Text style={styles.payButtonText}>Pay</Text>
                      </TouchableOpacity>
                    )}
                    
                    {isUserOwed && (
                      <TouchableOpacity
                        style={styles.requestButton}
                        onPress={() => handleSettle(settlement)}
                      >
                        <Ionicons name="checkmark" size={18} color="#fff" />
                        <Text style={styles.requestButtonText}>Received</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Recent Expenses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="receipt" size={20} color="#FF9800" />
            <Text style={styles.sectionTitle}>Recent Expenses</Text>
            {expenses.length > 0 && (
              <TouchableOpacity onPress={handleViewAllExpenses}>
                <Text style={styles.viewAllButton}>View All</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {expenses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No expenses yet</Text>
              <Text style={styles.emptyStateSubtext}>Add your first expense</Text>
            </View>
          ) : (
            expenses.slice(0, 3).map((expense) => {
              const paidByUser = expense.userId === auth.currentUser.uid;
              const userIncluded = expense.splitBetween.includes(auth.currentUser.uid);
              
              return (
                <View key={expense.id} style={styles.expenseCard}>
                  <View style={[
                    styles.expenseIcon,
                    paidByUser ? styles.expenseIconPaid : styles.expenseIconShared
                  ]}>
                    <Ionicons 
                      name={paidByUser ? "wallet" : "share"} 
                      size={20} 
                      color="#fff" 
                    />
                  </View>
                  
                  <View style={styles.expenseInfo}>
                    <Text style={styles.expenseLabel}>{expense.label}</Text>
                    <Text style={styles.expenseDetails}>
                      {paidByUser ? 'You paid' : `${getMemberName(expense.userId)} paid`} • 
                      ₹{expense.amount} • 
                      {expense.splitBetween.length} people
                    </Text>
                    <Text style={styles.expenseDate}>
                      {expense.date?.toDate?.().toLocaleDateString() || 'Recent'}
                    </Text>
                  </View>
                  
                  <View style={styles.expenseAmount}>
                    {paidByUser ? (
                      <Text style={styles.amountPositive}>+₹{expense.amount}</Text>
                    ) : userIncluded ? (
                      <Text style={styles.amountNegative}>
                        -₹{(expense.amount / expense.splitBetween.length).toFixed(2)}
                      </Text>
                    ) : (
                      <Text style={styles.amountNeutral}>Not involved</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Quick Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color="#607D8B" />
            <Text style={styles.statValue}>{members.length}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="receipt" size={24} color="#FF9800" />
            <Text style={styles.statValue}>{expenses.length}</Text>
            <Text style={styles.statLabel}>Expenses</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="swap-horizontal" size={24} color="#4CAF50" />
            <Text style={styles.statValue}>
              {balances?.settlements?.length || 0}
            </Text>
            <Text style={styles.statLabel}>Settlements</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  summaryStatLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  paidColor: {
    color: '#4CAF50',
  },
  owedColor: {
    color: '#FF5722',
  },
  positiveColor: {
    color: '#4CAF50',
  },
  negativeColor: {
    color: '#F44336',
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e0e0e0',
  },
  summaryFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  summaryFooterText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  sectionCount: {
    fontSize: 14,
    color: '#666',
  },
  viewAllButton: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  settlementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  settlementAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settlementAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  settlementInfo: {
    flex: 1,
  },
  settlementName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  settlementDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  settlementActions: {
    flexDirection: 'row',
  },
  payButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  payButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  requestButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  requestButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseIconPaid: {
    backgroundColor: '#4CAF50',
  },
  expenseIconShared: {
    backgroundColor: '#FF9800',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  expenseDetails: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  expenseDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  expenseAmount: {
    alignItems: 'flex-end',
  },
  amountPositive: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  amountNegative: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
  },
  amountNeutral: {
    fontSize: 12,
    color: '#999',
  },
  statsSection: {
    flexDirection: 'row',
    margin: 16,
    marginTop: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 16,
    marginHorizontal: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});

export default BillTrackerScreen;