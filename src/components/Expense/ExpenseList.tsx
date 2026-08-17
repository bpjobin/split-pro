import { SplitType } from '@prisma/client';
import { type inferRouterOutputs } from '@trpc/server';
import { Eye, EyeOff, Search, SlidersHorizontal, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CategoryIcon, CurrencyConversionIcon, SettleupIcon } from '~/components/ui/categoryIcons';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { cn } from '~/lib/utils';
import type { ExpenseRouter } from '~/server/api/routers/expense';
import { api } from '~/utils/api';
import { Separator } from '../ui/separator';
import { TagPicker } from '../TagPicker';

type ExpensesOutput =
  | inferRouterOutputs<ExpenseRouter>['getGroupExpenses']
  | inferRouterOutputs<ExpenseRouter>['getExpensesWithFriend'];

type SingleExpenseOutput = ExpensesOutput[number];

type ExpenseComponent = React.FC<{
  e: SingleExpenseOutput;
  userId: number;
}>;

export const ExpenseList: React.FC<{
  userId: number;
  expenses?: ExpensesOutput;
  contactId: number;
  isGroup?: boolean;
  isLoading?: boolean;
}> = ({ userId, isGroup = false, expenses = [], contactId, isLoading }) => {
  const { t } = useTranslationWithUtils();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const { data: allTags } = api.tag.getUserTags.useQuery();

  const filteredExpenses = useMemo(() => {
    if (!expenses) {
      return expenses;
    }
    let result = expenses;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) => e.name.toLowerCase().includes(q) || e.paidByUser.name?.toLowerCase().includes(q),
      ) as ExpensesOutput;
    }

    if (selectedTagIds.length > 0) {
      result = result.filter((e) => {
        if (!('tags' in e) || !e.tags) {
          return false;
        }
        return selectedTagIds.some((tagId) =>
          e.tags.some((t: { tag: { id: string } }) => t.tag.id === tagId),
        );
      }) as ExpensesOutput;
    }

    return result;
  }, [expenses, searchQuery, selectedTagIds]);

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedTagIds([]);
  }, []);

  if (!isLoading && expenses.length === 0) {
    return <NoExpenses />;
  }

  const hasFilters = searchQuery.trim().length > 0 || selectedTagIds.length > 0;

  if (!isLoading && expenses.length > 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('expense_list.search_placeholder')}
              className="w-full rounded-md border bg-transparent py-1.5 pr-3 pl-9 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'rounded-md border p-1.5 transition-colors',
              showFilters || selectedTagIds.length > 0
                ? 'border-blue-500 bg-blue-50 text-blue-600'
                : 'text-gray-400 hover:text-gray-600',
            )}
          >
            <SlidersHorizontal className="size-4" />
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md p-1.5 text-gray-400 hover:text-gray-600"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {showFilters && allTags && allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 rounded-md border p-2">
            {allTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
                  selectedTagIds.includes(tag.id)
                    ? 'text-white'
                    : 'text-gray-700 hover:bg-gray-100',
                )}
                style={{
                  backgroundColor: selectedTagIds.includes(tag.id) ? tag.color : undefined,
                }}
              >
                <div className="size-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            ))}
          </div>
        )}

        {filteredExpenses.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">{t('expense_list.no_match')}</p>
        )}

        <ExpenseListInner
          userId={userId}
          expenses={filteredExpenses}
          contactId={contactId}
          isGroup={isGroup}
        />
      </div>
    );
  }

  return (
    <ExpenseListInner userId={userId} expenses={expenses} contactId={contactId} isGroup={isGroup} />
  );
};

const ExpenseListInner: React.FC<{
  userId: number;
  expenses: ExpensesOutput;
  contactId: number;
  isGroup: boolean;
}> = ({ userId, isGroup = false, expenses = [], contactId }) => {
  const { i18n } = useTranslationWithUtils();

  let lastDate: Date | null = null;

  return (
    <div className="flex flex-col gap-3">
      {expenses.map((e) => {
        const currentDate = e.expenseDate;
        let isFirstOfMonth = false;

        if (
          lastDate === null ||
          currentDate.getMonth() !== lastDate.getMonth() ||
          currentDate.getFullYear() !== lastDate.getFullYear()
        ) {
          isFirstOfMonth = true;
        }

        lastDate = currentDate;

        const isSettlement = e.splitType === SplitType.SETTLEMENT;
        const isCurrencyConversion = e.splitType === SplitType.CURRENCY_CONVERSION;

        return (
          <React.Fragment key={e.id}>
            {isFirstOfMonth && (
              <div className="flex flex-row items-center gap-4 pt-2">
                <div className="text-xs font-medium text-gray-700 uppercase">
                  {new Intl.DateTimeFormat(i18n.language, {
                    month: 'long',
                    year: 'numeric',
                  }).format(currentDate)}
                </div>
                <Separator className="flex-1 bg-gray-800" />
              </div>
            )}
            <Link
              href={`/${isGroup ? 'groups' : 'balances'}/${contactId}/expenses/${e.id}`}
              className={cn('flex items-center justify-between', isFirstOfMonth ? 'pb-2' : 'py-2')}
            >
              {isSettlement && <Settlement e={e} userId={userId} />}
              {isCurrencyConversion && <CurrencyConversion e={e} userId={userId} />}
              {!isSettlement && !isCurrencyConversion && <Expense e={e} userId={userId} />}
            </Link>
          </React.Fragment>
        );
      })}
    </div>
  );
};

const Expense: ExpenseComponent = ({ e, userId }) => {
  const { displayName, toUIDate, t, getCurrencyHelpersCached } = useTranslationWithUtils();
  const router = useRouter();
  const { friendId } = router.query;
  const apiUtils = api.useUtils();

  const toggleMuteMutation = api.expense.toggleMuteExpense.useMutation({
    onSuccess: () => {
      void apiUtils.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleToggleMute = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      toggleMuteMutation.mutate({ expenseId: e.id });
    },
    [toggleMuteMutation, e.id],
  );

  const isMuted = e.mutedAt !== null;

  const youPaid = e.paidBy === userId && e.amount >= 0n;
  const yourExpense = e.expenseParticipants.find((participant) => participant.userId === userId);
  const theirExpense = e.expenseParticipants.find(
    (participant) => participant.userId.toString() === friendId,
  );
  const yourExpenseAmount = youPaid
    ? (theirExpense?.amount ?? yourExpense?.amount ?? 0n)
    : -(yourExpense?.amount ?? 0n);

  const { toUIString } = getCurrencyHelpersCached(e.currency);

  return (
    <>
      <div className="flex min-w-0 items-center gap-4">
        <div className="inline-block w-6 shrink-0 text-center text-xs text-gray-500">
          {toUIDate(e.expenseDate)}
        </div>
        <CategoryIcon category={e.category} className="size-5 shrink-0 text-gray-400" />
        <div className="min-w-0 pe-1">
          <p
            className={cn('truncate text-sm lg:text-base', isMuted && 'text-gray-400 line-through')}
          >
            {e.name}
          </p>
          <p className="truncate text-xs text-gray-500">
            {displayName(e.paidByUser, userId)}{' '}
            {t(`ui.expense.user.${e.amount < 0n ? 'received' : 'paid'}`)} {toUIString(e.amount)}
          </p>
          {'tags' in e && e.tags && (
            <div className="mt-1">
              <TagPicker expenseId={e.id} expenseTags={e.tags} />
            </div>
          )}
        </div>
      </div>
      <div className="flex min-w-10 shrink-0 items-center gap-1">
        {youPaid || 0n !== yourExpenseAmount ? (
          <>
            <div className={`text-right text-xs ${youPaid ? 'text-positive' : 'text-negative'}`}>
              {t('actors.you')} {t(`ui.expense.you.${youPaid ? 'lent' : 'owe'}`)}
            </div>
            <div
              className={`xs:max-w-full max-w-32 truncate text-right ${youPaid ? 'text-positive' : 'text-negative'}`}
            >
              {toUIString(yourExpenseAmount)}
            </div>
          </>
        ) : (
          <div>
            <p className="text-xs text-gray-400">{t('ui.not_involved')}</p>
          </div>
        )}
        <button
          type="button"
          onClick={handleToggleMute}
          className={cn(
            'ml-1 shrink-0 rounded p-1 transition-colors',
            isMuted
              ? 'text-amber-500 hover:bg-amber-500/10'
              : 'text-gray-400 hover:bg-gray-400/10 hover:text-gray-600',
          )}
          title={isMuted ? t('expense_details.unmute') : t('expense_details.mute')}
        >
          {isMuted ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
    </>
  );
};

const Settlement: ExpenseComponent = ({ e, userId }) => {
  const { displayName, toUIDate, t, getCurrencyHelpersCached } = useTranslationWithUtils();

  const { toUIString } = getCurrencyHelpersCached(e.currency);

  const receiverId = e.expenseParticipants.find((p) => p.userId !== e.paidBy)?.userId;
  const userDetails = api.user.getUserDetails.useQuery({ userId: receiverId! });

  return (
    <div className="flex items-center gap-4">
      <div className="inline-block w-6 text-center text-xs text-gray-500">
        {toUIDate(e.expenseDate)}
      </div>
      <SettleupIcon className="size-5 shrink-0 text-gray-400" />
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm text-gray-400">
          {displayName(e.paidByUser, userId)}{' '}
          {t(`ui.expense.user.${e.amount < 0n ? 'received' : 'paid'}`)} {toUIString(e.amount)}{' '}
          {t('ui.expense.to')} {displayName(userDetails.data, userId)}
        </p>
      </div>
    </div>
  );
};

const CurrencyConversion: ExpenseComponent = ({ e, userId }) => {
  const { displayName, toUIDate, t, getCurrencyHelpersCached } = useTranslationWithUtils();

  if (!e.conversionTo) {
    toast.error(t('errors.currency_conversion_malformed'));
    console.error(
      'Malformed currency conversion data: no conversionTo present, please report this issue.',
    );
    return null;
  }

  const receiverId = e.expenseParticipants.find((p) => p.userId !== e.paidBy)?.userId;
  const userDetails = api.user.getUserDetails.useQuery({ userId: receiverId! });

  return (
    <div className="flex min-w-0 items-center gap-4">
      <div className="inline-block w-6 shrink-0 text-center text-xs text-gray-500">
        {toUIDate(e.expenseDate)}
      </div>
      <CurrencyConversionIcon className="size-5 shrink-0 text-gray-400" />
      <div className="min-w-0">
        <p className="truncate text-sm lg:text-base">
          {getCurrencyHelpersCached(e.currency).toUIString(e.amount)} ➡️{' '}
          {
            /* @ts-ignore */
            getCurrencyHelpersCached(e.conversionTo.currency).toUIString(e.conversionTo.amount)
          }
        </p>
        <p className="truncate text-xs text-gray-500">
          {t('ui.expense.for')} {displayName(e.paidByUser, userId)} {t('ui.and')}{' '}
          {displayName(userDetails.data, userId)}
        </p>
      </div>
    </div>
  );
};

const NoExpenses = () => (
  <div className="mt-20 flex flex-col items-center justify-center">
    <Image src="/add_expense.svg" alt="Empty" width={200} height={200} className="mb-4" />
  </div>
);
