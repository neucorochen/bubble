import { useState } from "react";
import { PostListSkeleton } from "../components/Skeleton";
import type { FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ProfileAvatar } from "../components/Avatar";
import PostCard, { timeAgo } from "../components/PostCard";
import PlusBadge from "../components/PlusBadge";
import CommentInput from "../components/CommentInput";
import { LinkedText, LinkPreview } from "../components/LinkContent";
import { useTrackView } from "../hooks/useBilling";
import { useAddComment, useComments, usePost } from "../hooks/usePosts";

export default function PostPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  // Coming back from checkout: the unlock arrives by webhook, so keep checking for a moment.
  const justPaid = params.get("unlocked") === "1";
  const post = usePost(id, justPaid);
  useTrackView(id);
  const comments = useComments(id);
  const add = useAddComment(id);
  const [content, setContent] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    add.mutate(content, { onSuccess: () => setContent("") });
  };

  return (
    <>
      <Link to="/" className="muted">
        ← Вернуться к ленте
      </Link>
      {post.isLoading && <PostListSkeleton count={1} />}
      {post.isError && <p className="error center">Запись не найдена.</p>}
      {justPaid && post.data?.locked && (
        <p className="notice">Оплата получена. Открываем запись, это займёт несколько секунд…</p>
      )}
      {post.data && <PostCard post={post.data} />}

      <form className="card composer" onSubmit={submit}>
        <CommentInput value={content} onChange={setContent} pending={add.isPending} />
        <div className="composer-footer">
          <span className="muted">{content.length}/300</span>
        </div>
        {add.isError && <p className="error">{add.error.message}</p>}
      </form>

      {comments.data?.map((c) => (
        <div key={c.id} className="card comment post-head">
          <ProfileAvatar username={c.author.username} url={c.author.avatarUrl} size={32} />
          <div className="post-main">
            <div className="post-meta">
              <Link to={`/u/${c.author.username}`} className="user-link">
                @{c.author.username}
              </Link>
              <PlusBadge plus={c.author.plus} />
              <span className="muted">· {timeAgo(c.createdAt)}</span>
            </div>
            <p className="post-body"><LinkedText text={c.content} /></p><LinkPreview text={c.content} />
          </div>
        </div>
      ))}
    </>
  );
}
