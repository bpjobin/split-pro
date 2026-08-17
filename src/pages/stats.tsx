import { ChartBarIcon } from '@heroicons/react/24/outline';
import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/solid';
import Head from 'next/head';
import React, { useCallback, useState } from 'react';
import { Button } from '~/components/ui/button';
import MainLayout from '~/components/Layout/MainLayout';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import type { NextPageWithUser } from '~/types';
import { api } from '~/utils/api';
import { withI18nStaticProps } from '~/utils/i18n/server';

interface StatsFilters {
  dateFrom: string;
  dateTo: string;
  groupId: number | null;
  paidByUserId: number | null;
  tagIds: string[];
}

const StatsPage: NextPageWithUser = () => {
  const { t, getCurrencyHelpersCached } = useTranslationWithUtils();
  const { toUIString } = getCurrencyHelpersCached('USD');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<StatsFilters>({
    dateFrom: '',
    dateTo: '',
    groupId: null,
    paidByUserId: null,
    tagIds: [],
  });

  const hasActiveFilters =
    filters.dateFrom ||
    filters.dateTo ||
    filters.groupId ||
    filters.paidByUserId ||
    filters.tagIds.length > 0;

  const queryInput = hasActiveFilters
    ? {
        ...(filters.dateFrom ? { dateFrom: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { dateTo: new Date(filters.dateTo + 'T23:59:59.999Z') } : {}),
        ...(filters.groupId ? { groupId: filters.groupId } : {}),
        ...(filters.paidByUserId ? { paidByUserId: filters.paidByUserId } : {}),
        ...(filters.tagIds.length > 0 ? { tagIds: filters.tagIds } : {}),
      }
    : undefined;

  const statsQuery = api.expense.getStats.useQuery(queryInput);

  const data = statsQuery.data;

  const clearFilters = useCallback(() => {
    setFilters({ dateFrom: '', dateTo: '', groupId: null, paidByUserId: null, tagIds: [] });
  }, []);

  return (
    <>
      <Head>
        <title>
          {t('stats.title')} - {t('meta.application_name')}
        </title>
      </Head>
      <MainLayout
        title={t('stats.title')}
        loading={statsQuery.isPending}
        actions={
          <Button
            variant={showFilters ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1"
          >
            <FunnelIcon className="size-4" />
            {hasActiveFilters && <span className="size-1.5 rounded-full bg-blue-500" />}
          </Button>
        }
      >
        {showFilters && (
          <StatsFilterPanel filters={filters} setFilters={setFilters} onClear={clearFilters} />
        )}

        {!data || data.totalExpenses === 0 ? (
          <p className="mt-10 text-center text-gray-500">{t('stats.no_data')}</p>
        ) : (
          <div className="flex flex-col gap-6 pb-36">
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                title={t('stats.total_spent')}
                value={data.totalSpent}
                getCurrencyHelpersCached={getCurrencyHelpersCached}
              />
              <StatCard
                title={t('stats.average_expense')}
                value={data.averageExpense}
                getCurrencyHelpersCached={getCurrencyHelpersCached}
              />
            </div>

            <StatsSection
              title={t('stats.by_category')}
              items={data.byCategory.map((item) => ({
                label: item.category,
                total: item.total,
                count: item.count,
              }))}
              total={data.totalSpent}
              getCurrencyHelpersCached={getCurrencyHelpersCached}
            />

            <StatsSection
              title={t('stats.by_person')}
              items={data.byPerson.map((item) => ({
                label: item.name,
                total: item.total,
                count: item.count,
              }))}
              total={data.totalSpent}
              getCurrencyHelpersCached={getCurrencyHelpersCached}
            />

            {data.byTag.length > 0 && (
              <StatsSection
                title={t('stats.by_tag')}
                items={data.byTag.map((item) => ({
                  label: item.name,
                  total: item.total,
                  count: item.count,
                  color: item.color,
                }))}
                total={data.totalSpent}
                getCurrencyHelpersCached={getCurrencyHelpersCached}
              />
            )}

            {data.byMonth.length > 0 && (
              <div className="rounded-xl border p-4">
                <h3 className="mb-3 text-lg font-medium">{t('stats.over_time')}</h3>
                <div className="flex flex-col gap-2">
                  {(() => {
                    const maxTotal = Math.max(...data.byMonth.map((m) => Number(m.total)));
                    return data.byMonth.map((item) => {
                      const pct = maxTotal > 0 ? (Number(item.total) / maxTotal) * 100 : 0;
                      return (
                        <div key={item.month} className="flex items-center gap-3">
                          <span className="w-16 shrink-0 text-xs text-gray-500">{item.month}</span>
                          <div className="h-4 flex-1 overflow-hidden rounded bg-gray-100">
                            <div
                              className="h-full rounded bg-blue-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-20 shrink-0 text-right text-xs font-medium">
                            {toUIString(item.total)}
                          </span>
                          <span className="w-6 shrink-0 text-right text-xs text-gray-400">
                            {item.count}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </MainLayout>
    </>
  );
};

const StatsFilterPanel: React.FC<{
  filters: StatsFilters;
  setFilters: (fn: (prev: StatsFilters) => StatsFilters) => void;
  onClear: () => void;
}> = ({ filters, setFilters, onClear }) => {
  const { t } = useTranslationWithUtils();

  const groupsQuery = api.group.getAllGroups.useQuery();
  const friendsQuery = api.user.getFriends.useQuery();
  const tagsQuery = api.tag.getUserTags.useQuery();

  const toggleTag = useCallback(
    (tagId: string) => {
      setFilters((prev) => ({
        ...prev,
        tagIds: prev.tagIds.includes(tagId)
          ? prev.tagIds.filter((id) => id !== tagId)
          : [...prev.tagIds, tagId],
      }));
    },
    [setFilters],
  );

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('stats.filters')}</span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          {t('stats.clear_filters')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">{t('stats.date_from')}</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
            className="rounded-md border bg-transparent px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">{t('stats.date_to')}</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
            className="rounded-md border bg-transparent px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">{t('stats.group')}</label>
        <select
          value={filters.groupId ?? ''}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              groupId: e.target.value ? Number(e.target.value) : null,
            }))
          }
          className="rounded-md border bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="">{t('stats.all_groups')}</option>
          {groupsQuery.data?.map((gu) => (
            <option key={gu.group.id} value={gu.group.id}>
              {gu.group.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">{t('stats.paid_by')}</label>
        <select
          value={filters.paidByUserId ?? ''}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              paidByUserId: e.target.value ? Number(e.target.value) : null,
            }))
          }
          className="rounded-md border bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="">{t('stats.anyone')}</option>
          {friendsQuery.data?.map((friend) => (
            <option key={friend.id} value={friend.id}>
              {friend.name}
            </option>
          ))}
        </select>
      </div>

      {tagsQuery.data && tagsQuery.data.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">{t('stats.tags')}</label>
          <div className="flex flex-wrap gap-1">
            {tagsQuery.data.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                  filters.tagIds.includes(tag.id) ? 'text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
                style={{
                  backgroundColor: filters.tagIds.includes(tag.id) ? tag.color : undefined,
                }}
              >
                <div className="size-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
                {filters.tagIds.includes(tag.id) && <XMarkIcon className="size-3" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{
  title: string;
  value: bigint;
  getCurrencyHelpersCached: (currency: string) => { toUIString: (amount: bigint) => string };
}> = ({ title, value, getCurrencyHelpersCached }) => {
  const { toUIString } = getCurrencyHelpersCached('USD');

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

const StatsSection: React.FC<{
  title: string;
  items: { label: string; total: bigint; count: number; color?: string }[];
  total: bigint;
  getCurrencyHelpersCached: (currency: string) => { toUIString: (amount: bigint) => string };
}> = ({ title, items, total, getCurrencyHelpersCached }) => {
  const { toUIString } = getCurrencyHelpersCached('USD');

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border p-4">
      <h3 className="mb-3 text-lg font-medium">{title}</h3>
      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const percentage = total > 0n ? Number((item.total * 100n) / total) : 0;

          return (
            <div key={item.label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {item.color && (
                    <div
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                  <span className="text-sm capitalize">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{toUIString(item.total)}</span>
                  <span className="text-xs text-gray-500">({item.count})</span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(percentage, 100)}%`,
                    backgroundColor: item.color ?? '#3B82F6',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

StatsPage.auth = true;

export const getStaticProps = withI18nStaticProps(['common']);

export default StatsPage;
