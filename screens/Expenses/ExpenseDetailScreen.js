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
  Share,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { 
  deleteExpense,
  settleExpense
} from '../../utils/firebase/expenseService';
import { getTripMembersWithProfiles } from '../../utils/firebase/memberService';

const ExpenseDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const auth = getAuth();
  
  const { tripId, expenseId, expenseData: routeExpenseData } = route.params;
  
  const [trip, setTrip] = useState(null);
  const [expense, setExpense] = useState(routeExpenseData || null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(!routeExpenseData);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!tripId || !expenseId) {
      Alert.alert('Error', 'Missing trip or expense ID');
      navigation.goBack();
      return;
    }

    if (routeExpenseData) {
      fetchMembers();
    } else {
      fetchExpenseData();
    }
  }, []);

  const fetchExpenseData = async () => {
    setLoading(true);
    try {
      // Get trip data
      const tripDoc = await getDoc(doc(db, 'trips', tripId));
      if (!tripDoc.exists()) {
        Alert.alert('Error', 'Trip not found');
        navigation.goBack();
        return;
      }
      
      const tripData = { id: tripDoc.id, ...tripDoc.data() };
      setTrip(tripData);
      
      // Get expense data
      const expenseDoc = await getDoc(doc(db, 'expenses', expenseId));
      if (!expenseDoc.exists()) {
        Alert.alert('Error', 'Expense not found');
        navigation.goBack();
        return;
      }
      
      const expenseData = { id: expenseDoc.id, ...expenseDoc.data() };
      setExpense(expenseData);
      
      // Get members with profiles
      await fetchMembers();
      
    } catch (error) {
      console.error('Error fetching expense data:', error);
      Alert.alert('Error', 'Failed to load expense details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const membersWithProfiles = await getTripMembersWithProfiles(trip || { id: tripId });
      setMembers(membersWithProfiles);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
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

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateShare = () => {
    if (!expense || !expense.splitBetween || expense.splitBetween.length === 0) {
      return 0;
    }
    return expense.amount / expense.splitBetween.length;
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const result = await deleteExpense(expense.id);
              if (result.success) {
                Alert.alert('Success', 'Expense deleted successfully');
                navigation.goBack();
              } else {
                Alert.alert('Error', result.error || 'Failed to delete expense');
              }
            } catch (error) {
              console.error('Error deleting expense:', error);
              Alert.alert('Error', 'Failed to delete expense');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleToggleSettle = async () => {
    try {
      const result = await settleExpense(expense.id);
      if (result.success) {
        Alert.alert('Success', `Expense marked as ${expense.settled ? 'unsettled' : 'settled'}`);
        // Update local state
        setExpense({ ...expense, settled: !expense.settled });
      } else {
        Alert.alert('Error', result.error || 'Failed to update expense');
      }
    } catch (error) {
      console.error('Error toggling settlement:', error);
      Alert.alert('Error', 'Failed to update expense');
    }
  };

  const handleShare = async () => {
    try {
      const shareAmount = calculateShare().toFixed(2);
      const message = `Expense: ${expense.label}\n` +
        `Amount: ₹${expense.amount.toFixed(2)}\n` +
        `Paid by: ${getMemberName(expense.userId)}\n` +
        `Your share: ₹${shareAmount}\n` +
        `Date: ${formatDate(expense.createdAt)}`;
      
      await Share.share({
        message,
        title: 'Expense Details',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleEdit = () => {
    // Navigate to edit screen (you can create this later)
    Alert.alert('Coming Soon', 'Edit functionality will be added soon');
  };

  const isExpenseCreator = expense?.userId === auth.currentUser.uid;
  const userInSplit = expense?.splitBetween?.includes(auth.currentUser.uid);
  const shareAmount = calculateShare();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading expense details...</Text>
      </View>
    );
  }

  if (!expense) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#ccc" />
        <Text style={styles.errorText}>Expense not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
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
        <Text style={styles.headerTitle} numberOfLines={1}>
          Expense Details
        </Text>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
        >
          <Ionicons name="share-outline" size={22} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Expense Header Card */}
        <View style={styles.headerCard}>
          <View style={[
            styles.expenseIcon,
            isExpenseCreator ? styles.expenseIconPaid : styles.expenseIconShared
          ]}>
            <Ionicons 
              name={isExpenseCreator ? "wallet" : "share"} 
              size={32} 
              color="#fff" 
            />
          </View>
          
          <Text style={styles.expenseLabel}>{expense.label}</Text>
          <Text style={styles.expenseAmount}>₹{expense.amount.toFixed(2)}</Text>
          
          <View style={styles.statusBadge}>
            {expense.settled ? (
              <View style={[styles.badge, styles.settledBadge]}>
                <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                <Text style={styles.settledBadgeText}>Settled</Text>
              </View>
            ) : (
              <View style={[styles.badge, styles.pendingBadge]}>
                <Ionicons name="time" size={14} color="#FF9800" />
                <Text style={styles.pendingBadgeText}>Pending</Text>
              </View>
            )}
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Details</Text>
          
          <View style={styles.detailRow}>
            <Ionicons name="person" size={20} color="#666" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Paid by</Text>
              <Text style={styles.detailValue}>
                {isExpenseCreator ? 'You' : getMemberName(expense.userId)}
              </Text>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={20} color="#666" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>
                {formatDate(expense.createdAt)} at {formatTime(expense.createdAt)}
              </Text>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <Ionicons name="people" size={20} color="#666" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Split between</Text>
              <Text style={styles.detailValue}>
                {expense.splitBetween.length} people
              </Text>
            </View>
          </View>
          
          {userInSplit && (
            <View style={styles.detailRow}>
              <Ionicons name="cash" size={20} color="#666" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Your share</Text>
                <Text style={styles.detailValue}>
                  ₹{shareAmount.toFixed(2)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Split Between Card */}
        <View style={styles.splitCard}>
          <Text style={styles.sectionTitle}>Split Between</Text>
          
          {expense.splitBetween.map((memberId, index) => {
            const isPayer = memberId === expense.userId;
            const isCurrentUser = memberId === auth.currentUser.uid;
            
            return (
              <View 
                key={memberId} 
                style={[
                  styles.splitMemberRow,
                  index === expense.splitBetween.length - 1 && styles.lastSplitMemberRow
                ]}
              >
                <View style={styles.splitMemberInfo}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {getMemberInitials(memberId)}
                    </Text>
                  </View>
                  <View style={styles.memberDetails}>
                    <Text style={styles.memberName}>
                      {isCurrentUser ? 'You' : getMemberName(memberId)}
                      {isPayer && <Text style={styles.payerLabel}> • Paid</Text>}
                    </Text>
                    <Text style={styles.memberShare}>
                      ₹{shareAmount.toFixed(2)} each
                    </Text>
                  </View>
                </View>
                
                {isCurrentUser && (
                  <View style={styles.yourShareBadge}>
                    <Text style={styles.yourShareText}>You</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Notes Card (if notes exist) */}
        {expense.notes && (
          <View style={styles.notesCard}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{expense.notes}</Text>
          </View>
        )}

        {/* Actions Card */}
        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.settleButton]}
              onPress={handleToggleSettle}
              disabled={deleting}
            >
              <Ionicons 
                name={expense.settled ? "refresh" : "checkmark-circle"} 
                size={20} 
                color="#fff" 
              />
              <Text style={styles.actionButtonText}>
                {expense.settled ? 'Mark as Unsettled' : 'Mark as Settled'}
              </Text>
            </TouchableOpacity>
            
            {isExpenseCreator && (
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={handleEdit}
                disabled={deleting}
              >
                <Ionicons name="create" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {isExpenseCreator && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="trash" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Delete Expense</Text>
                </>
              )}
            </TouchableOpacity>
          )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  shareButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  headerCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  expenseIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  expenseIconPaid: {
    backgroundColor: '#4CAF50',
  },
  expenseIconShared: {
    backgroundColor: '#FF9800',
  },
  expenseLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  expenseAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statusBadge: {
    marginTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  settledBadge: {
    backgroundColor: '#E8F5E9',
  },
  settledBadgeText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
    marginLeft: 4,
  },
  pendingBadge: {
    backgroundColor: '#FFF3E0',
  },
  pendingBadgeText: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: '600',
    marginLeft: 4,
  },
  detailsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailContent: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  splitCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  splitMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lastSplitMemberRow: {
    borderBottomWidth: 0,
  },
  splitMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  payerLabel: {
    fontSize: 14,
    color: '#4CAF50',
  },
  memberShare: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  yourShareBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  yourShareText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '600',
  },
  notesCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notesText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  actionsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 6,
  },
  settleButton: {
    backgroundColor: '#4CAF50',
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ExpenseDetailScreen;