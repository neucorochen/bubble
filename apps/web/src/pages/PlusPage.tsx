import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FREE_POST_LENGTH, PLUS_POST_LENGTH, type BillingDTO } from "@commune/shared";
import Icon, { type IconName } from "../components/Icon";
import { CardsSkeleton } from "../components/Skeleton";
import { ACTIVATION_WAIT_MS, useBilling, useBillingPortal, useUpgrade } from "../hooks/useBilling";
import "../styles/plus.css";

const FEATURES: ReadonlyArray<readonly [IconName, string, string]> = [
  [
    "chart",
    "Статистика автора",
    "Просмотры, отметки «Нравится», комментарии и рост подписчиков, а также лучшие записи.",
  ],
  ["coin", "Получайте больше с каждой продажи", "Комиссия за платные записи снижается с 20% до 10%."],
  [
    "pencil",
    "Более длинные записи",
    `До ${PLUS_POST_LENGTH} символов вместо ${FREE_POST_LENGTH}.`,
  ],
  ["users", "Больше сообществ", "Создавайте до 20 сообществ вместо 5."],
  ["sparkle", "Значок Plus", "Значок рядом с именем в записях, комментариях и профиле."],
];

const COMPARE: ReadonlyArray<readonly [string, string, string]> = [
  ["Длина записи", `${FREE_POST_LENGTH} символов`, `${PLUS_POST_LENGTH} символов`],
  ["Количество сообществ", "5", "20"],
  ["Комиссия за платные записи", "20%", "10%"],
  ["Статистика автора", "—", "Включено"],
  ["Значок Plus", "—", "Включено"],
];

const FAQ: ReadonlyArray<readonly [string, string]> = [
  [
    "Как оплатить?",
    "Оплата происходит на защищённой странице нашего партнёра Lemon Squeezy. Мы не видим и не храним данные вашей карты.",
  ],
  [
    "Когда активируется Plus?",
    "Через несколько секунд после оплаты. Страница подтвердит получение платежа.",
  ],
  [
    "Можно отменить подписку?",
    "Да, в любой момент в разделе управления оплатой. Plus сохранится до конца оплаченного периода.",
  ],
  [
    "Как учитываются налоги?",
    "При необходимости налоги добавляются при оплате и обрабатываются Lemon Squeezy.",
  ],
  [
    "Мою карту отклонили или продление не удалось.",
    "Откройте управление оплатой и обновите карту. Plus останется активным несколько дней, пока платёж повторяется.",
  ],
];

const fmt = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { dateStyle: "long" });

/** One short line about where the plan stands. */
function planStatus(b: BillingDTO): { label: string; tone: "ok" | "warn" | "bad"; detail: string } {
  if (b.pastDue) {
    return {
      label: "Проблема с оплатой",
      tone: "bad",
      detail: "Последний платёж не прошёл. Обновите карту, чтобы сохранить Plus.",
    };
  }
  if (b.cancelled && b.plusUntil) {
    return { label: "Отменена", tone: "warn", detail: `Plus действует до ${fmt(b.plusUntil)}.` };
  }
  const next = b.renewsAt ?? b.plusUntil;
  return {
    label: "Активна",
    tone: "ok",
    detail: next ? `Продление ${fmt(next)}.` : "Ваша подписка активна.",
  };
}

export default function PlusPage() {
  const [params] = useSearchParams();
  const welcome = params.get("welcome") === "1";
  const billing = useBilling(welcome);
  const upgrade = useUpgrade();
  const portal = useBillingPortal();
  const b = billing.data;

  // After paying, give the confirmation a minute before suggesting the person refresh.
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  useEffect(() => {
    if (!welcome) return;
    const t = window.setTimeout(() => setWaitedTooLong(true), ACTIVATION_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [welcome]);

  if (billing.isLoading) return <CardsSkeleton count={2} />;
  if (billing.isError || !b) {
    return (
      <p className="error center">

        Не удалось загрузить сведения о подписке.{" "}
        <button className="link-btn" onClick={() => void billing.refetch()}>

          Попробовать снова
        </button>
      </p>
    );
  }

  const activating = welcome && !b.plus;
  const hasPlan = b.plus;
  const status = hasPlan ? planStatus(b) : null;

  return (
    <div className="plus-wrap">
      {b.testMode && (
        <div className="plus-banner warn" role="note">
          <Icon name="card" size={18} />
          <span>
            <strong>Тестовый режим.</strong>  Платежи имитируются, деньги не списываются. Используйте тестовую карту 4242 4242 4242 4242 с любой будущей датой и любым CVC.
          </span>
        </div>
      )}

      {b.pastDue && (
        <div className="plus-banner danger" role="alert">
          <Icon name="flag" size={18} />
          <span>
            <strong>Не удалось принять последний платёж.</strong>  Обновите данные карты, чтобы сохранить возможности Plus.
            <span className="row">
              <button className="btn" disabled={portal.isPending} onClick={() => portal.mutate()}>
                {portal.isPending ? "Открываем…" : "Обновить способ оплаты"}
              </button>
            </span>
          </span>
        </div>
      )}

      <section className="card plus-top" aria-live="polite">
        <span className="plus-eyebrow">
          <Icon name="sparkle" size={14} />  Bubble Plus
        </span>

        {activating ? (
          <>
            <h1>Почти готово</h1>
            <ul className="plus-steps">
              <li className="done">
                <span className="dot">
                  <Icon name="check" size={14} />
                </span>{" "}

                Оплата получена
              </li>
              <li className={waitedTooLong ? "" : "busy"}>
                <span className="dot" />  Активируем Plus для вашего аккаунта
              </li>
              <li>
                <span className="dot" />  Готово к использованию
              </li>
            </ul>
            {waitedTooLong && (
              <p className="muted">

                Активация занимает больше времени, чем обычно. Платёж получен, и Plus включится автоматически. Обновите страницу или <Link to="/contact">свяжитесь с нами</Link>  если подписка не активируется через несколько минут.
              </p>
            )}
          </>
        ) : hasPlan && status ? (
          <>
            <h1>У вас подключён Plus{welcome ? " 🎉" : ""}</h1>
            <div className="plus-status">
              <span className={`plus-chip ${status.tone}`}>{status.label}</span>
              <span className="plus-dates">{status.detail}</span>
            </div>
            <div className="row">
              <Link className="btn" to="/insights">

                Открыть статистику
              </Link>
              {b.status && (
                <button
                  className="btn btn-outline"
                  disabled={portal.isPending}
                  onClick={() => portal.mutate()}
                >
                  {portal.isPending ? "Открываем…" : "Управление оплатой"}
                </button>
              )}
              {b.cancelled && (
                <button
                  className="btn btn-ghost"
                  disabled={upgrade.isPending}
                  onClick={() => upgrade.mutate()}
                >
                  {upgrade.isPending ? "Открываем страницу оплаты…" : "Возобновить подписку"}
                </button>
              )}
            </div>
            <p className="muted small">

              В разделе управления оплатой можно обновить карту, скачать счета или отменить подписку.
            </p>
            {portal.isError && <p className="error">{portal.error.message}</p>}
            {upgrade.isError && <p className="error">{upgrade.error.message}</p>}
          </>
        ) : (
          <>
            <h1>Создавайте больше. Получайте больше.</h1>
            <p className="muted">Инструменты для авторов Bubble. Отменить подписку можно в любое время.</p>
            <p className="plus-price-big">{b.priceLabel}</p>
            <button
              className="btn plus-cta"
              disabled={upgrade.isPending || b.available === false}
              onClick={() => upgrade.mutate()}
            >
              <Icon name="lock" size={18} />{" "}
              {upgrade.isPending ? "Открываем защищённую страницу оплаты…" : "Подключить Plus"}
            </button>
            <div className="plus-assure">
              <span>
                <Icon name="lock" size={15} />  Безопасная оплата
              </span>
              <span>
                <Icon name="check" size={15} />  Отмена в любой момент
              </span>
              <span>
                <Icon name="sparkle" size={15} />  Активация за несколько секунд
              </span>
            </div>
            {b.available === false && <p className="muted">Bubble Plus пока недоступен.</p>}
            {upgrade.isError && <p className="error">{upgrade.error.message}</p>}
            {b.status && b.status !== "active" && (
              <p className="muted">Срок предыдущей подписки истёк.</p>
            )}
          </>
        )}
      </section>

      <section className="plus-features" aria-label="Возможности Plus">
        {FEATURES.map(([icon, title, text]) => (
          <div key={title} className="card">
            <span className="plus-icon" aria-hidden>
              <Icon name={icon} size={22} />
            </span>
            <strong>{title}</strong>
            <p className="muted">{text}</p>
          </div>
        ))}
      </section>

      <section className="card plus-compare" aria-label="Сравнение бесплатного тарифа и Plus">
        <table>
          <thead>
            <tr>
              <th scope="col">Возможность</th>
              <th scope="col">Бесплатно</th>
              <th scope="col">Plus</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map(([name, free, plus]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{free}</td>
                <td>{plus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card plus-faq" aria-label="Вопросы">
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>

      <p className="muted center small">

        Платежи безопасно обрабатывает Lemon Squeezy. При необходимости налоги добавляются при оплате.
      </p>
    </div>
  );
}
