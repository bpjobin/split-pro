import { useRouter } from 'next/router';
import { useCallback } from 'react';

import { calculateParticipantSplit, useAddExpenseStore } from '~/store/addStore';
import { type CreateExpense } from '~/types/expense.types';
import { api } from '~/utils/api';

export const useAddMultipleTransactions = () => {
  const participants = useAddExpenseStore((s) => s.participants);
  const group = useAddExpenseStore((s) => s.group);
  const category = useAddExpenseStore((s) => s.category);
  const isExpenseSettled = useAddExpenseStore((s) => s.canSplitScreenClosed);
  const splitShares = useAddExpenseStore((s) => s.splitShares);
  const paidBy = useAddExpenseStore((s) => s.paidBy);
  const splitType = useAddExpenseStore((s) => s.splitType);
  const fileKey = useAddExpenseStore((s) => s.fileKey);
  const multipleTransactions = useAddExpenseStore((s) => s.multipleTransactions);
  const isTransactionLoading = useAddExpenseStore((s) => s.isTransactionLoading);

  const {
    resetState,
    setSplitScreenOpen,
    setMultipleTransactions,
    setIsTransactionLoading,
    setSingleTransaction,
    setAmount,
    setDescription,
    setAmountStr,
    setTransactionId,
    setExpenseDate,
  } = useAddExpenseStore((s) => s.actions);

  const addExpenseMutation = api.expense.addOrEditExpense.useMutation();

  const router = useRouter();

  const addAllMultipleExpenses = useCallback(async () => {
    setIsTransactionLoading(true);

    if (!paidBy) {
      return;
    }

    if (!isExpenseSettled) {
      setSplitScreenOpen(true);
      return;
    }

    const seen = new Set();

    const expenses = multipleTransactions
      .filter((item) => {
        if (seen.has(item.transactionId)) {
          return false;
        }
        seen.add(item.transactionId);
        return true;
      })
      .map((tempItem) => {
        const tempExpense: CreateExpense = {
          name: tempItem.description,
          currency: tempItem.currency,
          amount: tempItem.amount,
          groupId: group?.id ?? null,
          splitType,
          paidBy: paidBy.id,
          participants: participants.map((p) => ({
            userId: p.id,
            amount: p.amount ?? 0n,
          })),
          category,
          fileKey,
          expenseDate: tempItem.date,
          transactionId: tempItem.transactionId,
        };

        const { participants: tempParticipants } = calculateParticipantSplit({
          amount: tempExpense.amount,
          expenseDate: tempExpense.expenseDate as Date,
          participants: participants,
          splitType: tempExpense.splitType,
          splitShares,
          paidBy,
          isNegative: false,
        });

        return {
          ...tempExpense,
          participants: tempParticipants.map((p) => ({
            userId: p.id,
            amount: p.amount ?? 0n,
          })),
        };
      }) as CreateExpense[];

    await addExpenseMutation.mutateAsync(expenses, {
      onSuccess: () => {
        setMultipleTransactions([]);
        setIsTransactionLoading(false);
        router.back();
        resetState();
      },
      onError: () => {
        setIsTransactionLoading(false);
      },
    });
  }, [
    setSplitScreenOpen,
    router,
    resetState,
    addExpenseMutation,
    group,
    paidBy,
    splitType,
    fileKey,
    isExpenseSettled,
    multipleTransactions,
    participants,
    category,
    setIsTransactionLoading,
    splitShares,
    setMultipleTransactions,
  ]);

  const addOneByOneMultipleExpenses = useCallback(() => {
    const allTransactions = [...multipleTransactions];
    const transactionToAdd = allTransactions.pop();
    if (transactionToAdd) {
      setMultipleTransactions(allTransactions);
      setSingleTransaction(transactionToAdd);
    }
  }, [multipleTransactions, setMultipleTransactions, setSingleTransaction]);

  const clearFields = useCallback(() => {
    setAmount(0n);
    setDescription('');
    setAmountStr('');
    setTransactionId();
    setExpenseDate(new Date());
  }, [setAmount, setDescription, setAmountStr, setTransactionId, setExpenseDate]);

  return {
    addAllMultipleExpenses,
    addOneByOneMultipleExpenses,
    clearFields,
    multipleTransactions,
    setMultipleTransactions,
    isTransactionLoading,
    setIsTransactionLoading,
    setSingleTransaction,
  };
};
