import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { addExpense } from '../../utils/firebase/expenseService';
import { getTripMembersWithProfiles } from '../../utils/firebase/memberService';

const AddExpenseScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const auth = getAuth();
  
  const { tripId, members: routeMembers } = route.params;
  
  const [trip, setTrip] = useState(null);
  const [members, setMembers] = useState(routeMembers || []);
  const [loading, setLoading] = useState(!routeMembers);
  const [submitting, setSubmitting] = useState(false);
  
  // Expense form state
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(auth.currentUser.uid);
  const [splitBetween, setSplitBetween] = useState({});
  
  // Validation
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (routeMembers) {
      // Initialize split between with all members selected
      const initialSplit = {};
      routeMembers.forEach(member => {
        initialSplit[member.id] = true;
      });
      setSplitBetween(initialSplit);
      setLoading(false);
    } else {
      fetchTripData();
    }
  }, []);

  const fetchTripData = async () => {
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
      const formattedMembers = membersWithProfiles.map(member => ({
        id: member.id,
        name: member.displayName || member.email,
        avatar: member.photoURL,
        isCurrentUser: member.id === auth.currentUser.uid
      }));
      
      setMembers(formattedMembers);
      
      // Initialize split between with all members selected
      const initialSplit = {};
      formattedMembers.forEach(member => {
        initialSplit[member.id] = true;
      });
      setSplitBetween(initialSplit);
      
      // Set current user as default payer
      setPaidBy(auth.currentUser.uid);
      
    } catch (error) {
      console.error('Error fetching trip data:', error);
      Alert.alert('Error', 'Failed to load trip data');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!label.trim()) {
      newErrors.label = 'Expense name is required';
    }
    
    if (!amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        newErrors.amount = 'Please enter a valid amount';
      }
    }
    
    // Check if at least one person is selected for splitting
    const selectedCount = Object.values(splitBetween).filter(val => val).length;
    if (selectedCount === 0) {
      newErrors.split = 'Select at least one person';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSplitToggle = (memberId) => {
    setSplitBetween(prev => ({
      ...prev,
      [memberId]: !prev[memberId]
    }));
  };

  const handleSelectAll = () => {
    const newSplit = {};
    members.forEach(member => {
      newSplit[member.id] = true;
    });
    setSplitBetween(newSplit);
  };

  const handleSelectNone = () => {
    const newSplit = {};
    members.forEach(member => {
      newSplit[member.id] = false;
    });
    setSplitBetween(newSplit);
  };

  const calculateShare = () => {
    if (!amount) return 0;
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum)) return 0;
    
    const selectedCount = Object.values(splitBetween).filter(val => val).length;
    if (selectedCount === 0) return 0;
    
    return (amountNum / selectedCount).toFixed(2);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const amountNum = parseFloat(amount);
      
      // Get selected members for splitting
      const selectedMembers = Object.entries(splitBetween)
        .filter(([_, isSelected]) => isSelected)
        .map(([memberId]) => memberId);
      
      const expenseData = {
        label: label.trim(),
        amount: amountNum,
        userId: paidBy,
        splitBetween: selectedMembers,
        date: new Date()
      };

      const result = await addExpense(tripId, expenseData);
      
      if (result.success) {
        Alert.alert(
          'Success!',
          'Expense added successfully',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.navigate('BillTracker', { tripId });
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to add expense');
      }
    } catch (error) {
      console.error('Error adding expense:', error);
      Alert.alert('Error', 'Failed to add expense');
    } finally {
      setSubmitting(false);
    }
  };

  const getMemberInitials = (memberName) => {
    return memberName.charAt(0).toUpperCase();
  };

  const getSelectedCount = () => {
    return Object.values(splitBetween).filter(val => val).length;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Expense</Text>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Expense Details Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="receipt" size={20} color="#FF9800" />
              <Text style={styles.cardTitle}>Expense Details</Text>
            </View>
            
            {/* Expense Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>What was this for? *</Text>
              <TextInput
                style={[styles.input, errors.label && styles.inputError]}
                placeholder="e.g., Dinner, Fuel, Hotel"
                value={label}
                onChangeText={(text) => {
                  setLabel(text);
                  if (errors.label) setErrors({...errors, label: null});
                }}
                maxLength={100}
                autoFocus
              />
              {errors.label && (
                <Text style={styles.errorText}>{errors.label}</Text>
              )}
            </View>
            
            {/* Amount */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Amount (₹) *</Text>
              <View style={styles.amountContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={[styles.amountInput, errors.amount && styles.inputError]}
                  placeholder="0.00"
                  value={amount}
                  onChangeText={(text) => {
                    // Allow only numbers and one decimal point
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    const parts = cleaned.split('.');
                    if (parts.length > 2) {
                      // Only allow one decimal point
                      setAmount(parts[0] + '.' + parts.slice(1).join(''));
                    } else {
                      setAmount(cleaned);
                    }
                    if (errors.amount) setErrors({...errors, amount: null});
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
              {errors.amount && (
                <Text style={styles.errorText}>{errors.amount}</Text>
              )}
            </View>
            
            {/* Paid By */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Paid by *</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.paidByScroll}
              >
                <View style={styles.paidByContainer}>
                  {members.map(member => (
                    <TouchableOpacity
                      key={member.id}
                      style={[
                        styles.paidByOption,
                        paidBy === member.id && styles.paidByOptionSelected
                      ]}
                      onPress={() => setPaidBy(member.id)}
                    >
                      <View style={[
                        styles.paidByAvatar,
                        paidBy === member.id && styles.paidByAvatarSelected
                      ]}>
                        {member.avatar ? (
                          <Image source={{ uri: member.avatar }} style={styles.avatarImage} />
                        ) : (
                          <Text style={styles.paidByAvatarText}>
                            {getMemberInitials(member.name)}
                          </Text>
                        )}
                      </View>
                      <Text 
                        style={[
                          styles.paidByName,
                          paidBy === member.id && styles.paidByNameSelected
                        ]}
                        numberOfLines={1}
                      >
                        {member.id === auth.currentUser.uid ? 'You' : member.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>

          {/* Split Between Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="people" size={20} color="#4CAF50" />
              <Text style={styles.cardTitle}>Split Between</Text>
              <View style={styles.splitHeaderActions}>
                <TouchableOpacity onPress={handleSelectAll}>
                  <Text style={styles.splitActionText}>All</Text>
                </TouchableOpacity>
                <Text style={styles.splitDivider}>•</Text>
                <TouchableOpacity onPress={handleSelectNone}>
                  <Text style={styles.splitActionText}>None</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {errors.split && (
              <Text style={styles.errorText}>{errors.split}</Text>
            )}
            
            <View style={styles.splitContainer}>
              {members.map(member => {
                const isSelected = splitBetween[member.id];
                const share = isSelected && amount ? calculateShare() : 0;
                
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      styles.splitMemberCard,
                      isSelected && styles.splitMemberCardSelected
                    ]}
                    onPress={() => handleSplitToggle(member.id)}
                  >
                    <View style={styles.splitMemberInfo}>
                      <View style={[
                        styles.splitMemberAvatar,
                        isSelected && styles.splitMemberAvatarSelected
                      ]}>
                        {member.avatar ? (
                          <Image source={{ uri: member.avatar }} style={styles.avatarImage} />
                        ) : (
                          <Text style={styles.splitMemberAvatarText}>
                            {getMemberInitials(member.name)}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.splitMemberName}>
                        {member.id === auth.currentUser.uid ? 'You' : member.name}
                        {member.id === paidBy && (
                          <Text style={styles.payerBadge}> • Paid</Text>
                        )}
                      </Text>
                    </View>
                    
                    <View style={styles.splitMemberActions}>
                      {isSelected && amount && (
                        <Text style={styles.shareAmount}>
                          ₹{share}
                        </Text>
                      )}
                      <View style={[
                        styles.checkbox,
                        isSelected && styles.checkboxSelected
                      ]}>
                        {isSelected && (
                          <Ionicons name="checkmark" size={16} color="white" />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            {/* Summary */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Selected</Text>
                <Text style={styles.summaryValue}>
                  {getSelectedCount()} of {members.length}
                </Text>
              </View>
              {amount && getSelectedCount() > 0 && (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Amount</Text>
                    <Text style={styles.summaryValue}>₹{parseFloat(amount).toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Share per person</Text>
                    <Text style={styles.summaryValue}>₹{calculateShare()}</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Quick Tips */}
          <View style={styles.tipsCard}>
            <Ionicons name="bulb" size={20} color="#FF9800" />
            <View style={styles.tipsContent}>
              <Text style={styles.tipsTitle}>Tips</Text>
              <Text style={styles.tipsText}>
                • Include taxes and tips in the amount{'\n'}
                • Use clear names like "Dinner at Restaurant"{'\n'}
                • Select all members who should share this expense
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
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
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#f8f8f8',
  },
  inputError: {
    borderColor: '#F44336',
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 4,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: 'bold',
    backgroundColor: '#f8f8f8',
  },
  paidByScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  paidByContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  paidByOption: {
    alignItems: 'center',
    marginRight: 16,
    padding: 8,
    borderRadius: 8,
  },
  paidByOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  paidByAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  paidByAvatarSelected: {
    backgroundColor: '#007AFF',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  paidByAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
  },
  paidByName: {
    fontSize: 14,
    color: '#666',
    maxWidth: 80,
    textAlign: 'center',
  },
  paidByNameSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  splitHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splitActionText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  splitDivider: {
    marginHorizontal: 8,
    color: '#999',
  },
  splitContainer: {
    marginTop: 8,
  },
  splitMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  splitMemberCardSelected: {
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  splitMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  splitMemberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  splitMemberAvatarSelected: {
    backgroundColor: '#4CAF50',
  },
  splitMemberAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  splitMemberName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  payerBadge: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  splitMemberActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  summaryContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tipsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  tipsContent: {
    flex: 1,
    marginLeft: 12,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
});

export default AddExpenseScreen;