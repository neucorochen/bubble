import Icon from "./Icon";

/** Small gold mark next to the name of a Commune Plus member. */
export default function PlusBadge({ plus }: { plus: boolean }) {
  if (!plus) return null;
  return (
    <span className="plus-badge" title="Подписчик Bubble Plus" aria-label="Подписчик Bubble Plus">
      <Icon name="sparkle" size={11} filled />
    </span>
  );
}
