import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

/** Shown to logged-in users whose email isn't verified yet. */
export default function VerifyBanner() {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (!user || user.emailVerified) return null;

  const resend = async () => {
    setState("sending");
    try {
      await api("/auth/resend-verification", { method: "POST" });
      setState("sent");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="banner" role="status">
      {state === "sent" ? (
        <span>Ссылка отправлена. Проверьте почту и папку «Спам».</span>
      ) : (
        <>
          <span>Подтвердите адрес почты, чтобы защитить аккаунт.</span>
          <button
            className="btn btn-ghost"
            disabled={state === "sending"}
            onClick={() => void resend()}
          >
            {state === "sending" ? "Отправка…" : state === "error" ? "Ошибка, повторить" : "Отправить ссылку повторно"}
          </button>
        </>
      )}
    </div>
  );
}
