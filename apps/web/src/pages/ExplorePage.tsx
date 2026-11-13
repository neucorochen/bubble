import { Fragment } from "react";
import { Link } from "react-router-dom";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import PlusBadge from "../components/PlusBadge";
import AdSlot, { FEED_AD_SLOT } from "../components/AdSlot";
import { timeAgo } from "../components/PostCard";
import { PostListSkeleton } from "../components/Skeleton";
import { useLoadMoreOnVisible } from "../hooks/useInfiniteScroll";
import { usePublicPosts } from "../hooks/usePublic";
import ImageGallery from "../components/ImageGallery";
import { LinkedText, LinkPreview } from "../components/LinkContent";
import { useAuth } from "../store/auth";

/** One ad after every N posts. */
const AD_EVERY = 5;

/**
 * Public, read-only page for visitors who aren't logged in (and for search engines and ad
 * reviewers). It is the only page that shows ads, because ads must only appear on pages that
 * Google's crawler can actually read, which the logged-in app is not.
 */
export default function ExplorePage() {
  const { user } = useAuth();
  const query = usePublicPosts();
  const posts = query.data?.pages.flatMap((p) => p.items) ?? [];
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;
  const sentinel = useLoadMoreOnVisible(
    () => void fetchNextPage(),
    hasNextPage && !isFetchingNextPage && !isError,
  );

  return (
    <>
      <section className="explore-hero">
        <div className="hero-art" aria-hidden="true">
          <span className="blob b1" />
          <span className="blob b2" />
          <span className="blob b3" />
        </div>
        <h1>Ваше место для общения</h1>
        <p>Публикуйте записи, подписывайтесь, общайтесь и следите за новостями. Регистрация бесплатна, исходный код открыт.</p>
        {!user && (
          <div className="row">
            <Link className="btn" to="/register">

              Создать аккаунт
            </Link>
            <Link className="btn btn-outline" to="/login">

              Войти
            </Link>
          </div>
        )}
      </section>

      {query.isLoading && <PostListSkeleton />}
      {query.isError && <p className="error center">{query.error.message}</p>}
      {query.isSuccess && posts.length === 0 && (
        <p className="muted center">Здесь пока пусто. Опубликуйте первую запись!</p>
      )}

      {posts.map((post, i) => (
        <Fragment key={post.id}>
          <article className="card post post-head">
            <Avatar username={post.author.username} url={post.author.avatarUrl} />
            <div className="post-main">
              <div className="post-meta">
                <strong className="user-link">@{post.author.username}</strong>
                <PlusBadge plus={post.author.plus} />
                <span className="muted">· {timeAgo(post.createdAt)}</span>
              </div>
              {post.content && <><p className="post-body"><LinkedText text={post.content} /></p><LinkPreview text={post.content} /></>}
              {(post.imageUrls?.length || post.imageUrl) && <ImageGallery images={post.imageUrls?.length ? post.imageUrls : [post.imageUrl!]} alt={`Изображение пользователя @${post.author.username}`} />}
              {post.musicAttachments?.map((track) => <p className="muted" key={track.id}>{track.unavailable ? "Трек недоступен" : `${track.artist} — ${track.title}`}</p>)}
              <p className="post-foot muted">
                <span className="metric">
                  <Icon name="heart" size={17} /> {post.likeCount}
                </span>
                <span className="metric">
                  <Icon name="comment" size={17} /> {post.commentCount}
                </span>
                <Link to={user ? `/posts/${post.id}` : "/login"}>
                  {user ? "Открыть запись" : "Войдите, чтобы присоединиться"}
                </Link>
              </p>
            </div>
          </article>
          {(i + 1) % AD_EVERY === 0 && <AdSlot slot={FEED_AD_SLOT} />}
        </Fragment>
      ))}

      {isFetchingNextPage && <PostListSkeleton count={1} />}
      {query.hasNextPage && <div ref={sentinel} aria-hidden="true" />}
      {query.hasNextPage && !isFetchingNextPage && (
        <button className="btn btn-ghost block" onClick={() => void query.fetchNextPage()}>

          Загрузить ещё
        </button>
      )}
    </>
  );
}
