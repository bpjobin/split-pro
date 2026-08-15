import { Plus, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { calculateParticipantSplit, useAddExpenseStore } from '~/store/addStore';
import { type CreateExpense } from '~/types/expense.types';
import { api } from '~/utils/api';

import { toast } from 'sonner';
import { Button } from '../ui/button';
import { CurrencyInput } from '../ui/currency-input';
import { AppDrawer } from '../ui/drawer';
import { Input } from '../ui/input';
import { DateSelector } from './DateSelector';

interface BulkRow {
  id: string;
  description: string;
  amountStr: string;
  amount: bigint;
  date: Date;
}

const createRow = (): BulkRow => ({
  id: Math.random().toString(36).slice(2),
  description: '',
  amountStr: '',
  amount: 0n,
  date: new Date(),
});

const BulkAddExpense: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, getCurrencyHelpersCached } = useTranslationWithUtils();
  const group = useAddExpenseStore((s) => s.group);
  const paidBy = useAddExpenseStore((s) => s.paidBy);
  const participants = useAddExpenseStore((s) => s.participants);
  const category = useAddExpenseStore((s) => s.category);
  const currency = useAddExpenseStore((s) => s.currency);
  const splitType = useAddExpenseStore((s) => s.splitType);
  const splitShares = useAddExpenseStore((s) => s.splitShares);

  const addExpenseMutation = api.expense.addOrEditExpense.useMutation();
  const utils = api.useUtils();

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<BulkRow[]>([]);

  const updateRow = useCallback((id: string, patch: Partial<BulkRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      setRows([createRow()]);
    }
  }, []);

  const submitAll = useCallback(async () => {
    if (!paidBy) {
      return;
    }

    const validRows = rows.filter((row) => 0n !== row.amount && '' !== row.description);

    if (0 === validRows.length) {
      toast.error(t('expense_details.bulk_add.add_row_required'));
      return;
    }

    const expenses: CreateExpense[] = validRows.map((row) => {
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
      };
    });

    try {
      await addExpenseMutation.mutateAsync(expenses);
      setRows([createRow()]);
      toast.success(t('expense_details.add_expense_details.add_new_expense'));
      await utils.expense.invalidate();
      await utils.group.invalidate();
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  }, [
    paidBy,
    rows,
    participants,
    splitType,
    splitShares,
    currency,
    group,
    category,
    addExpenseMutation,
    utils,
    t,
  ]);

  const amountStrCache = useCallback(
    (amount: bigint) => getCurrencyHelpersCached(currency).toUIString(amount),
    [currency, getCurrencyHelpersCached],
  );

  return (
    <AppDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={t('expense_details.bulk_add.title')}
      actionTitle={t('expense_details.bulk_add.submit_all')}
      actionOnClick={submitAll}
      actionDisabled={addExpenseMutation.isPending}
      shouldCloseOnAction={false}
      trigger={children}
    >
      <div className="flex flex-col gap-4">
        {rows.map((row) => (
          <div key={row.id} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-start gap-2">
              <Input
                placeholder={t('expense_details.bulk_add.row_placeholder')}
                value={row.description}
                onChange={(e) => updateRow(row.id, { description: e.target.value })}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeRow(row.id)}
                disabled={1 === rows.length}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <CurrencyInput
                currency={currency}
                strValue={row.amountStr}
                allowNegative
                hideSymbol
                onValueChange={({ strValue, bigIntValue }) =>
                  updateRow(row.id, {
                    amountStr: strValue ?? amountStrCache(row.amount),
                    amount: bigIntValue ?? row.amount,
                  })
                }
                className="flex-1"
              />
              <DateSelector
                mode="single"
                required
                selected={row.date}
                onSelect={(date?: Date) => date && updateRow(row.id, { date })}
              />
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={() => setRows((prev) => [...prev, createRow()])}>
          <Plus className="size-4" />
          {t('expense_details.bulk_add.add_row')}
        </Button>
      </div>
    </AppDrawer>
  );
};

export default BulkAddExpense;
