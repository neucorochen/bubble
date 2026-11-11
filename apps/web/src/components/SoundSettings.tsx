import { playSound, setSoundPrefs, unlockAudio, useSoundPrefs } from "../lib/sound";

/** Turn the notification chimes on or off, set the volume, and listen to them. This device only. */
export default function SoundSettings() {
  const prefs = useSoundPrefs();

  const preview = (kind: "message" | "notification") => {
    unlockAudio(); // this click is the user gesture browsers require
    // The engine may need a moment to start on the very first click.
    window.setTimeout(() => playSound(kind, { force: true }), 60);
  };

  return (
    <section className="card sound-settings" aria-label="Звуки уведомлений">
      <h2 className="push-title">Звуки</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={prefs.enabled}
          onChange={(e) => {
            if (e.target.checked) unlockAudio();
            setSoundPrefs({ enabled: e.target.checked });
          }}
        />
        <span>Воспроизводить звук для новых сообщений и уведомлений</span>
      </label>
      <label className="sound-volume">
        <span>Громкость</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(prefs.volume * 100)}
          disabled={!prefs.enabled}
          aria-label="Громкость звука"
          onChange={(e) => setSoundPrefs({ volume: Number(e.target.value) / 100 })}
        />
        <span className="muted small">{Math.round(prefs.volume * 100)}%</span>
      </label>
      <div className="row">
        <button className="btn btn-outline" onClick={() => preview("message")}>

          Прослушать звук сообщения
        </button>
        <button className="btn btn-outline" onClick={() => preview("notification")}>

          Прослушать звук уведомления
        </button>
      </div>
      <p className="muted small">

        Настройки сохранены на этом устройстве. При открытой переписке звук не воспроизводится.
      </p>
    </section>
  );
}
