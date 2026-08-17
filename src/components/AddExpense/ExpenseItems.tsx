import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { useAddExpenseStore } from '~/store/addStore';
import { cn } from '~/lib/utils';

const ItemAmountInput: React.FC<{
  value: bigint;
  currency: string;
  onCommit: (amount: bigint) => void;
  placeholder: string;
}> = ({ value, currency, onCommit, placeholder }) => {
  const { getCurrencyHelpersCached } = useTranslationWithUtils();
  const { toUIString, sanitizeInput } = getCurrencyHelpersCached(currency);
  const [localValue, setLocalValue] = useState(value === 0n ? '' : toUIString(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setLocalValue(value === 0n ? '' : toUIString(value));
    }
  }, [value, toUIString]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);
  }, []);

  const commitValue = useCallback(() => {
    focusedRef.current = false;
    const sanitized = sanitizeInput(localValue);
    if (sanitized !== '') {
      try {
        const parsed = BigInt(sanitized);
        if (parsed !== value) {
          onCommit(parsed);
        }
        setLocalValue(toUIString(parsed));
        return;
      } catch {
        // Invalid input, revert
      }
    }
    if (value === 0n) {
      setLocalValue('');
    } else {
      setLocalValue(toUIString(value));
    }
  }, [localValue, sanitizeInput, onCommit, value, toUIString]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={localValue}
      onChange={handleChange}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={commitValue}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder={placeholder}
      className="w-24 bg-transparent text-right text-sm"
    />
  );
};

export const ExpenseItems: React.FC = () => {
  const { t, getCurrencyHelpersCached } = useTranslationWithUtils();
  const items = useAddExpenseStore((s) => s.items);
  const currency = useAddExpenseStore((s) => s.currency);
  const addItem = useAddExpenseStore((s) => s.actions.addItem);
  const removeItem = useAddExpenseStore((s) => s.actions.removeItem);
  const updateItem = useAddExpenseStore((s) => s.actions.updateItem);
  const toggleItemExcluded = useAddExpenseStore((s) => s.actions.toggleItemExcluded);
  const setAmount = useAddExpenseStore((s) => s.actions.setAmount);
  const setAmountStr = useAddExpenseStore((s) => s.actions.setAmountStr);

  const { toUIString } = getCurrencyHelpersCached(currency);

  const includedTotal = useMemo(
    () => items.filter((item) => !item.excluded).reduce((sum, item) => sum + item.amount, 0n),
    [items],
  );

  // Auto-sync expense total from included items
  const prevItemCountRef = useRef(items.length);
  useEffect(() => {
    if (items.length > 0 && includedTotal > 0n) {
      setAmount(includedTotal);
      setAmountStr(toUIString(includedTotal, false, true));
    }
    prevItemCountRef.current = items.length;
  }, [includedTotal, items.length, setAmount, setAmountStr, toUIString]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t('items.title')}</h3>
        <Button variant="ghost" size="sm" onClick={addItem} className="h-7 px-2 text-xs">
          <Plus className="mr-1 size-3" />
          {t('items.add_item')}
        </Button>
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-2 rounded-lg border p-2',
                item.excluded && 'opacity-50',
              )}
            >
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateItem(item.id, { name: e.target.value })}
                placeholder={t('items.name_placeholder')}
                className="min-w-0 flex-1 bg-transparent text-sm"
              />
              <ItemAmountInput
                value={item.amount}
                currency={currency}
                onCommit={(amount) => updateItem(item.id, { amount })}
                placeholder={t('items.amount_placeholder')}
              />
              <button
                type="button"
                onClick={() => toggleItemExcluded(item.id)}
                className={cn(
                  'shrink-0 rounded p-1 transition-colors',
                  item.excluded
                    ? 'text-amber-500 hover:bg-amber-500/10'
                    : 'text-gray-400 hover:bg-gray-400/10 hover:text-gray-600',
                )}
                title={item.excluded ? t('items.include') : t('items.exclude')}
              >
                {item.excluded ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-sm text-gray-500">{t('items.total_included')}</span>
          <span className="text-sm font-medium">{toUIString(includedTotal)}</span>
        </div>
      )}
    </div>
  );
};
