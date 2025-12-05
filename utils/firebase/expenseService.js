import { db } from '../../firebase';
import { 
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';

// Add a new expense
export const addExpense = async (tripId, expenseData) => {
  try {
    const expenseRef = collection(db, 'expenses');
    const newExpense = {
      ...expenseData,
      tripId,
      createdAt: Timestamp.now(),
      settled: false
    };
    
    const docRef = await addDoc(expenseRef, newExpense);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding expense:', error);
    return { success: false, error: error.message };
  }
};

// Get all expenses for a trip
export const getTripExpenses = async (tripId) => {
  try {
    const expensesRef = collection(db, 'expenses');
    const q = query(
      expensesRef,
      where('tripId', '==', tripId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const expenses = [];
    querySnapshot.forEach((doc) => {
      expenses.push({ id: doc.id, ...doc.data() });
    });
    
    return { success: true, expenses };
  } catch (error) {
    console.error('Error getting expenses:', error);
    return { success: false, error: error.message };
  }
};

// Mark expense as settled
export const settleExpense = async (expenseId) => {
  try {
    const expenseRef = doc(db, 'expenses', expenseId);
    await updateDoc(expenseRef, {
      settled: true,
      settledAt: Timestamp.now()
    });
    return { success: true };
  } catch (error) {
    console.error('Error settling expense:', error);
    return { success: false, error: error.message };
  }
};

// Delete an expense
export const deleteExpense = async (expenseId) => {
  try {
    await deleteDoc(doc(db, 'expenses', expenseId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting expense:', error);
    return { success: false, error: error.message };
  }
};

// Get settlement calculations for a trip
export const calculateBalances = (expenses, members, currentUserId) => {
  // Initialize balances for each member
  const balances = {};
  members.forEach(member => {
    balances[member.id] = 0;
  });

  // Calculate net balances
  expenses.forEach(expense => {
    if (!expense.settled) {
      const amountPerPerson = expense.amount / expense.splitBetween.length;
      
      // Person who paid gets positive balance
      balances[expense.userId] += expense.amount;
      
      // People who owe get negative balance
      expense.splitBetween.forEach(userId => {
        balances[userId] -= amountPerPerson;
      });
    }
  });

  // Separate into "owes" and "owed"
  const userOwes = [];
  const userOwed = [];

  Object.entries(balances).forEach(([userId, balance]) => {
    if (Math.abs(balance) > 0.01) { // Small threshold to avoid floating point errors
      if (balance > 0) {
        userOwed.push({ userId, amount: balance });
      } else {
        userOwes.push({ userId, amount: -balance });
      }
    }
  });

  // Calculate who owes whom (simplified settlement algorithm)
  const settlements = [];
  
  // Sort by amount descending
  userOwed.sort((a, b) => b.amount - a.amount);
  userOwes.sort((a, b) => b.amount - a.amount);

  let i = 0, j = 0;
  while (i < userOwed.length && j < userOwes.length) {
    const owed = userOwed[i];
    const owes = userOwes[j];
    
    const settlementAmount = Math.min(owed.amount, owes.amount);
    
    settlements.push({
      fromUserId: owes.userId,
      toUserId: owed.userId,
      amount: parseFloat(settlementAmount.toFixed(2))
    });
    
    owed.amount -= settlementAmount;
    owes.amount -= settlementAmount;
    
    if (owed.amount < 0.01) i++;
    if (owes.amount < 0.01) j++;
  }

  // Calculate current user's specific balances
  const userSpecificSettlements = settlements.filter(s => 
    s.fromUserId === currentUserId || s.toUserId === currentUserId
  );

  // Calculate total amount user owes and is owed
  const userOwesTotal = userOwes
    .filter(item => item.userId === currentUserId)
    .reduce((sum, item) => sum + item.amount, 0);

  const userOwedTotal = userOwed
    .filter(item => item.userId === currentUserId)
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    balances,
    settlements,
    userSpecificSettlements,
    userOwesTotal,
    userOwedTotal,
    netBalance: parseFloat((userOwedTotal - userOwesTotal).toFixed(2))
  };
};

// Get user's expenses summary
export const getUserExpenseSummary = (expenses, userId) => {
  let totalPaid = 0;
  let totalOwed = 0;
  let personalExpenses = 0;

  expenses.forEach(expense => {
    if (expense.userId === userId) {
      totalPaid += expense.amount;
      if (expense.splitBetween.length === 1 && expense.splitBetween[0] === userId) {
        personalExpenses += expense.amount;
      }
    }
    
    if (expense.splitBetween.includes(userId)) {
      const share = expense.amount / expense.splitBetween.length;
      totalOwed += share;
    }
  });

  return {
    totalPaid: parseFloat(totalPaid.toFixed(2)),
    totalOwed: parseFloat(totalOwed.toFixed(2)),
    personalExpenses: parseFloat(personalExpenses.toFixed(2)),
    netSpent: parseFloat((totalPaid - totalOwed).toFixed(2))
  };
};

// Add a settlement
export const addSettlement = async (tripId, settlementData) => {
  try {
    const settlementsRef = collection(db, 'settlements');
    const newSettlement = {
      ...settlementData,
      tripId,
      createdAt: Timestamp.now(),
      settled: false
    };
    
    const docRef = await addDoc(settlementsRef, newSettlement);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding settlement:', error);
    return { success: false, error: error.message };
  }
};

// Mark settlement as done
export const markSettlementDone = async (settlementId) => {
  try {
    const settlementRef = doc(db, 'settlements', settlementId);
    await updateDoc(settlementRef, {
      settled: true,
      settledAt: Timestamp.now()
    });
    return { success: true };
  } catch (error) {
    console.error('Error marking settlement done:', error);
    return { success: false, error: error.message };
  }
};

// Real-time listener for expenses
export const subscribeToTripExpenses = (tripId, callback) => {
  const expensesRef = collection(db, 'expenses');
  const q = query(
    expensesRef,
    where('tripId', '==', tripId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const expenses = [];
    snapshot.forEach((doc) => {
      expenses.push({ id: doc.id, ...doc.data() });
    });
    callback(expenses);
  });
};

export default {
  addExpense,
  getTripExpenses,
  settleExpense,
  deleteExpense,
  calculateBalances,
  getUserExpenseSummary,
  addSettlement,
  markSettlementDone,
  subscribeToTripExpenses
};