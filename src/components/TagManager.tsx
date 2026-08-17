import { Plus, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
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

export const TagManager: React.FC = () => {
  const { t } = useTranslationWithUtils();
  const apiUtils = api.useUtils();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]!);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const { data: tags, isLoading } = api.tag.getUserTags.useQuery();

  const createTagMutation = api.tag.createTag.useMutation({
    onSuccess: () => {
      void apiUtils.tag.getUserTags.invalidate();
      setNewTagName('');
      toast.success(t('tags.created'));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateTagMutation = api.tag.updateTag.useMutation({
    onSuccess: () => {
      void apiUtils.tag.getUserTags.invalidate();
      setEditingTagId(null);
      toast.success(t('tags.updated'));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteTagMutation = api.tag.deleteTag.useMutation({
    onSuccess: () => {
      void apiUtils.tag.getUserTags.invalidate();
      toast.success(t('tags.deleted'));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreateTag = useCallback(() => {
    if (newTagName.trim()) {
      createTagMutation.mutate({ name: newTagName.trim(), color: newTagColor });
    }
  }, [newTagName, newTagColor, createTagMutation]);

  const handleUpdateTag = useCallback(
    (tagId: string) => {
      if (editingName.trim()) {
        updateTagMutation.mutate({ tagId, name: editingName.trim() });
      }
    },
    [editingName, updateTagMutation],
  );

  const handleDeleteTag = useCallback(
    (tagId: string) => {
      deleteTagMutation.mutate({ tagId });
    },
    [deleteTagMutation],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder={t('tags.name_placeholder')}
            className="flex-1 rounded-md border bg-transparent px-3 py-2 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateTag();
              }
            }}
          />
          <Button
            size="sm"
            onClick={handleCreateTag}
            disabled={!newTagName.trim() || createTagMutation.isPending}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {TAG_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setNewTagColor(color)}
              className={`size-6 rounded-full ${
                newTagColor === color ? 'ring-offset-background ring-2 ring-offset-2' : ''
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">{t('tags.loading')}</p>
      ) : tags && tags.length > 0 ? (
        <div className="flex flex-col gap-2">
          {tags.map((userTag) => (
            <div key={userTag.id} className="flex items-center gap-2 rounded-md border p-2">
              <div
                className="size-4 shrink-0 rounded-full"
                style={{ backgroundColor: userTag.color }}
              />
              {editingTagId === userTag.id ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="flex-1 rounded-md border bg-transparent px-2 py-1 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateTag(userTag.id);
                    }
                  }}
                  onBlur={() => handleUpdateTag(userTag.id)}
                  autoFocus
                />
              ) : (
                <span className="flex-1 text-sm">
                  {userTag.name}
                  <span className="ml-2 text-xs text-gray-500">({userTag._count.expenseTags})</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditingTagId(userTag.id);
                  setEditingName(userTag.name);
                }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                {t('tags.edit')}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTag(userTag.id)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">{t('tags.no_tags')}</p>
      )}
    </div>
  );
};
