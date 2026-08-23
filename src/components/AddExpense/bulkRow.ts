import { type Group, type SplitType, type User } from '@prisma/client';

import { type CurrencyCode } from '~/lib/currency';
import { type Participant, type SplitShares, calculateParticipantSplit } from '~/store/addStore';
import { type CreateExpense } from '~/types/expense.types';

export interface BulkRow {
  id: string;
  description: string;
  amountStr: string;
  amount: bigint;
  date: Date;
  note: string;
}

export const createRow = (): BulkRow => ({
  id: Math.random().toString(36).slice(2),
  description: '',
  amountStr: '',
  amount: 0n,
  date: new Date(),
  note: '',
});

export const patchBulkRow = (rows: BulkRow[], id: string, patch: Partial<BulkRow>): BulkRow[] =>
  rows.map((row) => (row.id === id ? { ...row, ...patch } : row));

export const removeBulkRow = (rows: BulkRow[], id: string): BulkRow[] =>
  rows.filter((row) => row.id !== id);

export const isValidBulkRow = (row: BulkRow): boolean =>
  0n !== row.amount && '' !== row.description;

export interface BuildBulkExpensesParams {
  rows: BulkRow[];
  currency: CurrencyCode;
  category: string;
  group?: Group;
  splitType: SplitType;
  splitShares: SplitShares;
  participants: Participant[];
  paidBy: User;
}

export const buildBulkExpenses = ({
  rows,
  currency,
  category,
  group,
  splitType,
  splitShares,
  participants,
  paidBy,
}: BuildBulkExpensesParams): CreateExpense[] =>
  rows.filter(isValidBulkRow).map((row) => {
    const { participants: splitParticipants } = calculateParticipantSplit({
      amount: row.amount,
      expenseDate: row.date,
      participants,
      splitType,
      splitShares,
      paidBy,
      isNegative: false,
    });

    return {
      name: row.description,
      currency,
      amount: row.amount,
      groupId: group?.id ?? null,
      splitType,
      participants: splitParticipants.map((p) => ({
        userId: p.id,
        amount: p.amount ?? 0n,
      })),
      paidBy: paidBy.id,
      category,
      expenseDate: row.date,
      note: row.note,
    };
  });
