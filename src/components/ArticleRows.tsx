import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { PostSummary } from '../lib/posts';

export default function ArticleRows({
  posts,
  from = '/journal',
  compact = false,
}: {
  posts: PostSummary[];
  from?: string;
  compact?: boolean;
}) {
  return (
    <div className={`post-index ${compact ? 'compact' : ''}`}>
      {posts.map((post) => (
        <Link
          className="post-index-row"
          key={post.id}
          to={`/journal/${post.slug}`}
          state={{ from }}
        >
          <div className="post-index-text">
            <span className="post-category">{post.category}</span>
            <h2>{post.title}</h2>
            {!compact && post.summary && <p>{post.summary}</p>}
          </div>
          <time dateTime={post.date}>{post.date}</time>
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
