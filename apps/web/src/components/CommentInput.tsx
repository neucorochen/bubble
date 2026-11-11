import Icon from "./Icon";

export default function CommentInput({ value, onChange, pending }: { value: string; onChange: (value: string) => void; pending: boolean }) {
  return (
    <div className="aero-comment-input">
      <input aria-label="Написать комментарий" placeholder="Написать комментарий" value={value} onChange={(e) => onChange(e.target.value)} maxLength={300} />
      <span className="aero-comment-photo-hint" title="Прикрепление фотографий появится позже"><button type="button" className="btn aero-comment-photo" disabled aria-label="Прикрепление фотографий появится позже"><Icon name="image" size={18} /></button></span>
      <button className="btn" disabled={pending || !value.trim()}>{pending ? "Отправка…" : "Отправить"}</button>
    </div>
  );
}
