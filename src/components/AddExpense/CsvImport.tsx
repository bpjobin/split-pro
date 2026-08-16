import { FileDown, FileUp } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useAddMultipleTransactions } from '~/hooks/useAddMultipleTransactions';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { parseCurrencyCode } from '~/lib/currency';
import { cn } from '~/lib/utils';
import { useAddExpenseStore } from '~/store/addStore';
import { type CurrencyCode } from '~/lib/currency';
import { type TransactionAddInputModel } from '~/types';
import { api } from '~/utils/api';
import {
  detectColumns,
  detectDelimiter,
  generateCsvTemplate,
  isLikelyHeaderRow,
  parseAmount,
  parseCsv,
  parseDate,
} from '~/utils/csv';
import { cyrb128 } from '~/utils/random';
import { BigMath } from '~/utils/numbers';

import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { AppDrawer } from '../ui/drawer';
import { NativeSelect, NativeSelectOption } from '../ui/native-select';
import { BankTransactionItem } from './BankTransactions/BankTransactionItem';
import { type TransactionWithPendingStatus } from './BankTransactions/BankingTransactionList';
import { MultipleTransactionModal } from './BankTransactions/MultipleTransactionModal';

interface ParsedCsvRow {
  transactionId: string;
  date: Date;
  description: string;
  amount: bigint;
}

const CsvImport: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, getCurrencyHelpersCached } = useTranslationWithUtils();
  const currency = useAddExpenseStore((s) => s.currency);
  const group = useAddExpenseStore((s) => s.group);

  const {
    clearFields,
    addAllMultipleExpenses,
    addOneByOneMultipleExpenses,
    multipleTransactions,
    setMultipleTransactions,
    isTransactionLoading,
    setSingleTransaction,
  } = useAddMultipleTransactions();

  const expensesQuery = api.user.getOwnExpenses.useQuery();

  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState({ date: 0, description: 1, amount: 2 });
  const [showMultipleTransactionModal, setShowMultipleTransactionModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const columnCount = Math.max(0, ...rows.map((row) => row.length));

  const columnOptions = useMemo(() => {
    const headerRow: string[] = hasHeader && rows.length > 0 ? (rows[0] ?? []) : [];
    return Array.from({ length: columnCount }, (_, index) =>
      headerRow[index]?.trim()
        ? headerRow[index].trim()
        : `${t('expense_details.csv_import.column')} ${index + 1}`,
    );
  }, [columnCount, rows, hasHeader, t]);

  const parsedRows: ParsedCsvRow[] = useMemo(() => {
    const data = hasHeader ? rows.slice(1) : rows;
    if (0 === data.length) {
      return [];
    }
    return data.flatMap((row) => {
      const date = parseDate(row[mapping.date] ?? '');
      const description = (row[mapping.description] ?? '').trim();
      const amount = parseAmount(row[mapping.amount] ?? '');

      if (!date || '' === description || null === amount) {
        return [];
      }

      const transactionId = `csv-${cyrb128(
        `${row[mapping.date]}-${row[mapping.description]}-${row[mapping.amount]}`,
      ).join('-')}`;

      return [{ transactionId, date, description, amount }];
    });
  }, [rows, hasHeader, mapping]);

  const transactions: TransactionWithPendingStatus[] = useMemo(
    () =>
      parsedRows.map((parsedRow) => ({
        transactionId: parsedRow.transactionId,
        bookingDate: parsedRow.date.toISOString(),
        description: parsedRow.description,
        transactionAmount: {
          amount: getCurrencyHelpersCached(currency).toUIString(parsedRow.amount, true, true),
          currency,
        },
        pending: false,
      })),
    [parsedRows, currency, getCurrencyHelpersCached],
  );

  const alreadyAdded = useCallback(
    (transactionId: string) =>
      expensesQuery?.data?.some(
        (expense) => expense.transactionId === transactionId && expense.group?.id === group?.id,
      ) ?? false,
    [expensesQuery?.data, group?.id],
  );

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const delimiter = detectDelimiter(content);
      const parsed = parseCsv(content, delimiter);
      const firstRow = parsed[0] ?? [];
      const header = isLikelyHeaderRow(firstRow);
      setHasHeader(header);
      const detected = detectColumns(header ? firstRow : []);
      setMapping({
        date: 0 <= detected.date ? detected.date : 0,
        description:
          0 <= detected.description
            ? detected.description
            : Math.min(1, Math.max(0, firstRow.length - 1)),
        amount: 0 <= detected.amount ? detected.amount : Math.max(0, firstRow.length - 1),
      });
      setRows(parsed);
      setFileName(file.name);
    };
    reader.readAsText(file);
  }, []);

  const resetCsvState = useCallback(() => {
    setFileName('');
    setRows([]);
    setHasHeader(true);
    setMapping({ date: 0, description: 1, amount: 2 });
  }, []);

  const setOpenClose = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        setMultipleTransactions([]);
        resetCsvState();
      }
    },
    [setMultipleTransactions, resetCsvState],
  );

  const buildTransactionData = useCallback(
    (parsed: ParsedCsvRow): TransactionAddInputModel => ({
      date: parsed.date,
      amountStr: getCurrencyHelpersCached(currency).toUIString(
        BigMath.abs(parsed.amount),
        false,
        true,
      ),
      amount: BigMath.abs(parsed.amount),
      currency: parseCurrencyCode(currency),
      description: parsed.description,
      transactionId: parsed.transactionId,
    }),
    [currency, getCurrencyHelpersCached],
  );

  const onTransactionRowClick = useCallback(
    (item: TransactionWithPendingStatus, multiple: boolean) => {
      const parsed = parsedRows.find((row) => row.transactionId === item.transactionId);
      if (!parsed) {
        return;
      }

      const transactionData = buildTransactionData(parsed);

      if (multiple) {
        clearFields();
        const exists = multipleTransactions.some(
          (cItem) => cItem.transactionId === parsed.transactionId,
        );
        setMultipleTransactions(
          exists
            ? multipleTransactions.filter((cItem) => cItem.transactionId !== parsed.transactionId)
            : [...multipleTransactions, transactionData],
        );
      } else {
        if (alreadyAdded(parsed.transactionId)) {
          return;
        }
        setSingleTransaction(transactionData);
        setOpen(false);
        document.getElementById('mainlayout')?.scrollTo({ top: 0, behavior: 'instant' });
      }
    },
    [
      parsedRows,
      buildTransactionData,
      multipleTransactions,
      setMultipleTransactions,
      clearFields,
      setSingleTransaction,
      alreadyAdded,
    ],
  );

  const selectedTransactionIds = useMemo(
    () => new Set(multipleTransactions.map((transaction) => transaction.transactionId)),
    [multipleTransactions],
  );

  const allSelected = useMemo(
    () =>
      0 < parsedRows.length &&
      parsedRows.every((row) => selectedTransactionIds.has(row.transactionId)),
    [parsedRows, selectedTransactionIds],
  );

  const handleToggleSelectAll = useCallback(() => {
    if (allSelected) {
      setMultipleTransactions([]);
      return;
    }
    clearFields();
    setMultipleTransactions(parsedRows.map(buildTransactionData));
  }, [allSelected, parsedRows, buildTransactionData, setMultipleTransactions, clearFields]);

  const handleAddMultipleExpenses = useCallback(() => {
    setShowMultipleTransactionModal(true);
  }, []);

  const handleAddOneByOneMultipleExpenses = useCallback(() => {
    setOpen(false);
    addOneByOneMultipleExpenses();
  }, [addOneByOneMultipleExpenses]);

  const hasMultipleTransactions = multipleTransactions.length > 0;

  const updateMapping = useCallback((field: 'date' | 'description' | 'amount', index: number) => {
    setMapping((prev) => ({ ...prev, [field]: index }));
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      e.target.value = '';
    },
    [handleFile],
  );

  const handleChooseFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([generateCsvTemplate()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'splitpro-import-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleHeaderToggle = useCallback((checked: boolean) => {
    setHasHeader(checked);
  }, []);

  const handleDateColumnChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => updateMapping('date', Number(e.target.value)),
    [updateMapping],
  );

  const handleDescriptionColumnChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      updateMapping('description', Number(e.target.value)),
    [updateMapping],
  );

  const handleAmountColumnChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => updateMapping('amount', Number(e.target.value)),
    [updateMapping],
  );

  return (
    <AppDrawer
      trigger={children}
      title={t('expense_details.csv_import.title')}
      open={open}
      onOpenChange={setOpenClose}
      className="h-[80vh]"
      actionTitle={hasMultipleTransactions ? t('expense_details.submit_all') : undefined}
      actionOnClick={hasMultipleTransactions ? handleAddMultipleExpenses : undefined}
      actionDisabled={(multipleTransactions?.length || 0) === 0 || isTransactionLoading}
    >
      <div className="flex flex-col gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={handleFileInputChange}
        />
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={handleChooseFileClick}
          >
            <FileUp className="size-4" />
            {fileName ? fileName : t('expense_details.csv_import.choose_file')}
          </Button>
          <Button
            variant="ghost"
            className="flex items-center gap-2"
            onClick={handleDownloadTemplate}
          >
            <FileDown className="size-4" />
            {t('expense_details.csv_import.download_template')}
          </Button>
        </div>

        {rows.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <Checkbox
                id="csv-header-toggle"
                checked={hasHeader}
                onCheckedChange={handleHeaderToggle}
              />
              <label htmlFor="csv-header-toggle" className="text-sm">
                {t('expense_details.csv_import.first_row_header')}
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-xs">
                {t('expense_details.csv_import.date_column')}
                <NativeSelect
                  size="sm"
                  value={String(mapping.date)}
                  onChange={handleDateColumnChange}
                >
                  {columnOptions.map((label, index) => (
                    <NativeSelectOption key={index} value={String(index)}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                {t('expense_details.csv_import.description_column')}
                <NativeSelect
                  size="sm"
                  value={String(mapping.description)}
                  onChange={handleDescriptionColumnChange}
                >
                  {columnOptions.map((label, index) => (
                    <NativeSelectOption key={index} value={String(index)}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                {t('expense_details.csv_import.amount_column')}
                <NativeSelect
                  size="sm"
                  value={String(mapping.amount)}
                  onChange={handleAmountColumnChange}
                >
                  {columnOptions.map((label, index) => (
                    <NativeSelectOption key={index} value={String(index)}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {t('expense_details.csv_import.rows_found', { count: parsedRows.length })}
              </p>
              <Button variant="link" size="sm" onClick={handleToggleSelectAll}>
                {allSelected
                  ? t('expense_details.csv_import.uncheck_all')
                  : t('expense_details.csv_import.check_all')}
              </Button>
            </div>

            {0 === parsedRows.length ? (
              <div className="mt-[20vh] text-center text-gray-400">
                {t('expense_details.csv_import.no_rows_found')}
              </div>
            ) : (
              transactions.map((item, index) => (
                <BankTransactionItem
                  key={item.transactionId}
                  index={index}
                  item={item}
                  alreadyAdded={alreadyAdded(item.transactionId)}
                  onTransactionRowClick={onTransactionRowClick}
                  groupName=""
                  multipleTransactions={multipleTransactions}
                />
              ))
            )}
          </>
        )}

        {0 === rows.length && (
          <div className={cn('mt-[20vh] text-center text-gray-400')}>
            {t('expense_details.csv_import.no_file_selected')}
          </div>
        )}
      </div>
      <MultipleTransactionModal
        modalOpen={showMultipleTransactionModal}
        setModalOpen={setShowMultipleTransactionModal}
        onAddAll={addAllMultipleExpenses}
        onAddOneByOne={handleAddOneByOneMultipleExpenses}
      />
    </AppDrawer>
  );
};

export default CsvImport;
