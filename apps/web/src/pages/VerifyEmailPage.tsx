import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { PublicUser } from "@commune/shared";
import { verifyEmailSchema } from "@commune/shared";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

type Status = "working" | "done" | "failed";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const { user, setUser } = useAuth();
  const [status, setStatus] = useState<Status>("working");
  const [message, setMessage] = useState("");
  // The token is single use. React StrictMode runs effects twice in development, so guard it.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const parsed = verifyEmailSchema.safeParse({ token: params.get("token") ?? "" });
    if (!parsed.success) {
      setStatus("failed");
      setMessage("Ссылка подтверждения недействительна.");
      return;
    }
    api("/auth/verify-email", { method: "POST", body: parsed.data })
      .then(async () => {
        setStatus("done");
        // Refresh the cached account so the "confirm your email" banner disappears.
        if (user) setUser(await api<PublicUser>("/users/me"));
      })
      .catch((err: unknown) => {
        setStatus("failed");
        setMessage(err instanceof Error ? err.message : "Что-то пошло не так");
      });
  }, [params, user, setUser]);

  return (
    <div className="card auth">
      {status === "working" && <p className="muted center">Подтверждаем почту…</p>}
      {status === "done" && (
        <>
          <h1>Почта подтверждена</h1>
          <p>Спасибо, ваш адрес подтверждён.</p>
          <Link className="btn block" to="/">

            Перейти в Bubble
          </Link>
        </>
      )}
      {status === "failed" && (
        <>
          <h1>Не удалось подтвердить почту</h1>
          <p className="error">{message}</p>
          <p className="muted">

            Войдите и нажмите кнопку повторной отправки в уведомлении, чтобы получить новую ссылку.
          </p>
          <Link className="btn block" to="/login">

            Войти
          </Link>
        </>
      )}
    </div>
  );
}
