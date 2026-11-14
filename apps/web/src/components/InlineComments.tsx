import { displayNameOf } from "@commune/shared";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAddComment, useComments } from "../hooks/usePosts";
import { ProfileAvatar } from "./Avatar";
import CommentInput from "./CommentInput";

/** Mounted on first expansion; retained to preserve the draft and cached discussion. */
export default function InlineComments({ postId }: { postId: string }) {
  const comments = useComments(postId);
  const add = useAddComment(postId);
  const [content, setContent] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (content.trim()) add.mutate(content, { onSuccess: () => setContent("") });
  };
  return (
    <section className="inline-comments" aria-label="Комментарии">
      {comments.isLoading && <p role="status">Загрузка комментариев…</p>}
      {comments.isError && <p className="error" role="alert">{comments.error.message} <button type="button" className="link-btn" onClick={() => void comments.refetch()}>Попробовать снова</button></p>}
      {comments.isSuccess && comments.data.length === 0 && <p className="muted">Комментариев пока нет.</p>}
      {comments.data?.map((comment) => (
        <div className="inline-comment" key={comment.id}>
          <ProfileAvatar username={comment.author.username} displayName={comment.author.displayName} url={comment.author.avatarUrl} frame={comment.author.avatarFrame} size={28} />
          <div><Link to={`/u/${comment.author.username}`}>{displayNameOf(comment.author)}</Link>{" "}<time className="muted" dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString("ru-RU")}</time><p>{comment.content}</p></div>
        </div>
      ))}
      <form onSubmit={submit}>
        <CommentInput value={content} onChange={setContent} pending={add.isPending} />
        {add.isError && <p className="error" role="alert">{add.error.message}</p>}
      </form>
    </section>
  );
}
