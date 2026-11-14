import type { FriendsVisibility } from "@commune/shared";
import { useFriendsAccess, useFriendsVisibility } from "../hooks/useSocial";

export default function FriendsPrivacySettings({ username }: { username: string }) {
  const access = useFriendsAccess(username);
  const save = useFriendsVisibility();

  return (
    <section className="card appearance-section" aria-labelledby="friends-privacy-title">
      <h2 id="friends-privacy-title">Список друзей в профиле</h2>
      {access.isPending && <p role="status">Загрузка…</p>}
      {access.isError ? (
        <div className="row">
          <p role="alert">{access.error.message}</p>
          <button type="button" className="btn" onClick={() => void access.refetch()}>
            Повторить
          </button>
        </div>
      ) : (
        access.data?.canView && (
          <>
            <label className="friends-privacy-field">
              Кто видит моих друзей
              <select
                value={access.data.friendsVisibility ?? "everyone"}
                disabled={save.isPending}
                onChange={(event) => save.mutate(event.target.value as FriendsVisibility)}
              >
                <option value="everyone">Все пользователи</option>
                <option value="friends">Только друзья</option>
                <option value="only_me">Только я</option>
              </select>
            </label>
            <p className="muted" role="status">
              {save.isPending
                ? "Сохранение…"
                : save.isSuccess
                  ? "Настройка сохранена"
                  : "Изменения сохраняются автоматически."}
            </p>
            {save.isError && (
              <div className="row">
                <p className="error" role="alert">
                  {save.error.message}
                </p>
                <button type="button" className="btn" onClick={() => save.mutate(save.variables)}>
                  Повторить сохранение
                </button>
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}
