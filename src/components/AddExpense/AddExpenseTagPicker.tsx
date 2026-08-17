import { Plus, Tag as TagIcon, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { useAddExpenseStore } from '~/store/addStore';
import { api } from '~/utils/api';

const TAG_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#6366F1',
];

export const AddExpenseTagPicker: React.FC = () => {
  const { t } = useTranslationWithUtils();
  const selectedTagIds = useAddExpenseStore((s) => s.selectedTagIds);
  const setSelectedTagIds = useAddExpenseStore((s) => s.actions.setSelectedTagIds);
  const [showCreate, setShowCreate] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]!);

  const apiUtils = api.useUtils();
  const { data: allTags } = api.tag.getUserTags.useQuery();

  const createTagMutation = api.tag.createTag.useMutation({
    onSuccess: (createdTag) => {
      void apiUtils.tag.getUserTags.invalidate();
      setSelectedTagIds([...selectedTagIds, createdTag.id]);
      setNewTagName('');
      setShowCreate(false);
      toast.success(t('tags.created'));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const toggleTag = useCallback(
    (tagId: string) => {
      if (selectedTagIds.includes(tagId)) {
        setSelectedTagIds(selectedTagIds.filter((id) => id !== tagId));
      } else {
        setSelectedTagIds([...selectedTagIds, tagId]);
      }
    },
    [selectedTagIds, setSelectedTagIds],
  );

  const handleCreateTag = useCallback(() => {
    if (newTagName.trim()) {
      createTagMutation.mutate({ name: newTagName.trim(), color: newTagColor });
    }
  }, [newTagName, newTagColor, createTagMutation]);

  const availableTags = allTags?.filter((tag) => !selectedTagIds.includes(tag.id)) ?? [];
  const selectedTags = allTags?.filter((tag) => selectedTagIds.includes(tag.id)) ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => toggleTag(tag.id)}
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
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
                >
                  <div className="size-3 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 rounded-full px-2 text-xs"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="size-3" />
        </Button>
      </div>

      {showCreate && (
        <div className="flex flex-col gap-2 rounded-md border p-2">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder={t('tags.name_placeholder')}
            className="rounded-md border bg-transparent px-2 py-1 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateTag();
              }
            }}
            autoFocus
          />
          <div className="flex flex-wrap gap-1">
            {TAG_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setNewTagColor(color)}
                className={`size-5 rounded-full ${
                  newTagColor === color ? 'ring-offset-background ring-2 ring-offset-1' : ''
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCreate(false)}
              className="h-7 text-xs"
            >
              {t('actions.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || createTagMutation.isPending}
              className="h-7 text-xs"
            >
              {t('actions.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
