import {
  useDeviceSubscription,
  useDisablePush,
  useEnablePush,
  usePushStatus,
  useSavePushPreferences,
  useSendTestPush,
} from "../hooks/usePush";
import { needsInstallForPush, pushPermission, pushSupported } from "../lib/push";

/** Turn phone and desktop notifications on or off, and choose which kinds to receive. */
export default function PushSettings() {
  const status = usePushStatus();
  const device = useDeviceSubscription();
  const enable = useEnablePush(status.data?.publicKey ?? null);
  const disable = useDisablePush();
  const save = useSavePushPreferences();
  const test = useSendTestPush();

  // The server has no push keys: do not show a feature that cannot work.
  if (!status.data?.enabled) return null;

  const prefs = status.data.preferences;
  const subscribed = device.data === true;

  let body;
  if (!pushSupported()) {
    body = needsInstallForPush() ? (
      <p className="muted">

        На iPhone сначала добавьте Bubble на экран «Домой» через меню «Поделиться», затем откройте приложение и включите уведомления.
      </p>
    ) : (
      <p className="muted">Этот браузер не поддерживает push-уведомления.</p>
    );
  } else if (needsInstallForPush()) {
    body = (
      <p className="muted">

        На iPhone добавьте Bubble на экран «Домой» через меню «Поделиться» и откройте приложение, чтобы включить уведомления.
      </p>
    );
  } else if (pushPermission() === "denied" && !subscribed) {
    body = (
      <p className="muted">

        Уведомления для этого сайта заблокированы. Разрешите их в настройках браузера и вернитесь сюда.
      </p>
    );
  } else if (!subscribed) {
    body = (
      <>
        <p className="muted">

          Получайте уведомления о сообщениях, отметках «Нравится», комментариях и подписчиках, даже когда Bubble закрыт.
        </p>
        <button className="btn" disabled={enable.isPending} onClick={() => enable.mutate()}>
          {enable.isPending ? "Включение…" : "Включить уведомления"}
        </button>
        {enable.isError && <p className="error small">{enable.error.message}</p>}
      </>
    );
  } else {
    body = (
      <>
        <label className="check">
          <input
            type="checkbox"
            checked={prefs.messages}
            onChange={(e) => save.mutate({ ...prefs, messages: e.target.checked })}
          />
          <span>Новые сообщения</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={prefs.social}
            onChange={(e) => save.mutate({ ...prefs, social: e.target.checked })}
          />
          <span>Отметки «Нравится», комментарии и новые подписчики</span>
        </label>
        <div className="row">
          <button
            className="btn btn-outline"
            disabled={test.isPending}
            onClick={() => test.mutate()}
          >

            Отправить проверочное уведомление
          </button>
          <button
            className="btn btn-ghost"
            disabled={disable.isPending}
            onClick={() => disable.mutate()}
          >

            Отключить на этом устройстве
          </button>
        </div>
        {test.isError && <p className="error small">{test.error.message}</p>}
        {test.isSuccess && <p className="muted small">Отправлено. Уведомление скоро появится.</p>}
      </>
    );
  }

  return (
    <section className="card push-settings" aria-label="Push-уведомления">
      <h2 className="push-title">Push-уведомления</h2>
      {body}
    </section>
  );
}
