import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { forgotPasswordSchema } from "@commune/shared";
import { api } from "../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError("Введите корректный адрес почты");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/forgot-password", { method: "POST", body: parsed.data });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="card auth">
        <h1>Проверьте почту</h1>
        <p>

          Если аккаунт зарегистрирован на адрес <strong>{email}</strong>, мы отправили ссылку для сброса пароля. Её можно использовать один раз в течение часа.
        </p>
        <p className="muted center">
          <Link to="/login">Вернуться ко входу</Link>
        </p>
      </div>
    );
  }

  return (
    <form className="card auth" onSubmit={(e) => void submit(e)}>
      <h1>Забыли пароль?</h1>
      <p className="muted">Укажите почту, и мы отправим ссылку для создания нового пароля.</p>
      <label>

        Электронная почта
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn block" disabled={busy}>
        {busy ? "Отправка…" : "Отправить ссылку"}
      </button>
      <p className="muted center">
        <Link to="/login">Вернуться ко входу</Link>
      </p>
    </form>
  );
}
