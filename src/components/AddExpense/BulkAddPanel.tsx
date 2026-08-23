import { useCallback, useState } from 'react';

import { useAddMultipleTransactions } from '~/hooks/useAddMultipleTransactions';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { useAddExpenseStore } from '~/store/addStore';
import { api } from '~/utils/api';

import { toast } from 'sonner';
import { AppDrawer } from '../ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { BulkAddExpenseContent } from './BulkAddExpense';
import { CsvImportContent } from './CsvImport';
import { MultipleTransactionModal } from './BankTransactions/MultipleTransactionModal';
import { type BulkRow, buildBulkExpenses, createRow, patchBulkRow, removeBulkRow } from './bulkRow';

type BulkPanelTab = 'manual' | 'csv';

const BulkAddPanel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslationWithUtils();

  const group = useAddExpenseStore((s) => s.group);
  const paidBy = useAddExpenseStore((s) => s.paidBy);
  const participants = useAddExpenseStore((s) => s.participants);
  const category = useAddExpenseStore((s) => s.category);
  const currency = useAddExpenseStore((s) => s.currency);
  const splitType = useAddExpenseStore((s) => s.splitType);
  const splitShares = useAddExpenseStore((s) => s.splitShares);

  const addExpenseMutation = api.expense.addOrEditExpense.useMutation();
  const utils = api.useUtils();

  const {
    multipleTransactions,
    setMultipleTransactions,
    isTransactionLoading,
    addAllMultipleExpenses,
    addOneByOneMultipleExpenses,
  } = useAddMultipleTransactions();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<BulkPanelTab>('manual');
  const [rows, setRows] = useState<BulkRow[]>([createRow()]);
  const [showMultipleTransactionModal, setShowMultipleTransactionModal] = useState(false);

  const resetPanelState = useCallback(() => {
    setMultipleTransactions([]);
    setShowMultipleTransactionModal(false);
    setActiveTab('manual');
    setRows([createRow()]);
  }, [setMultipleTransactions]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        resetPanelState();
      }
    },
    [resetPanelState],
  );

  const submitAll = useCallback(async () => {
    if (!paidBy) {
      return;
    }

    const expenses = buildBulkExpenses({
      rows,
      currency,
      category,
      group,
      splitType,
      splitShares,
      participants,
      paidBy,
    });

    if (0 === expenses.length) {
      toast.error(t('expense_details.bulk_add.add_row_required'));
      return;
    }

    try {
      await addExpenseMutation.mutateAsync(expenses);
      resetPanelState();
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
    resetPanelState,
  ]);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as BulkPanelTab);
  }, []);

  const handlePatchRow = useCallback((id: string, patch: Partial<BulkRow>) => {
    setRows((prev) => patchBulkRow(prev, id, patch));
  }, []);

  const handleRemoveRow = useCallback((id: string) => {
    setRows((prev) => removeBulkRow(prev, id));
  }, []);

  const handleAddRow = useCallback(() => {
    setRows((prev) => [...prev, createRow()]);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleAddOneByOne = useCallback(() => {
    setOpen(false);
    addOneByOneMultipleExpenses();
  }, [addOneByOneMultipleExpenses]);

  const handleOpenMultipleTransactionModal = useCallback(() => {
    setShowMultipleTransactionModal(true);
  }, []);

  const hasMultipleTransactions = multipleTransactions.length > 0;

  const actionTitle =
    'manual' === activeTab
      ? t('expense_details.bulk_add.submit_all')
      : hasMultipleTransactions
        ? t('expense_details.submit_all')
        : undefined;

  const actionOnClick = 'manual' === activeTab ? submitAll : handleOpenMultipleTransactionModal;

  const actionDisabled =
    'manual' === activeTab
      ? addExpenseMutation.isPending
      : !hasMultipleTransactions || isTransactionLoading;

  return (
    <AppDrawer
      trigger={children}
      title={t('expense_details.bulk_add.title')}
      open={open}
      onOpenChange={handleOpenChange}
      className="h-[80vh]"
      actionTitle={actionTitle}
      actionOnClick={actionOnClick}
      actionDisabled={actionDisabled}
      shouldCloseOnAction={false}
    >
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual" className="flex-1">
            {t('expense_details.bulk_add.tab_manual_rows')}
          </TabsTrigger>
          <TabsTrigger value="csv" className="flex-1">
            {t('expense_details.bulk_add.tab_import_csv')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="manual" forceMount hidden={'manual' !== activeTab} className="mt-4">
          <BulkAddExpenseContent
            rows={rows}
            onPatchRow={handlePatchRow}
            onRemoveRow={handleRemoveRow}
            onAddRow={handleAddRow}
          />
        </TabsContent>
        <TabsContent value="csv" forceMount hidden={'csv' !== activeTab} className="mt-4">
          <CsvImportContent onClose={handleClose} />
        </TabsContent>
      </Tabs>
      <MultipleTransactionModal
        modalOpen={showMultipleTransactionModal}
        setModalOpen={setShowMultipleTransactionModal}
        onAddAll={addAllMultipleExpenses}
        onAddOneByOne={handleAddOneByOne}
      />
    </AppDrawer>
  );
};

export default BulkAddPanel;
