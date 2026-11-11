import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./store/auth";
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
import { prefetchLikelyRoutes } from "./lib/prefetch";
import MusicPlayer from "./components/MusicPlayer";

const PostPage = lazy(() => import("./pages/PostPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
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
const MusicPage = lazy(() => import("./pages/MusicPage"));

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
  "/login": "Вход",
  "/register": "Регистрация",
  "/forgot-password": "Восстановление пароля",
  "/reset-password": "Сброс пароля",
  "/admin": "Администрирование",
  "/music": "Музыка",
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
        ? `@${decodeURIComponent(user)}`
        : community
          ? `c/${decodeURIComponent(community)}`
          : pathname.startsWith("/messages")
            ? "Сообщения"
            : pathname.startsWith("/posts/")
              ? "Запись"
              : "Bubble");
    document.title = pathname === "/" ? name : `${name} · Bubble`;

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

function AppRoutes() {
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
          path="/music"
          element={
            <Protected>
              <MusicPage />
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
  const aeroHome = !authPage;
  useEffect(() => {
    if (!aeroHome) return;
    const home = document.querySelector<HTMLElement>(".aero-home");
    const shell = home?.querySelector<HTMLElement>(".shell");
    const header = home?.querySelector<HTMLElement>(".header");
    if (!home || !shell || !header) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const banner = home.querySelector<HTMLElement>(".aero-window > .banner");
      const top = header.getBoundingClientRect().bottom + (banner?.offsetHeight ?? 0);
      const rect = shell.getBoundingClientRect();
      home.style.setProperty("--aero-chrome-bottom", `${top}px`);
      home.style.setProperty("--aero-shell-cut-top", `${Math.max(0, top - rect.top)}px`);
      home.style.setProperty("--aero-shell-cut-bottom", `${Math.max(0, rect.bottom - window.innerHeight + 11)}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    observer.observe(shell);
    observer.observe(header);
    const banner = home.querySelector<HTMLElement>(".aero-window > .banner");
    if (banner) observer.observe(banner);
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("pageshow", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pageshow", schedule);
      for (const key of ["--aero-chrome-bottom", "--aero-shell-cut-top", "--aero-shell-cut-bottom"]) home.style.removeProperty(key);
    };
  }, [aeroHome]);
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
    <div className="aero-app aero-home" data-theme="aero-blue">
      <div className="aero-fixed-frame" aria-hidden="true" />
      <div className="aero-window">
      {(
        <div className="aero-titlebar" aria-hidden="true">
          <span className="aero-window-controls">
            <span><i className="aero-control-minimize" /></span><span><i className="aero-control-maximize" /></span><span className="aero-window-close"><i className="aero-control-close" /></span>
          </span>
        </div>
      )}
      {skip}
      <RouteMeta />
      <Header />
      <VerifyBanner />
      <PwaBanner />
      <div className={`shell${user ? " has-left" : ""}${wide ? " wide" : ""}`}>
        {user && <LeftNav />}
        <main id="main" tabIndex={-1} className="container">
          <AppRoutes />
        </main>
        {!wide && <RightRail />}
      </div>
      <BottomNav />
      <MusicPlayer />
      </div>
    </div>
  );
}
