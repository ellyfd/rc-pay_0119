import { describe, it, expect } from 'vitest';
import {
  calculateNewBalance,
  calculateBatchBalances,
  validateTransaction,
  memberSchema,
  batchItemSchema,
} from '../transactionUtils';

describe('calculateNewBalance', () => {
  it('should add amount for deposit', () => {
    expect(calculateNewBalance(100, 50, true)).toBe(150);
  });

  it('should subtract amount for withdrawal', () => {
    expect(calculateNewBalance(100, 30, false)).toBe(70);
  });

  it('should allow negative balance (overdraft)', () => {
    expect(calculateNewBalance(10, 50, false)).toBe(-40);
  });

  it('should handle zero balance', () => {
    expect(calculateNewBalance(0, 100, true)).toBe(100);
    expect(calculateNewBalance(0, 100, false)).toBe(-100);
  });
});

describe('calculateBatchBalances', () => {
  it('should track cumulative balance changes', () => {
    const memberMap = new Map([
      ['m1', { id: 'm1', balance: 500, cash_balance: 100 }],
      ['m2', { id: 'm2', balance: 300, cash_balance: 200 }],
    ]);

    const transactions = [
      { member_id: 'm1', amount: 50, type: 'withdraw', wallet_type: 'balance' },
      { member_id: 'm1', amount: 30, type: 'withdraw', wallet_type: 'balance' },
      { member_id: 'm2', amount: 100, type: 'deposit', wallet_type: 'balance' },
    ];

    const result = calculateBatchBalances(transactions, memberMap);

    expect(result.get('m1_balance')).toBe(420); // 500 - 50 - 30
    expect(result.get('m2_balance')).toBe(400); // 300 + 100
  });

  it('should handle cash wallet separately from balance wallet', () => {
    const memberMap = new Map([
      ['m1', { id: 'm1', balance: 500, cash_balance: 100 }],
    ]);

    const transactions = [
      { member_id: 'm1', amount: 50, type: 'withdraw', wallet_type: 'balance' },
      { member_id: 'm1', amount: 20, type: 'withdraw', wallet_type: 'cash' },
    ];

    const result = calculateBatchBalances(transactions, memberMap);

    expect(result.get('m1_balance')).toBe(450);
    expect(result.get('m1_cash_balance')).toBe(80);
  });

  it('should handle missing member gracefully (balance defaults to 0)', () => {
    const memberMap = new Map();

    const transactions = [
      { member_id: 'm1', amount: 50, type: 'withdraw', wallet_type: 'balance' },
    ];

    const result = calculateBatchBalances(transactions, memberMap);
    expect(result.get('m1_balance')).toBe(-50);
  });
});

describe('validateTransaction', () => {
  it('should validate a valid deposit', () => {
    const result = validateTransaction({
      type: 'deposit',
      amount: 100,
      wallet_type: 'balance',
      to_member_id: 'm1',
    });
    expect(result.success).toBe(true);
  });

  it('should reject deposit without to_member_id', () => {
    const result = validateTransaction({
      type: 'deposit',
      amount: 100,
      wallet_type: 'balance',
    });
    expect(result.success).toBe(false);
  });

  it('should reject zero amount', () => {
    const result = validateTransaction({
      type: 'deposit',
      amount: 0,
      wallet_type: 'balance',
      to_member_id: 'm1',
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative amount', () => {
    const result = validateTransaction({
      type: 'withdraw',
      amount: -50,
      wallet_type: 'balance',
      from_member_id: 'm1',
    });
    expect(result.success).toBe(false);
  });

  it('should reject transfer to same member', () => {
    const result = validateTransaction({
      type: 'transfer',
      amount: 50,
      wallet_type: 'balance',
      from_member_id: 'm1',
      to_member_id: 'm1',
    });
    expect(result.success).toBe(false);
  });

  it('should validate a valid transfer', () => {
    const result = validateTransaction({
      type: 'transfer',
      amount: 50,
      wallet_type: 'balance',
      from_member_id: 'm1',
      to_member_id: 'm2',
    });
    expect(result.success).toBe(true);
  });

  it('should validate a valid withdrawal', () => {
    const result = validateTransaction({
      type: 'withdraw',
      amount: 50,
      wallet_type: 'cash',
      from_member_id: 'm1',
    });
    expect(result.success).toBe(true);
  });
});

describe('memberSchema', () => {
  it('should accept a valid name', () => {
    expect(memberSchema.safeParse({ name: '小明' }).success).toBe(true);
  });

  it('should reject empty name', () => {
    expect(memberSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('should reject whitespace-only name', () => {
    expect(memberSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('should reject name longer than 20 chars', () => {
    expect(memberSchema.safeParse({ name: 'a'.repeat(21) }).success).toBe(false);
  });

  it('should trim whitespace', () => {
    const result = memberSchema.safeParse({ name: '  小明  ' });
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('小明');
  });
});

describe('batchItemSchema', () => {
  it('should accept valid batch item', () => {
    expect(batchItemSchema.safeParse({ member_id: 'm1', amount: 100 }).success).toBe(true);
  });

  it('should reject missing member_id', () => {
    expect(batchItemSchema.safeParse({ member_id: '', amount: 100 }).success).toBe(false);
  });

  it('should reject zero amount', () => {
    expect(batchItemSchema.safeParse({ member_id: 'm1', amount: 0 }).success).toBe(false);
  });
});
