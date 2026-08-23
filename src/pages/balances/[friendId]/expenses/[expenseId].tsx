import { SplitType } from '@prisma/client';
import { ChevronLeftIcon, HandshakeIcon, MoreHorizontal, PencilIcon } from 'lucide-react';
import { type GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useMemo } from 'react';

import { DeleteExpense } from '~/components/Expense/DeleteExpense';
import ExpenseDetails, {
  EditCurrencyConversion,
  EditSettlement,
  MoveExpenseToGroup,
  SettleUpExpense,
} from '~/components/Expense/ExpenseDetails';
import MainLayout from '~/components/Layout/MainLayout';
import { SimpleConfirmationDialog } from '~/components/SimpleConfirmationDialog';
import { Button } from '~/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { extractTemplateExpenseId } from '~/lib/cron';
import { type NextPageWithUser } from '~/types';
import { api } from '~/utils/api';
import { customServerSideTranslations } from '~/utils/i18n/server';

const ExpensesPage: NextPageWithUser = ({ user }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const expenseId = router.query.expenseId as string;
  const friendId = parseInt(router.query.friendId as string);

  const expenseQuery = api.expense.getExpenseDetails.useQuery({ expenseId });

  const recurrence = expenseQuery.data?.recurrence;
  const isTemplate = useMemo(
    () => (recurrence ? extractTemplateExpenseId(recurrence.job.command) === expenseId : false),
    [recurrence, expenseId],
  );

  const handleEditConfirm = useCallback(async () => {
    await router.push(`/add?expenseId=${expenseId}`);
  }, [router, expenseId]);

  const editDescription = useMemo(() => {
    if (!recurrence) {
      return '';
    }

    if (isTemplate) {
      return t('recurrence.template_edit_warning');
    }

    return (
      <>
        {t('recurrence.derived_edit_warning')}{' '}
        <Link href="/recurring" className="text-primary underline">
          {t('recurrence.view_recurring_page')}
        </Link>
      </>
    );
  }, [recurrence, isTemplate, t]);

  const renderEditButton = () => {
    const editButton = (
      <Button variant="ghost">
        <PencilIcon className="mr-1 h-4 w-4" />
      </Button>
    );

    if (recurrence) {
      return (
        <SimpleConfirmationDialog
          title={t('recurrence.edit_confirmation_title')}
          description={editDescription}
          hasPermission
          onConfirm={handleEditConfirm}
          loading={false}
        >
          {editButton}
        </SimpleConfirmationDialog>
      );
    }

    return <Link href={`/add?expenseId=${expenseId}`}>{editButton}</Link>;
  };

  // Narrow type for expense data
  const expense = expenseQuery.data;

  return (
    <>
      <Head>
        <title>{expenseQuery.data?.name ?? ''}</title>
      </Head>
      <MainLayout
        title={
          <div className="flex items-center gap-2">
            <Link href={`/balances/${friendId}`}>
              <ChevronLeftIcon className="mr-1 h-6 w-6" />
            </Link>
            <p className="text-[16px] font-normal">{t('ui.expense_details')}</p>
          </div>
        }
        actions={
          expense?.deletedBy ? null : (
            <div className="flex items-center gap-2">
              {/* Settle up */}
              {expense?.splitType !== SplitType.SETTLEMENT && !expense?.settledAt && expense && (
                <SettleUpExpense expense={expense} currentUserId={user.id} />
              )}

              {/* Edit button */}
              {expense?.splitType === SplitType.CURRENCY_CONVERSION ? (
                <EditCurrencyConversion expense={expense} />
              ) : expense?.splitType === SplitType.SETTLEMENT ? (
                <EditSettlement expense={expense} />
              ) : (
                <Link href={`/add?expenseId=${expenseId}`}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title={t('actions.edit')}>
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                </Link>
              )}

              {/* Secondary actions dropdown */}
              {expense?.group && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={t('actions.more')}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" sideOffset={8}>
                    <div className="flex flex-col gap-1">
                      <MoveExpenseToGroup expense={expense} />
                      <DeleteExpense expenseId={expenseId} recurrence={recurrence} asDropdownItem />
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )
        }
      >
        {expenseQuery.data ? <ExpenseDetails user={user} expense={expenseQuery.data} /> : null}
      </MainLayout>
    </>
  );
};

ExpensesPage.auth = true;

export const getServerSideProps: GetServerSideProps = async (context) => ({
  props: {
    ...(await customServerSideTranslations(context.locale, ['common'])),
  },
});

export default ExpensesPage;
