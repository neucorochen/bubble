import { useState } from "react";
import { RowsSkeleton } from "../components/Skeleton";
import type { FormEvent } from "react";
import { pluralRu } from "../lib/plural";
import { Link, useNavigate } from "react-router-dom";
import { createCommunitySchema } from "@commune/shared";
import { useCommunities, useCreateCommunity } from "../hooks/useCommunities";

export default function CommunitiesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ slug: "", name: "", description: "" });
  const [error, setError] = useState<string | null>(null);

  const list = useCommunities({ q: q.trim() || undefined, mine: tab === "mine" });
  const create = useCreateCommunity();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = createCommunitySchema.safeParse(form);
    if (!parsed.success) {
      setError("Проверьте введённые данные");
      return;
    }
    create.mutate(parsed.data, {
      onSuccess: (c) => navigate(`/c/${c.slug}`),
      onError: (err) => setError(err.message),
    });
  };

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <>
      <div className="row between">
        <h1 className="search-title">Сообщества</h1>
        <button className="btn" onClick={() => setCreating((c) => !c)}>
          {creating ? "Отмена" : "Создать сообщество"}
        </button>
      </div>

      {creating && (
        <form className="card auth" onSubmit={submit}>
          <label>

            Имя
            <input value={form.name} onChange={(e) => set("name")(e.target.value)} maxLength={40} />
          </label>
          <label>

            Адрес (буквы, цифры, подчёркивания)
            <input
              value={form.slug}
              onChange={(e) => set("slug")(e.target.value.toLowerCase())}
              maxLength={24}
              placeholder="например, typescript"
            />
          </label>
          <label>

            Описание
            <textarea
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              maxLength={280}
              rows={3}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn block" disabled={create.isPending}>
            {create.isPending ? "Создание…" : "Создать сообщество"}
          </button>
        </form>
      )}

      <input
        className="community-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Найти сообщество"
        aria-label="Найти сообщество"
        maxLength={30}
      />

      <div className="tabs feed-tabs" role="tablist">
        {(["all", "mine"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "all" ? "Популярные" : "Мои"}
          </button>
        ))}
      </div>

      {list.isLoading && <RowsSkeleton count={5} avatar={40} card />}
      {list.isError && <p className="error center">{list.error.message}</p>}
      {list.isSuccess && list.data.length === 0 && (
        <p className="muted center">
          {tab === "mine" ? "Вы пока не вступили ни в одно сообщество." : "Сообщества не найдены."}
        </p>
      )}
      {list.data?.map((c) => (
        <Link key={c.id} to={`/c/${c.slug}`} className="card person">
          <div>
            <strong>{c.name}</strong> <span className="muted">c/{c.slug}</span>
            {c.description && <p className="muted">{c.description}</p>}
            <p className="muted">
              {c.memberCount} {pluralRu(c.memberCount, "участник", "участника", "участников")}
              {c.joinedByMe && " · Вы участник"}
            </p>
          </div>
        </Link>
      ))}
    </>
  );
}
