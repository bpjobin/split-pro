import React from 'react';

import { useAddMultipleTransactions } from '~/hooks/useAddMultipleTransactions';

import { BankingTransactionList } from './BankTransactions/BankingTransactionList';

const AddBankTransactions: React.FC<{
  bankConnectionEnabled: boolean;
  children: React.ReactNode;
}> = ({ bankConnectionEnabled, children }) => {
  const {
    addAllMultipleExpenses,
    addOneByOneMultipleExpenses,
    clearFields,
    multipleTransactions,
    setMultipleTransactions,
    isTransactionLoading,
    setSingleTransaction,
  } = useAddMultipleTransactions();

  return (
    <BankingTransactionList
      add={setSingleTransaction}
      addAllMultipleExpenses={addAllMultipleExpenses}
      addOneByOneMultipleExpenses={addOneByOneMultipleExpenses}
      multipleTransactions={multipleTransactions}
      setMultipleTransactions={setMultipleTransactions}
      isTransactionLoading={isTransactionLoading}
      bankConnectionEnabled={bankConnectionEnabled}
      clearFields={clearFields}
    >
      {children}
    </BankingTransactionList>
  );
};

export default AddBankTransactions;
