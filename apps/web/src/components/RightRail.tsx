import { Link } from "react-router-dom";
import { useAuth } from "../store/auth";

/** Shared placeholders until the server fundraiser and developer blog are available. */
export default function RightRail() {
  const { user } = useAuth();
  return (
    <aside className="right-rail aero-home-rail" aria-label="Bubble">
      {user && <section className="aero-widget"><strong>Сбор на сервер</strong><p>Скоро здесь появится информация о сборе.</p></section>}
      <section className="aero-widget"><strong>Дневник разработки</strong><p>Здесь будут новости разработки Bubble.</p></section>
      {!user && <><nav className="rail-links muted small" aria-label="Дополнительные ссылки"><Link to="/explore">Обзор</Link><a href="https://github.com/neucorochen/bubble" target="_blank" rel="noopener noreferrer">GitHub</a></nav><p className="muted small">© {new Date().getFullYear()} Bubble</p></>}
    </aside>
  );
}
