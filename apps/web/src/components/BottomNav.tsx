import NavigationIcon from "./NavigationIcon";
import { NavLink } from "react-router-dom";
import { prefetchRoute } from "../lib/prefetch";
import { useAuth } from "../store/auth";
import { useUnreadCount } from "../hooks/useSocial";
import { useUnreadMessages } from "../hooks/useMessages";
import { navigationFor } from "../lib/navigation";
import { type IconName } from "./Icon";

/** App-style tab bar for members on phones and tablets. The menu button holds everything else. */
export default function BottomNav() {
  const { user } = useAuth();
  const notifications = useUnreadCount(Boolean(user));
  const messages = useUnreadMessages(Boolean(user));
  if (!user) return null;

  const n = notifications.data?.count ?? 0;
  const m = messages.data?.count ?? 0;
  const cls = ({ isActive }: { isActive: boolean }) => `tab-link${isActive ? " active" : ""}`;
  const tab = (to: string, icon: IconName, label: string, count = 0, end = false) => (
    <NavLink
      to={to}
      onPointerEnter={() => prefetchRoute(to)}
      onTouchStart={() => prefetchRoute(to)}
      onFocus={() => prefetchRoute(to)}
      end={end}
      className={cls}
      aria-label={count ? `${label}, непрочитанных: ${count}` : label}
    >
      <span className="tab-icon">
        <NavigationIcon name={icon} size={25} />
        {count > 0 && <span className="dot" aria-hidden="true" />}
      </span>
      <span className="tab-label">{label}</span>
    </NavLink>
  );

  return (
    <nav className="bottom-nav" aria-label="Вкладки">
      {navigationFor("member", "bottom").map((entry) => <span key={entry.id}>{tab(entry.to(user.username), entry.icon, entry.label, entry.id === "messages" ? m : entry.id === "notifications" ? n : 0, entry.end)}</span>)}
    </nav>
  );
}
