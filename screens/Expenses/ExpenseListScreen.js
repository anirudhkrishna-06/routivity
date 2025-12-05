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
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { 
  getTripExpenses,
  deleteExpense,
  settleExpense
} from '../../utils/firebase/expenseService';
import { getTripMembersWithProfiles } from '../../utils/firebase/memberService';

const ExpenseListScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const auth = getAuth();
  
  const { tripId } = route.params;
  
  const [trip, setTrip] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [filters, setFilters] = useState({
    paidBy: 'all',
    splitWith: 'all',
    status: 'all',
  });

  useEffect(() => {
    if (!tripId) {
      Alert.alert('Error', 'No trip ID provided');
      navigation.goBack();
      return;
    }

    fetchData();
  }, [tripId]);

  useEffect(() => {
    applyFiltersAndSearch();
  }, [expenses, searchQuery, filters]);

  const fetchData = async () => {
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
      
      // Get members with profiles
      const membersWithProfiles = await getTripMembersWithProfiles(tripData);
      setMembers(membersWithProfiles);
      
      // Get expenses
      const expensesResult = await getTripExpenses(tripId);
      if (expensesResult.success) {
        setExpenses(expensesResult.expenses);
      } else {
        Alert.alert('Error', 'Failed to load expenses');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFiltersAndSearch = () => {
    let result = [...expenses];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(expense => 
        expense.label.toLowerCase().includes(query)
      );
    }

    // Apply filters
    if (filters.paidBy !== 'all') {
      result = result.filter(expense => expense.userId === filters.paidBy);
    }

    if (filters.splitWith !== 'all') {
      result = result.filter(expense => 
        expense.splitBetween.includes(filters.splitWith)
      );
    }

    if (filters.status !== 'all') {
      result = result.filter(expense => 
        filters.status === 'settled' ? expense.settled : !expense.settled
      );
    }

    setFilteredExpenses(result);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
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

  const handleExpensePress = (expense) => {
    navigation.navigate('ExpenseDetail', { 
      tripId, 
      expenseId: expense.id,
      expenseData: expense
    });
  };

  const handleDeleteExpense = (expense) => {
    setSelectedExpense(expense);
    setDeleteModalVisible(true);
  };

  const confirmDeleteExpense = async () => {
    if (!selectedExpense) return;

    try {
      const result = await deleteExpense(selectedExpense.id);
      if (result.success) {
        Alert.alert('Success', 'Expense deleted successfully');
        setDeleteModalVisible(false);
        setSelectedExpense(null);
        fetchData(); // Refresh the list
      } else {
        Alert.alert('Error', result.error || 'Failed to delete expense');
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      Alert.alert('Error', 'Failed to delete expense');
    }
  };

  const handleToggleSettle = async (expense) => {
    try {
      const result = await settleExpense(expense.id);
      if (result.success) {
        Alert.alert('Success', `Expense marked as ${expense.settled ? 'unsettled' : 'settled'}`);
        fetchData(); // Refresh the list
      } else {
        Alert.alert('Error', result.error || 'Failed to update expense');
      }
    } catch (error) {
      console.error('Error toggling settlement:', error);
      Alert.alert('Error', 'Failed to update expense');
    }
  };

  const getMemberName = (userId) => {
    const member = members.find(m => m.id === userId);
    return member?.displayName || member?.email || 'User';
  };

  const getMemberInitials = (userId) => {
    const member = members.find(m => m.id === userId);
    const name = member?.displayName || member?.email || 'U';
    return name.charAt(0).toUpperCase();
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getGroupedExpenses = () => {
    const groups = {};
    
    filteredExpenses.forEach(expense => {
      const dateKey = formatDate(expense.createdAt);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(expense);
    });
    
    return groups;
  };

  const calculateTotal = () => {
    return filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  };

  const resetFilters = () => {
    setFilters({
      paidBy: 'all',
      splitWith: 'all',
      status: 'all',
    });
    setSearchQuery('');
  };

  const renderFilterModal = () => (
    <Modal
      visible={filterModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setFilterModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Expenses</Text>
            <TouchableOpacity
              onPress={() => setFilterModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.filterContent}>
            {/* Paid By Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Paid By</Text>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  filters.paidBy === 'all' && styles.filterOptionSelected
                ]}
                onPress={() => setFilters({...filters, paidBy: 'all'})}
              >
                <Text style={[
                  styles.filterOptionText,
                  filters.paidBy === 'all' && styles.filterOptionTextSelected
                ]}>
                  All Members
                </Text>
              </TouchableOpacity>
              
              {members.map(member => (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.filterOption,
                    filters.paidBy === member.id && styles.filterOptionSelected
                  ]}
                  onPress={() => setFilters({...filters, paidBy: member.id})}
                >
                  <View style={styles.filterMemberInfo}>
                    <View style={styles.filterMemberAvatar}>
                      <Text style={styles.filterMemberAvatarText}>
                        {getMemberInitials(member.id)}
                      </Text>
                    </View>
                    <Text style={[
                      styles.filterOptionText,
                      filters.paidBy === member.id && styles.filterOptionTextSelected
                    ]}>
                      {member.id === auth.currentUser.uid ? 'You' : getMemberName(member.id)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Split With Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Split With</Text>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  filters.splitWith === 'all' && styles.filterOptionSelected
                ]}
                onPress={() => setFilters({...filters, splitWith: 'all'})}
              >
                <Text style={[
                  styles.filterOptionText,
                  filters.splitWith === 'all' && styles.filterOptionTextSelected
                ]}>
                  All Members
                </Text>
              </TouchableOpacity>
              
              {members.map(member => (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.filterOption,
                    filters.splitWith === member.id && styles.filterOptionSelected
                  ]}
                  onPress={() => setFilters({...filters, splitWith: member.id})}
                >
                  <View style={styles.filterMemberInfo}>
                    <View style={styles.filterMemberAvatar}>
                      <Text style={styles.filterMemberAvatarText}>
                        {getMemberInitials(member.id)}
                      </Text>
                    </View>
                    <Text style={[
                      styles.filterOptionText,
                      filters.splitWith === member.id && styles.filterOptionTextSelected
                    ]}>
                      {member.id === auth.currentUser.uid ? 'You' : getMemberName(member.id)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Status Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Status</Text>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  filters.status === 'all' && styles.filterOptionSelected
                ]}
                onPress={() => setFilters({...filters, status: 'all'})}
              >
                <Text style={[
                  styles.filterOptionText,
                  filters.status === 'all' && styles.filterOptionTextSelected
                ]}>
                  All Expenses
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  filters.status === 'settled' && styles.filterOptionSelected
                ]}
                onPress={() => setFilters({...filters, status: 'settled'})}
              >
                <Text style={[
                  styles.filterOptionText,
                  filters.status === 'settled' && styles.filterOptionTextSelected
                ]}>
                  Settled
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  filters.status === 'unsettled' && styles.filterOptionSelected
                ]}
                onPress={() => setFilters({...filters, status: 'unsettled'})}
              >
                <Text style={[
                  styles.filterOptionText,
                  filters.status === 'unsettled' && styles.filterOptionTextSelected
                ]}>
                  Unsettled
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          
          <View style={styles.filterActions}>
            <TouchableOpacity
              style={[styles.filterButton, styles.resetButton]}
              onPress={resetFilters}
            >
              <Text style={styles.resetButtonText}>Reset Filters</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.filterButton, styles.applyButton]}
              onPress={() => setFilterModalVisible(false)}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderDeleteModal = () => (
    <Modal
      visible={deleteModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setDeleteModalVisible(false)}
    >
      <View style={styles.deleteModalOverlay}>
        <View style={styles.deleteModalContent}>
          <Ionicons name="warning" size={48} color="#FF9800" style={styles.deleteIcon} />
          <Text style={styles.deleteTitle}>Delete Expense</Text>
          <Text style={styles.deleteMessage}>
            Are you sure you want to delete "{selectedExpense?.label}"?
            This action cannot be undone.
          </Text>
          
          <View style={styles.deleteActions}>
            <TouchableOpacity
              style={[styles.deleteButton, styles.cancelButton]}
              onPress={() => {
                setDeleteModalVisible(false);
                setSelectedExpense(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.deleteButton, styles.confirmDeleteButton]}
              onPress={confirmDeleteExpense}
            >
              <Text style={styles.confirmDeleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.paidBy !== 'all') count++;
    if (filters.splitWith !== 'all') count++;
    if (filters.status !== 'all') count++;
    return count;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading expenses...</Text>
      </View>
    );
  }

  const groupedExpenses = getGroupedExpenses();
  const totalAmount = calculateTotal();
  const activeFilterCount = getActiveFilterCount();

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
        <Text style={styles.headerTitle}>All Expenses</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddExpense}
        >
          <Ionicons name="add" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Search and Filter Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search expenses..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>
        
        <TouchableOpacity
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
          onPress={() => setFilterModalVisible(true)}
        >
          <Ionicons name="filter" size={20} color={activeFilterCount > 0 ? "#007AFF" : "#666"} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}
        </Text>
        <Text style={styles.summaryAmount}>₹{totalAmount.toFixed(2)}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredExpenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons 
              name={searchQuery || activeFilterCount > 0 ? "search" : "receipt-outline"} 
              size={64} 
              color="#ccc" 
            />
            <Text style={styles.emptyStateTitle}>
              {searchQuery || activeFilterCount > 0 ? 'No matching expenses' : 'No expenses yet'}
            </Text>
            <Text style={styles.emptyStateText}>
              {searchQuery || activeFilterCount > 0 
                ? 'Try changing your search or filters' 
                : 'Add your first expense to get started'
              }
            </Text>
            {(searchQuery || activeFilterCount > 0) && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={resetFilters}
              >
                <Text style={styles.clearButtonText}>Clear Search & Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          Object.entries(groupedExpenses).map(([date, dateExpenses]) => (
            <View key={date} style={styles.dateSection}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateTitle}>{date}</Text>
                <Text style={styles.dateTotal}>
                  ₹{dateExpenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)}
                </Text>
              </View>
              
              {dateExpenses.map((expense, index) => {
                const isPaidByUser = expense.userId === auth.currentUser.uid;
                const userInSplit = expense.splitBetween.includes(auth.currentUser.uid);
                const shareAmount = expense.amount / expense.splitBetween.length;
                const isExpenseCreator = expense.userId === auth.currentUser.uid;
                
                return (
                  <TouchableOpacity
                    key={expense.id}
                    style={[
                      styles.expenseCard,
                      index === dateExpenses.length - 1 && styles.lastExpenseCard
                    ]}
                    onPress={() => handleExpensePress(expense)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.expenseIconContainer}>
                      <View style={[
                        styles.expenseIcon,
                        isPaidByUser ? styles.expenseIconPaid : styles.expenseIconShared
                      ]}>
                        <Ionicons 
                          name={isPaidByUser ? "wallet" : "share"} 
                          size={20} 
                          color="#fff" 
                        />
                      </View>
                    </View>
                    
                    <View style={styles.expenseContent}>
                      <View style={styles.expenseHeader}>
                        <Text style={styles.expenseLabel} numberOfLines={1}>
                          {expense.label}
                        </Text>
                        <Text style={styles.expenseAmount}>
                          ₹{expense.amount.toFixed(2)}
                        </Text>
                      </View>
                      
                      <View style={styles.expenseDetails}>
                        <Text style={styles.expenseDetailText}>
                          {isPaidByUser ? 'You paid' : `${getMemberName(expense.userId)} paid`} • 
                          {expense.splitBetween.length} people • 
                          {formatTime(expense.createdAt)}
                        </Text>
                      </View>
                      
                      <View style={styles.expenseFooter}>
                        <View style={styles.expenseTags}>
                          {expense.settled && (
                            <View style={styles.settledTag}>
                              <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
                              <Text style={styles.settledTagText}>Settled</Text>
                            </View>
                          )}
                          
                          {userInSplit && (
                            <View style={styles.splitTag}>
                              <Text style={styles.splitTagText}>
                                Your share: ₹{shareAmount.toFixed(2)}
                              </Text>
                            </View>
                          )}
                        </View>
                        
                        <View style={styles.expenseActions}>
                          {isExpenseCreator && (
                            <TouchableOpacity
                              style={styles.actionButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleDeleteExpense(expense);
                              }}
                            >
                              <Ionicons name="trash-outline" size={18} color="#F44336" />
                            </TouchableOpacity>
                          )}
                          
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleToggleSettle(expense);
                            }}
                          >
                            <Ionicons 
                              name={expense.settled ? "refresh" : "checkmark-circle-outline"} 
                              size={18} 
                              color={expense.settled ? "#FF9800" : "#4CAF50"} 
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      {renderFilterModal()}
      {renderDeleteModal()}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterButtonActive: {
    borderColor: '#007AFF',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  clearButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  dateSection: {
    marginTop: 16,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f8f8',
  },
  dateTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  dateTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  expenseCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 16,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lastExpenseCard: {
    borderBottomWidth: 0,
  },
  expenseIconContainer: {
    marginRight: 12,
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseIconPaid: {
    backgroundColor: '#4CAF50',
  },
  expenseIconShared: {
    backgroundColor: '#FF9800',
  },
  expenseContent: {
    flex: 1,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  expenseLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  expenseDetails: {
    marginBottom: 8,
  },
  expenseDetailText: {
    fontSize: 13,
    color: '#666',
  },
  expenseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  settledTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  settledTagText: {
    fontSize: 11,
    color: '#2E7D32',
    marginLeft: 2,
    fontWeight: '500',
  },
  splitTag: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  splitTagText: {
    fontSize: 11,
    color: '#E65100',
    fontWeight: '500',
  },
  expenseActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 4,
    marginLeft: 8,
  },
  // Filter Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  filterContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  filterOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterOptionSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  filterMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterMemberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  filterMemberAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  filterOptionText: {
    fontSize: 16,
    color: '#333',
  },
  filterOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '500',
  },
  filterActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  resetButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  resetButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  applyButton: {
    backgroundColor: '#007AFF',
  },
  applyButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  // Delete Modal Styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  deleteIcon: {
    marginBottom: 16,
  },
  deleteTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  deleteMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  deleteActions: {
    flexDirection: 'row',
    width: '100%',
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  confirmDeleteButton: {
    backgroundColor: '#F44336',
  },
  confirmDeleteButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
});

export default ExpenseListScreen;