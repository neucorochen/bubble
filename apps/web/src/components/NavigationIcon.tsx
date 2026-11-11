import Icon, { type IconName } from "./Icon";
import { navigationImages } from "../lib/navigation";
export default function NavigationIcon({ name, size }: { name: IconName; size: number }) {
  const src = navigationImages[name];
  return src ? <img src={src} alt="" width={size} height={size} style={{ objectFit: "contain", flexShrink: 0 }} /> : <Icon name={name} size={size} />;
}
