import Head from 'next/head';
import React from 'react';
import MainLayout from '~/components/Layout/MainLayout';
import { SearchExpenses } from '~/components/SearchExpenses';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import type { NextPageWithUser } from '~/types';
import { withI18nStaticProps } from '~/utils/i18n/server';

const SearchPage: NextPageWithUser = () => {
  const { t } = useTranslationWithUtils();

  return (
    <>
      <Head>
        <title>
          {t('search.placeholder')} - {t('meta.application_name')}
        </title>
      </Head>
      <MainLayout title={t('search.placeholder')}>
        <SearchExpenses />
      </MainLayout>
    </>
  );
};

SearchPage.auth = true;

export const getStaticProps = withI18nStaticProps(['common']);

export default SearchPage;
