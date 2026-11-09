import { useState } from "react";
import type { FormEvent } from "react";
import { REPORT_REASONS } from "@commune/shared";
import type { ReportReason } from "@commune/shared";
import { useReportPost } from "../hooks/useModeration";

export const REASON_LABELS: Record<ReportReason, string> = {
  spam: "Спам",
  harassment: "Оскорбления или травля",
  hate: "Разжигание ненависти",
  violence: "Насилие или угрозы",
  other: "Другое",
};

/** Small inline form shown under a post when someone clicks "Report". */
export default function ReportForm({ postId, onClose }: { postId: string; onClose: () => void }) {
  const report = useReportPost(postId);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");

  if (report.isSuccess) {
    return (
      <div className="report-form">
        <p className="muted">Спасибо. Модератор рассмотрит жалобу.</p>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Закрыть
        </button>
      </div>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    report.mutate({ reason, details });
  };

  return (
    <form className="report-form" onSubmit={submit}>
      <label>
        Почему вы жалуетесь на запись?
        <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {REASON_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Дополнительные сведения (необязательно)"
        maxLength={300}
        rows={2}
      />
      {report.isError && <p className="error">{report.error.message}</p>}
      <div className="row">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Отмена
        </button>
        <button className="btn" disabled={report.isPending}>
          {report.isPending ? "Отправка…" : "Отправить жалобу"}
        </button>
      </div>
    </form>
  );
}
