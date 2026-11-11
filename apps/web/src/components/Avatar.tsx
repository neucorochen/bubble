import { assetUrl } from "../lib/api";
import { hueFor } from "../lib/hue";
import { Link } from "react-router-dom";

/** Opt-in link: keep the base Avatar decorative inside existing links. */
export function ProfileAvatar(props: Parameters<typeof Avatar>[0]) {
  return <Link className="profile-avatar-link" to={`/u/${props.username}`} aria-label={`Открыть профиль @${props.username}`}><Avatar {...props} /></Link>;
}

/** Profile photo, or a colored circle with the user's initial when there is none. */
export default function Avatar({
  username,
  url,
  size = 40,
}: {
  username: string;
  url?: string | null;
  size?: number;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (url) {
    return <img className="avatar" src={assetUrl(url)} alt="" style={style} loading="lazy" />;
  }
  const hue = hueFor(username);
  return (
    <span
      className="avatar avatar-fallback"
      style={{ ...style, background: hue.bg, color: hue.fg }}
      aria-hidden="true"
    >
      {username.charAt(0).toUpperCase()}
    </span>
  );
}
