import { displayNameOf } from "@commune/shared";
import { useState } from "react";
import type { FormEvent } from "react";
import { contactSchema } from "@commune/shared";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

export default function ContactPage() {
  const { user } = useAuth();
  const [fields, setFields] = useState({
    name: user ? displayNameOf(user) : "",
    email: "",
    message: "",
    website: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  const set = (k: keyof typeof fields) => (e: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = contactSchema.safeParse(fields);
    if (!parsed.success) return setError("Проверьте введённые данные");
    setState("sending");
    try {
      await api("/contact", { method: "POST", body: parsed.data });
      setState("sent");
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Не удалось отправить сообщение");
    }
  };

  if (state === "sent") {
    return (
      <section className="card plus-hero">
        <h1>Спасибо!</h1>
        <p className="muted">Сообщение отправлено. Мы ответим на вашу почту как можно скорее.</p>
      </section>
    );
  }

  return (
    <form className="card auth" onSubmit={(e) => void submit(e)} noValidate>
      <h1>Связаться с нами</h1>
      <p className="muted">Есть вопросы, предложения или вы нашли ошибку? Напишите нам.</p>
      <label>

        Имя
        <input value={fields.name} onChange={set("name")} maxLength={60} autoComplete="name" />
      </label>
      <label>

        Электронная почта
        <input
          type="email"
          value={fields.email}
          onChange={set("email")}
          maxLength={120}
          autoComplete="email"
        />
      </label>
      <label>

        Сообщение
        <textarea value={fields.message} onChange={set("message")} rows={6} maxLength={2000} />
      </label>
      {/* Honeypot: hidden from people, tempting for bots. */}
      <input
        className="hp"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={fields.website}
        onChange={set("website")}
        name="website"
      />
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={state === "sending"}>
        {state === "sending" ? "Отправка…" : "Отправить сообщение"}
      </button>
    </form>
  );
}
