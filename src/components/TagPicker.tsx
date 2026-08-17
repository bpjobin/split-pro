import { Tag as TagIcon, X } from 'lucide-react';
import React, { useCallback } from 'react';
import { Button } from '~/components/ui/button';
import { api } from '~/utils/api';

interface TagPickerProps {
  expenseId: string;
  expenseTags: {
    tag: {
      id: string;
      name: string;
      color: string;
    };
  }[];
}

export const TagPicker: React.FC<TagPickerProps> = ({ expenseId, expenseTags }) => {
  const apiUtils = api.useUtils();

  const { data: allTags } = api.tag.getUserTags.useQuery();

  const addTagMutation = api.tag.addTagToExpense.useMutation({
    onSuccess: () => {
      void apiUtils.invalidate();
    },
  });

  const removeTagMutation = api.tag.removeTagFromExpense.useMutation({
    onSuccess: () => {
      void apiUtils.invalidate();
    },
  });

  const assignedTagIds = new Set(expenseTags.map((et) => et.tag.id));
  const availableTags = allTags?.filter((at) => !assignedTagIds.has(at.id)) ?? [];

  const handleAddTag = useCallback(
    (tagId: string) => {
      addTagMutation.mutate({ expenseId, tagId });
    },
    [addTagMutation, expenseId],
  );

  const handleRemoveTag = useCallback(
    (tagId: string) => {
      removeTagMutation.mutate({ expenseId, tagId });
    },
    [removeTagMutation, expenseId],
  );

  return (
    <div className="flex flex-wrap items-center gap-1">
      {expenseTags.map(({ tag: expenseTag }) => (
        <span
          key={expenseTag.id}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: expenseTag.color }}
        >
          {expenseTag.name}
          <button
            type="button"
            onClick={() => handleRemoveTag(expenseTag.id)}
            className="rounded-full hover:bg-white/20"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {availableTags.length > 0 && (
        <div className="group relative">
          <Button variant="ghost" size="sm" className="h-6 rounded-full px-2 text-xs">
            <TagIcon className="size-3" />
          </Button>
          <div className="bg-background absolute top-full left-0 z-10 mt-1 hidden w-40 rounded-md border shadow-md group-hover:block">
            {availableTags.map((userTag) => (
              <button
                key={userTag.id}
                type="button"
                onClick={() => handleAddTag(userTag.id)}
                className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
              >
                <div className="size-3 rounded-full" style={{ backgroundColor: userTag.color }} />
                {userTag.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
