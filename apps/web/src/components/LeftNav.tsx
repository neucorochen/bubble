import { Link, NavLink } from "react-router-dom";
import { prefetchRoute } from "../lib/prefetch";
import { useAuth } from "../store/auth";
import { useUnreadCount } from "../hooks/useSocial";
import { useUnreadMessages } from "../hooks/useMessages";
import Brand from "./BrandMark";
import { navigationFor } from "../lib/navigation";
import type { IconName } from "./Icon";
import NavigationIcon from "./NavigationIcon";

/** Left column for members on wide screens: brand and primary navigation. */
export default function LeftNav() {
  const { user } = useAuth();
  const notifications = useUnreadCount(Boolean(user));
  const messages = useUnreadMessages(Boolean(user));
  if (!user) return null;

  const n = notifications.data?.count ?? 0;
  const m = messages.data?.count ?? 0;
  const cls = ({ isActive }: { isActive: boolean }) => `side-link${isActive ? " active" : ""}`;
  const badge = (count: number) =>
    count > 0 ? <span className="pill">{count > 99 ? "99+" : count}</span> : null;
  const link = (to: string, icon: IconName, label: string, count = 0, end = false) => (
    <NavLink
      to={to}
      onPointerEnter={() => prefetchRoute(to)}
      onTouchStart={() => prefetchRoute(to)}
      onFocus={() => prefetchRoute(to)}
      end={end}
      className={cls}
      aria-label={count ? `${label}, непрочитанных: ${count}` : undefined}
    >
      <span className="side-icon">
        <NavigationIcon name={icon} size={28} />
      </span>
      <span className="side-label">{label}</span>
      {badge(count)}
    </NavLink>
  );

  return (
    <aside className="left-nav" aria-label="Основная навигация">
      <Link to="/" className="side-brand" aria-label="На главную Bubble">
        <Brand size={34} />
      </Link>
      <nav>
        {navigationFor("member", "desktop").map((item) => <span key={item.id}>{link(item.to(user.username), item.icon, item.label, item.id === "messages" ? m : item.id === "notifications" ? n : 0, item.end)}</span>)}
      </nav>
    </aside>
  );
}
