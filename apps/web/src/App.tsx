import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./store/auth";
import AeroTitlebar from "./components/AeroTitlebar";
import Header, { AUTH_PATHS } from "./components/Header";
import FeedPage from "./pages/FeedPage";
import VerifyBanner from "./components/VerifyBanner";
import PwaBanner from "./components/PwaBanner";
import ExplorePage from "./pages/ExplorePage";
import LeftNav from "./components/LeftNav";
import RightRail from "./components/RightRail";
import BottomNav from "./components/BottomNav";
import Brand from "./components/BrandMark";
import Icon from "./components/Icon";
import { PageSkeleton } from "./components/Skeleton";
import { useStoredFont } from "./lib/siteFont";
import { appearanceStyle } from "./lib/appearance";
import { prefetchLikelyRoutes } from "./lib/prefetch";

const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const PostPage = lazy(() => import("./pages/PostPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const FriendsPage = lazy(() => import("./pages/FriendsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const CommunitiesPage = lazy(() => import("./pages/CommunitiesPage"));
const CommunityPage = lazy(() => import("./pages/CommunityPage"));
const PlusPage = lazy(() => import("./pages/PlusPage"));
const InsightsPage = lazy(() => import("./pages/InsightsPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const NewsPage = lazy(() => import("./pages/NewsPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPassword"));

const TITLES: Record<string, string> = {
  "/": "Bubble — открытая платформа сообществ",
  "/explore": "Обзор",
  "/news": "Последние новости",
  "/contact": "Связаться",
  "/plus": "Bubble Plus",
  "/insights": "Статистика",
  "/messages": "Сообщения",
  "/communities": "Сообщества",
  "/notifications": "Уведомления",
  "/search": "Поиск",
  "/friends": "Друзья",
  "/settings": "Настройки",
  "/login": "Вход",
  "/register": "Регистрация",
  "/forgot-password": "Восстановление пароля",
  "/reset-password": "Сброс пароля",
  "/admin": "Администрирование",
};

/** Per-page browser title and canonical link, so tabs, history and search engines get real names. */
function RouteMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const user = /^\/u\/([^/]+)/.exec(pathname)?.[1];
    const community = /^\/c\/([^/]+)/.exec(pathname)?.[1];
    const name =
      TITLES[pathname] ??
      (user
        ? "Профиль"
        : community
          ? `c/${decodeURIComponent(community)}`
          : pathname.startsWith("/messages")
            ? "Сообщения"
            : pathname.startsWith("/posts/")
              ? "Запись"
              : "Bubble");
    if (!user) document.title = pathname === "/" ? name : `${name} · Bubble`;

    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = `${window.location.origin}${pathname}`;

    // Move keyboard and screen-reader focus to the page content after navigating.
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageSkeleton />;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

/** "/" shows the feed to members and the public Explore page to everyone else. */
function Home() {
  const { user, loading } = useAuth();
  if (loading) return <PageSkeleton />;
  return user ? <FeedPage /> : <ExplorePage />;
}

function AppRoutes({ onWallpaperPreview }: { onWallpaperPreview?: (path?: string | null) => void } = {}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/" element={<Home />} />
        <Route
          path="/posts/:id"
          element={
            <Protected>
              <PostPage />
            </Protected>
          }
        />
        <Route
          path="/u/:username"
          element={
            <Protected>
              <ProfilePage />
            </Protected>
          }
        />
        <Route path="/settings" element={<Protected><SettingsPage onWallpaperPreview={onWallpaperPreview} /></Protected>} />
        <Route path="/friends" element={<Protected><FriendsPage /></Protected>} />
        <Route path="/friends/:username" element={<Protected><FriendsPage /></Protected>} />
        <Route
          path="/notifications"
          element={
            <Protected>
              <NotificationsPage />
            </Protected>
          }
        />
        <Route
          path="/admin"
          element={
            <Protected>
              <AdminPage />
            </Protected>
          }
        />

        <Route
          path="/communities"
          element={
            <Protected>
              <CommunitiesPage />
            </Protected>
          }
        />
        <Route
          path="/c/:slug"
          element={
            <Protected>
              <CommunityPage />
            </Protected>
          }
        />
        <Route
          path="/search"
          element={
            <Protected>
              <SearchPage />
            </Protected>
          }
        />
        <Route
          path="/plus"
          element={
            <Protected>
              <PlusPage />
            </Protected>
          }
        />
        <Route
          path="/insights"
          element={
            <Protected>
              <InsightsPage />
            </Protected>
          }
        />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route
          path="/messages"
          element={
            <Protected>
              <MessagesPage />
            </Protected>
          }
        />
        <Route
          path="/messages/:id"
          element={
            <Protected>
              <MessagesPage />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

/** Left panel of the sign-in screens (hidden on phones). */
function AuthArt() {
  return (
    <aside className="auth-art" aria-hidden="true">
      <Brand size={40} />
      <div className="auth-art-body">
        <p className="art-title">Ваши люди и новости — в одном месте.</p>
        <ul>
          <li>
            <Icon name="users" size={20} /> Вступайте в сообщества и подписывайтесь на людей
          </li>
          <li>
            <Icon name="mail" size={20} /> Общайтесь с друзьями в личных сообщениях
          </li>
          <li>
            <Icon name="news" size={20} /> Читайте новости рядом с лентой
          </li>
        </ul>
      </div>
      <span className="blob b1" />
      <span className="blob b2" />
      <span className="blob b3" />
    </aside>
  );
}

export default function App() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const authPage = AUTH_PATHS.includes(pathname);
  const signedIn = Boolean(user);
  const fontFamily = useStoredFont(user?.appearance?.font);
  const [wallpaperPreview, setWallpaperPreview] = useState<string | null>();
  const backgroundUrl = pathname === "/settings" && wallpaperPreview !== undefined
    ? wallpaperPreview : user?.appearance?.backgroundUrl;
  // Once signed in, quietly download the most-used pages so tapping them is instant.
  useEffect(() => {
    if (signedIn) prefetchLikelyRoutes();
  }, [signedIn]);
  // Messages need room for two panes, so that page drops the news column.
  const wide = pathname.startsWith("/messages");

  const skip = (
    <a href="#main" className="skip-link">
      Skip to content
    </a>
  );

  if (authPage) {
    return (
      <div className="aero-app aero-auth" data-theme="aero-blue">
        {skip}
        <RouteMeta />
        <PwaBanner />
        <div className="auth-split">
          <AuthArt />
          <main id="main" tabIndex={-1} className="auth-main">
            <Link to="/" className="auth-brand" aria-label="На главную Bubble">
              <Brand size={36} />
            </Link>
            <AppRoutes />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div
      className="aero-app aero-home"
      data-theme="aero-blue"
      data-custom-font={Boolean(fontFamily) || undefined}
      data-custom-primary={Boolean(user?.appearance?.primaryColor) || undefined}
      data-custom-wallpaper={Boolean(backgroundUrl) || undefined}
      style={appearanceStyle({ ...user?.appearance, backgroundUrl }, fontFamily)}
    >
      <div className="aero-fixed-frame" aria-hidden="true" />
      <div className="aero-window">
      <AeroTitlebar />
      {skip}
      <RouteMeta />
      <Header />
      <VerifyBanner />
      <PwaBanner />
      <div
        className={`shell${user ? " has-left" : ""}${wide ? " wide" : ""}`}
        role="region"
        aria-label="Содержимое окна"
        tabIndex={0}
      >
        {user && <LeftNav />}
        <main id="main" tabIndex={-1} className="container">
          <AppRoutes onWallpaperPreview={setWallpaperPreview} />
        </main>
        {!wide && <RightRail />}
      </div>
      <BottomNav />
      </div>
    </div>
  );
}
