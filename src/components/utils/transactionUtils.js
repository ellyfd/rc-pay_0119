import { z } from 'zod';

/**
 * Zod schema for single transaction validation
 */
export const transactionSchema = z.object({
  type: z.enum(['deposit', 'withdraw', 'transfer']),
  amount: z.number().positive('金額必須為正數'),
  wallet_type: z.enum(['balance', 'cash']),
  from_member_id: z.string().nullable().optional(),
  to_member_id: z.string().nullable().optional(),
  note: z.string().optional(),
}).refine(
  (data) => {
    if (data.type === 'deposit') return !!data.to_member_id;
    if (data.type === 'withdraw') return !!data.from_member_id;
    if (data.type === 'transfer') return !!data.from_member_id && !!data.to_member_id && data.from_member_id !== data.to_member_id;
    return false;
  },
  { message: '請選擇有效的交易對象' }
);

/**
 * Zod schema for member creation validation
 */
export const memberSchema = z.object({
  name: z.string().trim().min(1, '請輸入成員姓名').max(20, '姓名最多 20 個字'),
});

/**
 * Zod schema for batch transaction item validation
 */
export const batchItemSchema = z.object({
  member_id: z.string().min(1, '請選擇成員'),
  amount: z.number().positive('金額必須為正數'),
});

/**
 * Calculate new balance after a transaction.
 * Returns the updated balance value.
 */
export function calculateNewBalance(currentBalance, amount, isDeposit) {
  return isDeposit ? currentBalance + amount : currentBalance - amount;
}

/**
 * Calculate balances for batch transactions.
 * Tracks cumulative balance changes across multiple transactions.
 *
 * @param {Array} transactions - Array of { member_id, amount, type, wallet_type }
 * @param {Map} memberMap - Map<memberId, memberData>
 * @returns {Map} Map of `${memberId}_${balanceField}` → newBalance
 */
export function calculateBatchBalances(transactions, memberMap) {
  const updatedBalances = new Map();

  const getLatestBalance = (memberId, field) => {
    const key = `${memberId}_${field}`;
    if (updatedBalances.has(key)) return updatedBalances.get(key);
    const member = memberMap.get(memberId);
    return member ? (member[field] || 0) : 0;
  };

  for (const item of transactions) {
    const isDeposit = item.type === 'deposit';
    const balanceField = item.wallet_type === 'cash' ? 'cash_balance' : 'balance';
    const amount = item.amount || 0;
    const currentBalance = getLatestBalance(item.member_id, balanceField);
    const newBalance = calculateNewBalance(currentBalance, amount, isDeposit);
    updatedBalances.set(`${item.member_id}_${balanceField}`, newBalance);
  }

  return updatedBalances;
}

/**
 * Validate a single transaction's data before submission.
 * Returns { success: true, data } or { success: false, error: string }
 */
export function validateTransaction(data) {
  const result = transactionSchema.safeParse(data);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message || '資料驗證失敗' };
  }
  return { success: true, data: result.data };
}
