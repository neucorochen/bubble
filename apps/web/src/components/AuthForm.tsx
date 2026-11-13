import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { loginSchema, registerSchema } from "@commune/shared";
import { useAuth } from "../store/auth";
import GoogleButton, { GOOGLE_CLIENT_ID } from "./GoogleButton";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { user, login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const [fields, setFields] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (key: keyof typeof fields) => (e: ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed =
      mode === "login" ? loginSchema.safeParse(fields) : registerSchema.safeParse(fields);
    if (!parsed.success) {
      setError("Проверьте введённые данные");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await login(loginSchema.parse(fields));
      else await register(registerSchema.parse(fields));
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  };

  const google = async (credential: string) => {
    setError(null);
    setBusy(true);
    try {
      await loginWithGoogle(credential);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти через Google");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card auth" onSubmit={(e) => void submit(e)}>
      <h1>{mode === "login" ? "С возвращением" : "Присоединяйтесь к Bubble"}</h1>
      {GOOGLE_CLIENT_ID && (
        <>
          <GoogleButton
            onCredential={(c) => void google(c)}
            text={mode === "login" ? "signin_with" : "signup_with"}
          />
          <p className="divider">
            <span>или используйте электронную почту</span>
          </p>
        </>
      )}
      {mode === "register" && (
        <label>

          ID профиля
          <input value={fields.username} onChange={set("username")} autoComplete="username" />
        </label>
      )}
      <label>

        Электронная почта
        <input type="email" value={fields.email} onChange={set("email")} autoComplete="email" />
      </label>
      <label>

        Пароль
        <input
          type="password"
          value={fields.password}
          onChange={set("password")}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </label>
      {notice && mode === "login" && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
      {mode === "login" && (
        <p className="muted right">
          <Link to="/forgot-password">Забыли пароль?</Link>
        </p>
      )}
      <button className="btn block" disabled={busy}>
        {busy ? "Подождите…" : mode === "login" ? "Войти" : "Создать аккаунт"}
      </button>
      <p className="muted center">
        {mode === "login" ? (
          <>

            Впервые здесь? <Link to="/register">Создать аккаунт</Link>
          </>
        ) : (
          <>

            Уже есть аккаунт? <Link to="/login">Войти</Link>
          </>
        )}
      </p>
    </form>
  );
}
