import { Search, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { Button } from '~/components/ui/button';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { api } from '~/utils/api';

export const SearchExpenses: React.FC = () => {
  const { t } = useTranslationWithUtils();
  const [query, setQuery] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);

  const { data: allTags } = api.tag.getUserTags.useQuery();

  const { data: searchResults } = api.tag.searchExpenses.useQuery(
    { query: activeQuery ?? '', tagIds: activeTagIds },
    { enabled: activeQuery !== null && (activeQuery.trim().length > 0 || activeTagIds.length > 0) },
  );

  const handleSearch = useCallback(() => {
    if (query.trim() || selectedTagIds.length > 0) {
      setActiveQuery(query.trim());
      setActiveTagIds(selectedTagIds);
    }
  }, [query, selectedTagIds]);

  const handleClear = useCallback(() => {
    setQuery('');
    setSelectedTagIds([]);
    setIsOpen(false);
    setActiveQuery(null);
    setActiveTagIds([]);
  }, []);

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            placeholder={t('search.placeholder')}
            className="w-full rounded-md border bg-transparent py-2 pr-3 pl-9 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)}>
          {t('search.filters')}
        </Button>
        {(query || selectedTagIds.length > 0) && (
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <X className="size-4" />
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="flex flex-wrap gap-2 rounded-md border p-2">
          {allTags?.map((userTag) => (
            <button
              key={userTag.id}
              type="button"
              onClick={() => toggleTag(userTag.id)}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors ${
                selectedTagIds.includes(userTag.id)
                  ? 'text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              style={{
                backgroundColor: selectedTagIds.includes(userTag.id) ? userTag.color : undefined,
              }}
            >
              <div className="size-2 rounded-full" style={{ backgroundColor: userTag.color }} />
              {userTag.name}
            </button>
          ))}
        </div>
      )}

      {(query || selectedTagIds.length > 0) && (
        <Button variant="outline" size="sm" onClick={handleSearch}>
          {t('search.apply')}
        </Button>
      )}
    </div>
  );
};
