import { formatPrice, useEarnings } from "../hooks/usePayments";

/** Shown to a creator on their own profile: what paid posts have earned. */
export default function EarningsCard() {
  const earnings = useEarnings(true);
  if (!earnings.data) return null;
  const e = earnings.data;
  return (
    <div className="earnings" aria-label="Доход от платных записей">
      <div>
        <span className="muted">Ваш доход</span>
        <strong>{formatPrice(e.netCents, e.currency)}</strong>
      </div>
      <div>
        <span className="muted">Продажи</span>
        <strong>{e.sales}</strong>
      </div>
      <div>
        <span className="muted">Комиссия платформы</span>
        <strong>{formatPrice(e.feeCents, e.currency)}</strong>
      </div>
    </div>
  );
}
