import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPasswordSchema } from "@commune/shared";
import { api } from "../lib/api";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    const parsed = resetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) {
      setError("Проверьте введённые данные");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/reset-password", { method: "POST", body: parsed.data });
      navigate("/login", { replace: true, state: { notice: "Пароль обновлён. Войдите с новым паролем." } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="card auth">
        <h1>Недействительная ссылка</h1>
        <p>Ссылка для сброса неполная. Запросите новую.</p>
        <Link className="btn block" to="/forgot-password">

          Запросить новую ссылку
        </Link>
      </div>
    );
  }

  return (
    <form className="card auth" onSubmit={(e) => void submit(e)}>
      <h1>Придумайте новый пароль</h1>
      <label>

        Новый пароль
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      <label>

        Повторите пароль
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      <p className="muted">Не менее 8 символов. Вы выйдете из аккаунта на всех устройствах.</p>
      {error && (
        <p className="error">
          {error} <Link to="/forgot-password">Запросить новую ссылку</Link>
        </p>
      )}
      <button className="btn block" disabled={busy}>
        {busy ? "Сохранение…" : "Обновить пароль"}
      </button>
    </form>
  );
}
