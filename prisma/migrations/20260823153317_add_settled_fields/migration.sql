-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "settledAt" TIMESTAMP(3),
ADD COLUMN     "settledBy" INTEGER;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_settledBy_fkey" FOREIGN KEY ("settledBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
