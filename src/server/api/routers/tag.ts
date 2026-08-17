import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { db } from '~/server/db';

export const tagRouter = createTRPCRouter({
  getUserTags: protectedProcedure.query(async ({ ctx }) => {
    const tags = await db.tag.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { expenseTags: true },
        },
      },
    });
    return tags;
  }),

  createTag: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await db.tag.findUnique({
        where: {
          userId_name: {
            userId: ctx.session.user.id,
            name: input.name,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Tag with this name already exists',
        });
      }

      return db.tag.create({
        data: {
          name: input.name,
          color: input.color,
          userId: ctx.session.user.id,
        },
      });
    }),

  updateTag: protectedProcedure
    .input(
      z.object({
        tagId: z.string(),
        name: z.string().min(1).max(50).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const tag = await db.tag.findUnique({
        where: { id: input.tagId },
        select: { userId: true },
      });

      if (!tag || tag.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Tag not found' });
      }

      if (input.name) {
        const existing = await db.tag.findUnique({
          where: {
            userId_name: {
              userId: ctx.session.user.id,
              name: input.name,
            },
          },
        });

        if (existing && existing.id !== input.tagId) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Tag with this name already exists',
          });
        }
      }

      return db.tag.update({
        where: { id: input.tagId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.color && { color: input.color }),
        },
      });
    }),

  deleteTag: protectedProcedure
    .input(z.object({ tagId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const tag = await db.tag.findUnique({
        where: { id: input.tagId },
        select: { userId: true },
      });

      if (!tag || tag.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Tag not found' });
      }

      return db.tag.delete({ where: { id: input.tagId } });
    }),

  addTagToExpense: protectedProcedure
    .input(z.object({ expenseId: z.string(), tagId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const tag = await db.tag.findUnique({
        where: { id: input.tagId },
        select: { userId: true },
      });

      if (!tag || tag.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Tag not found' });
      }

      const expense = await db.expenseParticipant.findUnique({
        where: {
          expenseId_userId: {
            expenseId: input.expenseId,
            userId: ctx.session.user.id,
          },
        },
      });

      if (!expense) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not a participant of this expense',
        });
      }

      const existing = await db.expenseTag.findUnique({
        where: {
          expenseId_tagId: {
            expenseId: input.expenseId,
            tagId: input.tagId,
          },
        },
      });

      if (existing) {
        return existing;
      }

      return db.expenseTag.create({
        data: {
          expenseId: input.expenseId,
          tagId: input.tagId,
        },
      });
    }),

  removeTagFromExpense: protectedProcedure
    .input(z.object({ expenseId: z.string(), tagId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const expense = await db.expenseParticipant.findUnique({
        where: {
          expenseId_userId: {
            expenseId: input.expenseId,
            userId: ctx.session.user.id,
          },
        },
      });

      if (!expense) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not a participant of this expense',
        });
      }

      return db.expenseTag.delete({
        where: {
          expenseId_tagId: {
            expenseId: input.expenseId,
            tagId: input.tagId,
          },
        },
      });
    }),

  getExpensesByTag: protectedProcedure
    .input(z.object({ tagId: z.string() }))
    .query(async ({ input, ctx }) => {
      const tag = await db.tag.findUnique({
        where: { id: input.tagId },
        select: { userId: true },
      });

      if (!tag || tag.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Tag not found' });
      }

      const expenseTags = await db.expenseTag.findMany({
        where: {
          tagId: input.tagId,
          expense: {
            deletedAt: null,
            expenseParticipants: {
              some: { userId: ctx.session.user.id },
            },
          },
        },
        include: {
          expense: {
            include: {
              expenseParticipants: true,
              paidByUser: true,
            },
          },
        },
        orderBy: {
          expense: { expenseDate: 'desc' },
        },
      });

      return expenseTags.map((et) => et.expense);
    }),

  searchExpenses: protectedProcedure
    .input(
      z.object({
        query: z.string().optional().default(''),
        tagIds: z.array(z.string()).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const hasQuery = input.query.trim().length > 0;
      const hasTagIds = input.tagIds && input.tagIds.length > 0;

      if (!hasQuery && !hasTagIds) {
        return [];
      }

      const where: Record<string, unknown> = {
        deletedAt: null,
        expenseParticipants: {
          some: { userId: ctx.session.user.id },
        },
      };

      if (hasQuery && hasTagIds) {
        where.OR = [
          { name: { contains: input.query, mode: 'insensitive' as const } },
          { note: { contains: input.query, mode: 'insensitive' as const } },
        ];
        where.tags = {
          some: {
            tagId: { in: input.tagIds },
          },
        };
      } else if (hasQuery) {
        where.OR = [
          { name: { contains: input.query, mode: 'insensitive' as const } },
          { note: { contains: input.query, mode: 'insensitive' as const } },
        ];
      } else if (hasTagIds) {
        where.tags = {
          some: {
            tagId: { in: input.tagIds },
          },
        };
      }

      const expenses = await db.expense.findMany({
        where,
        orderBy: { expenseDate: 'desc' },
        include: {
          expenseParticipants: true,
          paidByUser: true,
          tags: {
            include: { tag: true },
          },
          items: true,
        },
        take: 100,
      });

      return expenses;
    }),
});

export type TagRouter = typeof tagRouter;
