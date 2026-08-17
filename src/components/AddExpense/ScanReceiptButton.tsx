import { Loader2, ScanLine } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { useAddExpenseStore } from '~/store/addStore';

interface ScanReceiptButtonProps {
  fileKey?: string;
}

export const ScanReceiptButton: React.FC<ScanReceiptButtonProps> = ({ fileKey }) => {
  const { t } = useTranslationWithUtils();
  const [isScanning, setIsScanning] = useState(false);
  const setItems = useAddExpenseStore((s) => s.actions.setItems);
  const items = useAddExpenseStore((s) => s.items);

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

      // Convert amounts to BigInt and add IDs
      const newItems = data.items.map((item) => ({
        id: crypto.randomUUID(),
        name: item.name,
        amount: BigInt(item.amount),
        excluded: false,
      }));

      // Merge with existing items
      setItems([...items, ...newItems]);
      toast.success(t('scan_receipt.success', { count: data.items.length }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('scan_receipt.error'));
    } finally {
      setIsScanning(false);
    }
  }, [fileKey, setItems, items, t]);

  if (!fileKey) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleScan}
      disabled={isScanning}
      className="gap-2"
    >
      {isScanning ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
      {isScanning ? t('scan_receipt.scanning') : t('scan_receipt.button')}
    </Button>
  );
};
