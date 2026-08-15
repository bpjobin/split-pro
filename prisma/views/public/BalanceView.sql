WITH "Payments" AS (
  SELECT
    ep."expenseId",
    ep."userId",
    sum(ep."amount") AS "paid"
  FROM
    "ExpensePayment" ep
  GROUP BY
    ep."expenseId",
    ep."userId"
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
    coalesce(p."paid", 0) AS "paid",
    (coalesce(p."paid", 0) - ep."amount") AS "share"
  FROM
    "Expense" e
    JOIN "ExpenseParticipant" ep ON ((ep."expenseId" = e.id))
    LEFT JOIN "Payments" p ON (
      (p."expenseId" = e.id)
      AND (p."userId" = ep."userId")
    )
  WHERE
    (
      (e."deletedAt" IS NULL)
      AND (e."mutedAt" IS NULL)
      AND (e."amount" <> 0)
    )
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
    round(
      (
        ((a."paid" * b."share") - (b."paid" * a."share"))::numeric / a."total"::numeric
      )
    ) AS "net_amount"
  FROM
    "Shares" a
    JOIN "Shares" b ON (
      (b."expenseId" = a."expenseId")
      AND (b."userId" > a."userId")
    )
)
SELECT
  "Pairs"."user_id_A" AS "userId",
  "Pairs"."user_id_B" AS "friendId",
  "Pairs"."groupId",
  "Pairs".currency,
  "Pairs"."net_amount" AS amount,
  "Pairs"."createdAt",
  "Pairs"."updatedAt"
FROM
  "Pairs"
WHERE
  ("Pairs"."net_amount" <> 0)
UNION
ALL
SELECT
  "Pairs"."user_id_B" AS "userId",
  "Pairs"."user_id_A" AS "friendId",
  "Pairs"."groupId",
  "Pairs".currency,
  (- "Pairs"."net_amount") AS amount,
  "Pairs"."createdAt",
  "Pairs"."updatedAt"
FROM
  "Pairs"
WHERE
  ("Pairs"."net_amount" <> 0)
