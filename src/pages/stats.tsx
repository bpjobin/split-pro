import { ChartBarIcon } from '@heroicons/react/24/outline';
import Head from 'next/head';
import React from 'react';
import MainLayout from '~/components/Layout/MainLayout';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import type { NextPageWithUser } from '~/types';
import { api } from '~/utils/api';
import { withI18nStaticProps } from '~/utils/i18n/server';

const StatsPage: NextPageWithUser = () => {
  const { t, getCurrencyHelpersCached } = useTranslationWithUtils();
  const statsQuery = api.expense.getStats.useQuery();

  const data = statsQuery.data;

  return (
    <>
      <Head>
        <title>
          {t('stats.title')} - {t('meta.application_name')}
        </title>
      </Head>
      <MainLayout title={t('stats.title')} loading={statsQuery.isPending}>
        {!data || data.totalExpenses === 0 ? (
          <p className="mt-10 text-center text-gray-500">{t('stats.no_data')}</p>
        ) : (
          <div className="flex flex-col gap-6 pb-36">
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                title={t('stats.total_spent')}
                value={data.totalSpent}
                currency={undefined}
                getCurrencyHelpersCached={getCurrencyHelpersCached}
              />
              <StatCard
                title={t('stats.average_expense')}
                value={data.averageExpense}
                currency={undefined}
                getCurrencyHelpersCached={getCurrencyHelpersCached}
              />
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-3 text-lg font-medium">{t('stats.by_category')}</h3>
              <div className="flex flex-col gap-2">
                {data.byCategory.map((item) => (
                  <div key={item.category} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{item.category}</span>
                    <span className="text-sm text-gray-500">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-3 text-lg font-medium">{t('stats.by_person')}</h3>
              <div className="flex flex-col gap-2">
                {data.byPerson.map((item) => (
                  <div key={item.userId} className="flex items-center justify-between">
                    <span className="text-sm">{item.name}</span>
                    <span className="text-sm text-gray-500">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-3 text-lg font-medium">{t('stats.over_time')}</h3>
              <div className="flex flex-col gap-2">
                {data.byMonth.map((item) => (
                  <div key={item.month} className="flex items-center justify-between">
                    <span className="text-sm">{item.month}</span>
                    <span className="text-sm text-gray-500">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </MainLayout>
    </>
  );
};

const StatCard: React.FC<{
  title: string;
  value: bigint;
  currency?: string;
  getCurrencyHelpersCached: (currency: string) => { toUIString: (amount: bigint) => string };
}> = ({ title, value, currency, getCurrencyHelpersCached }) => {
  const { toUIString } = getCurrencyHelpersCached(currency ?? 'USD');

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-2 text-gray-500">
        <ChartBarIcon className="size-4" />
        <span className="text-sm">{title}</span>
      </div>
      <p className="mt-2 text-xl font-semibold">{toUIString(value)}</p>
    </div>
  );
};

StatsPage.auth = true;

export const getStaticProps = withI18nStaticProps(['common']);

export default StatsPage;
