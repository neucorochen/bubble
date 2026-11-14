import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AccountUser, FriendsVisibility, UpdateAppearanceInput } from "@commune/shared";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

export default function ProfileAppearancePrivacy({ user }: { user: AccountUser }) {
  const { applyAppearance, isCurrentAccount } = useAuth();
  const queryClient = useQueryClient();
  const setting = useMutation({
    mutationFn: (profileAppearanceVisibility: FriendsVisibility) =>
      api<UpdateAppearanceInput>("/users/me/appearance", {
        method: "PATCH",
        body: { profileAppearanceVisibility },
      }),
    onSuccess: (saved) => {
      if (!isCurrentAccount(user.id)) return;
      applyAppearance(user.id, saved);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  return (
    <section className="card appearance-section" aria-labelledby="profile-appearance-privacy-title">
      <h2 id="profile-appearance-privacy-title">Оформление профиля</h2>
      <label className="friends-privacy-field">
        Кто видит оформление профиля
        <select
          value={
            setting.isPending ? setting.variables : (user.profileAppearanceVisibility ?? "everyone")
          }
          disabled={setting.isPending}
          onChange={(event) => setting.mutate(event.target.value as FriendsVisibility)}
        >
          <option value="everyone">Все пользователи</option>
          <option value="friends">Только друзья</option>
          <option value="only_me">Только я</option>
        </select>
      </label>
      {setting.isPending && <p role="status">Сохранение…</p>}
      {setting.isSuccess && <p role="status">Настройка сохранена</p>}
      {setting.isError && (
        <div className="row">
          <p className="error" role="alert">
            {setting.error.message}
          </p>
          <button type="button" className="btn" onClick={() => setting.mutate(setting.variables)}>
            Повторить сохранение
          </button>
        </div>
      )}
    </section>
  );
}
