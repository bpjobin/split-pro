import { Plus, Trash2 } from 'lucide-react';
import { useCallback } from 'react';

import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { useAddExpenseStore } from '~/store/addStore';

import { Button } from '../ui/button';
import { CurrencyInput } from '../ui/currency-input';
import { Input } from '../ui/input';
import { type BulkRow } from './bulkRow';
import { DateSelector } from './DateSelector';

interface BulkAddExpenseContentProps {
  rows: BulkRow[];
  onPatchRow: (id: string, patch: Partial<BulkRow>) => void;
  onRemoveRow: (id: string) => void;
  onAddRow: () => void;
}

export const BulkAddExpenseContent: React.FC<BulkAddExpenseContentProps> = ({
  rows,
  onPatchRow,
  onRemoveRow,
  onAddRow,
}) => {
  const { t, getCurrencyHelpersCached } = useTranslationWithUtils();
  const currency = useAddExpenseStore((s) => s.currency);

  const amountStrCache = useCallback(
    (amount: bigint) => getCurrencyHelpersCached(currency).toUIString(amount),
    [currency, getCurrencyHelpersCached],
  );

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <div key={row.id} className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-start gap-2">
            <Input
              placeholder={t('expense_details.bulk_add.row_placeholder')}
              value={row.description}
              onChange={(e) => onPatchRow(row.id, { description: e.target.value })}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemoveRow(row.id)}
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
                onPatchRow(row.id, {
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
              onSelect={(date?: Date) => date && onPatchRow(row.id, { date })}
            />
          </div>
          <Input
            placeholder={t('expense_details.add_expense_details.note_placeholder')}
            value={row.note}
            onChange={(e) => onPatchRow(row.id, { note: e.target.value })}
            className="text-sm"
          />
        </div>
      ))}
      <Button variant="outline" onClick={onAddRow}>
        <Plus className="size-4" />
        {t('expense_details.bulk_add.add_row')}
      </Button>
    </div>
  );
};
