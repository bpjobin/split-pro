import { Loader2, ScanLine } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { useAddExpenseStore } from '~/store/addStore';
import { api } from '~/utils/api';

interface ScanReceiptButtonProps {
  fileKey?: string;
  expenseId?: string;
  onItemsAdded?: () => void;
}

export const ScanReceiptButton: React.FC<ScanReceiptButtonProps> = ({
  fileKey,
  expenseId,
  onItemsAdded,
}) => {
  const { t } = useTranslationWithUtils();
  const [isScanning, setIsScanning] = useState(false);
  const setItems = useAddExpenseStore((s) => s.actions.setItems);
  const items = useAddExpenseStore((s) => s.items);

  const addItemsMutation = api.expense.addItemsToExpense.useMutation({
    onSuccess: () => {
      toast.success(t('scan_receipt.success', { count: lastCountRef.current }));
      onItemsAdded?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const lastCountRef = React.useRef(0);

  const handleScan = useCallback(async () => {
    if (!fileKey) {
      return;
    }

    setIsScanning(true);
    try {
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to scan receipt');
      }

      const data = (await response.json()) as {
        items: { name: string; amount: bigint }[];
      };

      if (data.items.length === 0) {
        toast.warning(t('scan_receipt.no_items'));
        return;
      }

      lastCountRef.current = data.items.length;

      if (expenseId) {
        // Existing expense: add items directly to the database
        addItemsMutation.mutate({
          expenseId,
          items: data.items.map((item) => ({
            name: item.name,
            amount: BigInt(item.amount),
            excluded: false,
          })),
        });
      } else {
        // New expense: add items to the store
        const newItems = data.items.map((item) => ({
          id: crypto.randomUUID(),
          name: item.name,
          amount: BigInt(item.amount),
          excluded: false,
        }));
        setItems([...items, ...newItems]);
        toast.success(t('scan_receipt.success', { count: data.items.length }));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('scan_receipt.error'));
    } finally {
      setIsScanning(false);
    }
  }, [fileKey, expenseId, setItems, items, t, addItemsMutation]);

  if (!fileKey) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleScan}
      disabled={isScanning || addItemsMutation.isPending}
      className="gap-2"
    >
      {isScanning || addItemsMutation.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <ScanLine className="size-4" />
      )}
      {isScanning || addItemsMutation.isPending
        ? t('scan_receipt.scanning')
        : t('scan_receipt.button')}
    </Button>
  );
};
