import { pluralRu } from "../lib/plural";
import { Link, useParams } from "react-router-dom";
import { CardsSkeleton } from "../components/Skeleton";
import Composer from "../components/Composer";
import PostList from "../components/PostList";
import { useCommunity, useCommunityPosts, useMembership } from "../hooks/useCommunities";

export default function CommunityPage() {
  const { slug = "" } = useParams();
  const community = useCommunity(slug);
  const posts = useCommunityPosts(slug);
  const { join, leave } = useMembership(slug);

  if (community.isLoading) return <CardsSkeleton count={2} />;
  if (community.isError || !community.data) {
    return (
      <p className="error center">

        Сообщество не найдено. <Link to="/communities">Смотреть сообщества</Link>
      </p>
    );
  }

  const c = community.data;
  const busy = join.isPending || leave.isPending;

  return (
    <>
      <Link to="/communities" className="muted">

        ← Все сообщества
      </Link>
      <section className="card community-head">
        <div className="row between">
          <div>
            <h1 className="community-title">{c.name}</h1>
            <p className="muted">
              c/{c.slug} · {c.memberCount} {pluralRu(c.memberCount, "участник", "участника", "участников")}
              {c.myRole === "owner" && " · Вы владелец"}
            </p>
          </div>
          {c.myRole !== "owner" &&
            (c.joinedByMe ? (
              <button className="btn btn-outline" disabled={busy} onClick={() => leave.mutate()}>

                Вы участник ✓
              </button>
            ) : (
              <button className="btn" disabled={busy} onClick={() => join.mutate()}>

                Вступить
              </button>
            ))}
        </div>
        {c.description && <p>{c.description}</p>}
        {(join.isError || leave.isError) && (
          <p className="error">{(join.error ?? leave.error)?.message}</p>
        )}
      </section>

      {c.joinedByMe ? (
        <Composer communitySlug={c.slug} allowPaid={false} />
      ) : (
        <p className="muted center">Вступите в сообщество, чтобы публиковать записи.</p>
      )}
      <PostList query={posts} emptyMessage="Записей пока нет. Начните обсуждение." />
    </>
  );
}
