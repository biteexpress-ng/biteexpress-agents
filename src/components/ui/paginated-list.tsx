"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ApiRequestError, type Pagination } from "@/lib/api/types";
import { Alert } from "./alert";
import { Button } from "./button";

interface PaginatedListProps<T, R extends { pagination: Pagination }> {
  /** Fetch one page. Page 1 also carries any header data (balances/stats). */
  fetchPage: (page: number) => Promise<R>;
  selectItems: (response: R) => T[];
  itemKey: (item: T) => React.Key;
  renderItem: (item: T) => React.ReactNode;
  /** Optional header rendered from the first page's full response. */
  renderHeader?: (first: R) => React.ReactNode;
  renderEmpty: () => React.ReactNode;
  /** One skeleton row; repeated `skeletonCount` times on first load. */
  skeleton: React.ReactNode;
  skeletonCount?: number;
}

/**
 * Load-more list: first page shows skeleton rows, appends subsequent pages
 * client-side (field-friendlier than numbered pages), surfaces the API error
 * verbatim with a retry, and teaches via the empty-state slot. Fetch callbacks
 * are held in refs so inline parent closures can't trigger refetch loops.
 */
export function PaginatedList<T, R extends { pagination: Pagination }>({
  fetchPage,
  selectItems,
  itemKey,
  renderItem,
  renderHeader,
  renderEmpty,
  skeleton,
  skeletonCount = 5,
}: PaginatedListProps<T, R>) {
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const selectRef = useRef(selectItems);
  selectRef.current = selectItems;

  const [items, setItems] = useState<T[]>([]);
  const [first, setFirst] = useState<R | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  async function loadFirst() {
    setState("loading");
    setError(null);
    try {
      const res = await fetchRef.current(1);
      setFirst(res);
      setItems(selectRef.current(res));
      setPagination(res.pagination);
      setState("ready");
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn't load this. Check your connection and try again.",
      );
      setState("error");
    }
  }

  useEffect(() => {
    void loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMore() {
    if (!pagination) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const res = await fetchRef.current(pagination.current_page + 1);
      setItems((cur) => [...cur, ...selectRef.current(res)]);
      setPagination(res.pagination);
    } catch (err) {
      setMoreError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn't load more. Try again.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i}>{skeleton}</div>
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <div>
        <Alert tone="error">{error}</Alert>
        <Button
          variant="secondary"
          fullWidth
          className="mt-4"
          onClick={() => void loadFirst()}
        >
          <RefreshCw className="size-4" aria-hidden />
          Try again
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div>
        {first && renderHeader?.(first)}
        {renderEmpty()}
      </div>
    );
  }

  const hasMore = pagination
    ? pagination.current_page < pagination.last_page
    : false;

  return (
    <div>
      {first && renderHeader?.(first)}
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={itemKey(item)}>{renderItem(item)}</li>
        ))}
      </ul>
      {moreError && (
        <Alert tone="error" className="mt-4">
          {moreError}
        </Alert>
      )}
      {hasMore && (
        <Button
          variant="secondary"
          fullWidth
          className="mt-4"
          loading={loadingMore}
          onClick={loadMore}
        >
          Load more
        </Button>
      )}
    </div>
  );
}
