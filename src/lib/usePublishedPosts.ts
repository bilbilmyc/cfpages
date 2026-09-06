import { useEffect, useState } from 'react';
import { requestJSON, type PostSummary } from './posts';
export function usePublishedPosts(query = '', offset = 0) {
  const [state, setState] = useState<{
    posts: PostSummary[];
    next: number | null;
    loading: boolean;
    error: string;
  }>({ posts: [], next: null, loading: true, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: '' }));
    const timer = setTimeout(
      () => {
        requestJSON<{ posts: PostSummary[]; next: number | null }>(
          `/api/posts?q=${encodeURIComponent(query)}&offset=${offset}`,
          { signal: controller.signal },
        )
          .then((data) => setState({ ...data, loading: false, error: '' }))
          .catch((error) => {
            if (!controller.signal.aborted)
              setState({ posts: [], next: null, loading: false, error: error.message });
          });
      },
      query ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, offset]);
  return state;
}
