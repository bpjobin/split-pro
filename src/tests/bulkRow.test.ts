import { type Group, SplitType, type User } from '@prisma/client';

import {
  type BulkRow,
  buildBulkExpenses,
  createRow,
  isValidBulkRow,
  patchBulkRow,
  removeBulkRow,
} from '~/components/AddExpense/bulkRow';
import { type Participant, type SplitShares, initSplitShares } from '~/store/addStore';

// Mock dependencies
jest.mock('~/utils/array', () => ({
  shuffleArray: jest.fn(<T>(arr: T[]): T[] => arr), // No shuffling for predictable tests
}));

// Create mock users for testing
const createMockUser = (id: number, name: string, email: string): User => ({
  id,
  name,
  email,
  currency: 'USD',
  defaultCurrency: null,
  emailVerified: null,
  image: null,
  preferredLanguage: 'en',
  obapiProviderId: null,
  bankingId: null,
  hiddenFriendIds: [],
});

const userA = createMockUser(1, 'Alice', 'alice@example.com');
const userB = createMockUser(2, 'Bob', 'bob@example.com');

const createMockGroup = (id: number): Group =>
  ({
    id,
    publicId: `g${id}`,
    name: `Group ${id}`,
    image: null,
    userId: 1,
    defaultCurrency: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    splitwiseGroupId: null,
    simplifyDebts: false,
    archivedAt: null,
  }) satisfies Group;

const makeRow = (overrides: Partial<BulkRow> = {}): BulkRow => ({
  ...createRow(),
  ...overrides,
});

const createEqualSplitShares = (participants: Participant[]): SplitShares => {
  const splitShares: SplitShares = {};
  participants.forEach((participant) => {
    splitShares[participant.id] = initSplitShares();
  });
  return splitShares;
};

describe('createRow', () => {
  describe('Defaults', () => {
    it('should create an empty row with zero amount', () => {
      const row = createRow();
      expect(row.description).toBe('');
      expect(row.amountStr).toBe('');
      expect(row.amount).toBe(0n);
      expect(row.note).toBe('');
    });

    it('should set the date to the current date', () => {
      const before = new Date();
      const row = createRow();
      const after = new Date();
      expect(row.date).toBeInstanceOf(Date);
      expect(row.date.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(row.date.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Ids', () => {
    it('should assign a non-empty id', () => {
      expect(createRow().id.length).toBeGreaterThan(0);
    });

    it('should assign unique ids across calls', () => {
      const ids = new Set(Array.from({ length: 100 }, () => createRow().id));
      expect(ids.size).toBe(100);
    });
  });
});

describe('patchBulkRow', () => {
  describe('Patching', () => {
    it('should patch only the matching row', () => {
      const rows = [makeRow({ id: 'a', description: 'x' }), makeRow({ id: 'b' })];
      const result = patchBulkRow(rows, 'a', { description: 'updated', amount: 42n });

      expect(result[0]?.description).toBe('updated');
      expect(result[0]?.amount).toBe(42n);
      expect(result[1]?.description).toBe('');
      expect(result[1]?.amount).toBe(0n);
    });

    it('should return a new array with new row objects (immutability)', () => {
      const rows = [makeRow({ id: 'a' }), makeRow({ id: 'b' })];
      const result = patchBulkRow(rows, 'a', { note: 'n' });

      expect(result).not.toBe(rows);
      expect(result[0]).not.toBe(rows[0]);
      expect(result[1]).toBe(rows[1]);
      expect(rows[0]?.note).toBe('');
    });

    it('should leave rows unchanged for an unknown id', () => {
      const rows = [makeRow({ id: 'a' })];
      const result = patchBulkRow(rows, 'missing', { description: 'nope' });

      expect(result).toEqual(rows);
      expect(rows[0]?.description).toBe('');
    });
  });
});

describe('removeBulkRow', () => {
  describe('Removal', () => {
    it('should remove the matching row and preserve order', () => {
      const rows = [makeRow({ id: 'a' }), makeRow({ id: 'b' }), makeRow({ id: 'c' })];
      const result = removeBulkRow(rows, 'b');

      expect(result.map((row) => row.id)).toEqual(['a', 'c']);
    });

    it('should leave rows unchanged for an unknown id', () => {
      const rows = [makeRow({ id: 'a' })];
      expect(removeBulkRow(rows, 'missing')).toEqual(rows);
    });

    it('should return an empty array for empty input', () => {
      expect(removeBulkRow([], 'a')).toEqual([]);
    });
  });
});

describe('isValidBulkRow', () => {
  describe('Validation', () => {
    it('should be false when the amount is zero', () => {
      expect(isValidBulkRow(makeRow({ amount: 0n, description: 'Lunch' }))).toBe(false);
    });

    it('should be false when the description is empty', () => {
      expect(isValidBulkRow(makeRow({ amount: 100n, description: '' }))).toBe(false);
    });

    it('should be true when both amount and description are set', () => {
      expect(isValidBulkRow(makeRow({ amount: 100n, description: 'Lunch' }))).toBe(true);
    });

    it('should be true for a negative amount with a description', () => {
      expect(isValidBulkRow(makeRow({ amount: -100n, description: 'Refund' }))).toBe(true);
    });
  });
});

describe('buildBulkExpenses', () => {
  const participants: Participant[] = [
    { ...userA, amount: 0n },
    { ...userB, amount: 0n },
  ];
  const splitShares = createEqualSplitShares(participants);
  const fixedDate = new Date('2026-01-15T12:00:00Z');

  describe('Filtering', () => {
    it('should return an empty array when there are no rows', () => {
      const result = buildBulkExpenses({
        rows: [],
        currency: 'USD',
        category: 'food',
        splitType: SplitType.EQUAL,
        splitShares,
        participants,
        paidBy: userA,
      });
      expect(result).toEqual([]);
    });

    it('should filter out invalid rows and keep valid ones in order', () => {
      const result = buildBulkExpenses({
        rows: [
          makeRow({ id: '1', description: 'Valid one', amount: 100n }),
          makeRow({ id: '2', description: 'No amount', amount: 0n }),
          makeRow({ id: '3', description: '', amount: 50n }),
          makeRow({ id: '4', description: 'Valid two', amount: 200n }),
        ],
        currency: 'USD',
        category: 'food',
        splitType: SplitType.EQUAL,
        splitShares,
        participants,
        paidBy: userA,
      });

      expect(result).toHaveLength(2);
      expect(result.map((expense) => expense.name)).toEqual(['Valid one', 'Valid two']);
      expect(result.map((expense) => expense.amount)).toEqual([100n, 200n]);
    });
  });

  describe('Field mapping', () => {
    it('should map row fields onto the created expense', () => {
      const group = createMockGroup(7);
      const result = buildBulkExpenses({
        rows: [
          makeRow({ description: 'Lunch', amount: 100n, date: fixedDate, note: 'with salad' }),
        ],
        currency: 'USD',
        category: 'food',
        group,
        splitType: SplitType.EQUAL,
        splitShares,
        participants,
        paidBy: userA,
      });

      expect(result).toHaveLength(1);
      const expense = result[0];
      expect(expense?.name).toBe('Lunch');
      expect(expense?.currency).toBe('USD');
      expect(expense?.amount).toBe(100n);
      expect(expense?.groupId).toBe(7);
      expect(expense?.splitType).toBe(SplitType.EQUAL);
      expect(expense?.paidBy).toBe(userA.id);
      expect(expense?.category).toBe('food');
      expect(expense?.expenseDate?.getTime()).toBe(fixedDate.getTime());
      expect(expense?.note).toBe('with salad');
    });

    it('should set groupId to null when no group is given', () => {
      const result = buildBulkExpenses({
        rows: [makeRow({ description: 'Lunch', amount: 100n })],
        currency: 'USD',
        category: 'food',
        splitType: SplitType.EQUAL,
        splitShares,
        participants,
        paidBy: userA,
      });

      expect(result[0]?.groupId).toBeNull();
    });
  });

  describe('Participant split', () => {
    it('should split an equal amount between participants with payer adjustment', () => {
      const result = buildBulkExpenses({
        rows: [makeRow({ description: 'Dinner', amount: 100n })],
        currency: 'USD',
        category: 'food',
        splitType: SplitType.EQUAL,
        splitShares,
        participants,
        paidBy: userA,
      });

      expect(result[0]?.participants).toEqual([
        { userId: userA.id, amount: 50n },
        { userId: userB.id, amount: -50n },
      ]);
    });

    it('should create one expense per valid row with its own amount and date', () => {
      const firstDate = new Date('2026-01-15T12:00:00Z');
      const secondDate = new Date('2026-02-20T08:30:00Z');
      const result = buildBulkExpenses({
        rows: [
          makeRow({ description: 'Groceries', amount: 100n, date: firstDate }),
          makeRow({ description: 'Taxi', amount: 30n, date: secondDate }),
        ],
        currency: 'USD',
        category: 'food',
        splitType: SplitType.EQUAL,
        splitShares,
        participants,
        paidBy: userA,
      });

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Groceries');
      expect(result[0]?.amount).toBe(100n);
      expect(result[0]?.expenseDate?.getTime()).toBe(firstDate.getTime());
      expect(result[1]?.name).toBe('Taxi');
      expect(result[1]?.amount).toBe(30n);
      expect(result[1]?.expenseDate?.getTime()).toBe(secondDate.getTime());
      // 30n split equally: 15n each, payer A ends at 15n, B at -15n
      expect(result[1]?.participants).toEqual([
        { userId: userA.id, amount: 15n },
        { userId: userB.id, amount: -15n },
      ]);
    });
  });
});
