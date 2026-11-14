import type { CSSProperties } from "react";
import { displayNameOf, avatarFrameSchema, type AvatarFrame } from "@commune/shared";
import { useAuth } from "../store/auth";
import { assetUrl } from "../lib/api";
import { hueFor } from "../lib/hue";
import { Link } from "react-router-dom";

/** Opt-in link: keep the base Avatar decorative inside existing links. */
export function ProfileAvatar(props: Parameters<typeof Avatar>[0]) {
  return <Link className="profile-avatar-link" to={`/u/${props.username}`} aria-label={`Открыть профиль ${displayNameOf(props)}`}><Avatar {...props} /></Link>;
}

/** Profile photo, or a colored circle with the user's initial when there is none. */
export default function Avatar({
  username,
  displayName,
  url,
  size = 40,
  frame,
  preview = false,
}: {
  username: string;
  displayName?: string;
  url?: string | null;
  size?: number;
  frame?: AvatarFrame | null;
  preview?: boolean;
}) {
  const { user } = useAuth();
  const effect = avatarFrameSchema.safeParse(
    user?.username === username && !preview ? user.avatarFrame : frame,
  ).data;
  const style = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.42),
    ...(effect && {
      "--avatar-glow": effect.color,
      "--avatar-glow-radius": `${effect.intensity * 1.2 + 1}px`,
    }),
  } as CSSProperties;
  const effectName = effect?.effect;
  if (url) {
    return <img className="avatar" data-frame={effectName} src={assetUrl(url)} alt="" style={style} loading="lazy" />;
  }
  const hue = hueFor(username);
  return (
    <span
      className="avatar avatar-fallback"
      data-frame={effectName}
      style={{ ...style, background: hue.bg, color: hue.fg }}
      aria-hidden="true"
    >
      {Array.from(displayNameOf({ username, displayName }))[0]?.toUpperCase()}
    </span>
  );
}
