-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "mutedAt" TIMESTAMP(3),
ADD COLUMN     "mutedBy" INTEGER,
ADD COLUMN     "note" TEXT;

-- CreateTable
CREATE TABLE "ExpensePayment" (
    "id" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "expenseId" UUID NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseTag" (
    "expenseId" UUID NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ExpenseTag_pkey" PRIMARY KEY ("expenseId","tagId")
);

-- CreateIndex
CREATE INDEX "ExpensePayment_expenseId_idx" ON "ExpensePayment"("expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag"("userId", "name");

-- CreateIndex
CREATE INDEX "Expense_deletedAt_idx" ON "Expense"("deletedAt");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_mutedBy_fkey" FOREIGN KEY ("mutedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseTag" ADD CONSTRAINT "ExpenseTag_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseTag" ADD CONSTRAINT "ExpenseTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill ExpensePayment for existing expenses: each pre-existing expense gets a single
-- payment row equal to (paidBy, amount), preserving current single-payer semantics.
INSERT INTO "ExpensePayment" ("id", "amount", "expenseId", "userId")
SELECT gen_random_uuid()::text, "amount", "id", "paidBy"
FROM "Expense";

-- Replace BalanceView with the generalized multi-payer formula:
--   net_XY = round((paid_X * share_Y - paid_Y * share_X) / total)
-- where share_i = paid_i - participant.amount_i and paid_i comes from ExpensePayment.
-- For single-payer expenses this reduces exactly to the previous formula, so existing
-- balances are unchanged. Muted expenses are excluded from balances.
CREATE OR REPLACE VIEW "public"."BalanceView" AS
WITH "Payments" AS (
    SELECT
        ep."expenseId",
        ep."userId",
        SUM(ep."amount") AS "paid"
    FROM "public"."ExpensePayment" AS ep
    GROUP BY ep."expenseId", ep."userId"
),
"Shares" AS (
    SELECT
        e."id" AS "expenseId",
        e."amount" AS "total",
        e."groupId",
        e.currency,
        e."createdAt",
        e."updatedAt",
        ep."userId",
        COALESCE(p."paid", 0) AS "paid",
        (COALESCE(p."paid", 0) - ep."amount") AS "share"
    FROM "public"."Expense" AS e
    JOIN "public"."ExpenseParticipant" AS ep ON ep."expenseId" = e."id"
    LEFT JOIN "Payments" AS p ON p."expenseId" = e."id" AND p."userId" = ep."userId"
    WHERE e."deletedAt" IS NULL
      AND e."mutedAt" IS NULL
      AND e."amount" <> 0
),
"Pairs" AS (
    SELECT
        a."expenseId",
        a."groupId",
        a.currency,
        a."createdAt"::timestamp,
        a."updatedAt"::timestamp,
        a."userId" AS "user_id_A",
        b."userId" AS "user_id_B",
        ROUND(
            (a."paid" * b."share" - b."paid" * a."share")::numeric / a."total"::numeric
        ) AS "net_amount"
    FROM "Shares" AS a
    JOIN "Shares" AS b ON b."expenseId" = a."expenseId" AND b."userId" > a."userId"
)
SELECT
    "user_id_A" AS "userId",
    "user_id_B" AS "friendId",
    "groupId",
    currency,
    "net_amount" AS amount,
    "createdAt",
    "updatedAt"
FROM "Pairs"
WHERE "net_amount" <> 0
UNION ALL
SELECT
    "user_id_B" AS "userId",
    "user_id_A" AS "friendId",
    "groupId",
    currency,
    -"net_amount" AS amount,
    "createdAt",
    "updatedAt"
FROM "Pairs"
WHERE "net_amount" <> 0;

-- Replace get_balance_at_date with the same generalized formula + date filter + muted filter.
CREATE OR REPLACE FUNCTION public.get_balance_at_date(before_date TIMESTAMP WITH TIME ZONE)
RETURNS TABLE (
    "userId" INT,
    "friendId" INT,
    "groupId" INT,
    currency TEXT,
    amount BIGINT,
    "createdAt" TIMESTAMP,
    "updatedAt" TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    WITH "Payments" AS (
        SELECT ep."expenseId", ep."userId", SUM(ep."amount") AS "paid"
        FROM "public"."ExpensePayment" AS ep
        GROUP BY ep."expenseId", ep."userId"
    ),
    "Shares" AS (
        SELECT
            e."id" AS "expenseId",
            e."amount" AS "total",
            e."groupId",
            e.currency,
            e."createdAt",
            e."updatedAt",
            ep."userId",
            COALESCE(p."paid", 0) AS "paid",
            (COALESCE(p."paid", 0) - ep."amount") AS "share"
        FROM "public"."Expense" AS e
        JOIN "public"."ExpenseParticipant" AS ep ON ep."expenseId" = e."id"
        LEFT JOIN "Payments" AS p ON p."expenseId" = e."id" AND p."userId" = ep."userId"
        WHERE e."deletedAt" IS NULL
          AND e."mutedAt" IS NULL
          AND e."amount" <> 0
          AND e."createdAt" < before_date
    ),
    "Pairs" AS (
        SELECT
            a."expenseId",
            a."groupId",
            a.currency,
            a."createdAt",
            a."updatedAt",
            a."userId" AS "user_id_A",
            b."userId" AS "user_id_B",
            ROUND(
                (a."paid" * b."share" - b."paid" * a."share")::numeric / a."total"::numeric
            )::BIGINT AS "net_amount"
        FROM "Shares" AS a
        JOIN "Shares" AS b ON b."expenseId" = a."expenseId" AND b."userId" > a."userId"
    )
    SELECT p."user_id_A", p."user_id_B", p."groupId", p.currency, p."net_amount", p."createdAt", p."updatedAt"
    FROM "Pairs" AS p WHERE p."net_amount" <> 0
    UNION ALL
    SELECT p."user_id_B", p."user_id_A", p."groupId", p.currency, -p."net_amount", p."createdAt", p."updatedAt"
    FROM "Pairs" AS p WHERE p."net_amount" <> 0;
END;
$$ LANGUAGE plpgsql STABLE;
