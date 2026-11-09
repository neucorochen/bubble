/** The Commune mark: three overlapping rounded squares, people gathering. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <img src="/bubble-logo.png" alt="" width={size} height={size} style={{ objectFit: "contain" }} />
  );
}

export default function Brand({ size = 30 }: { size?: number }) {
  return (
    <span className="brand-lockup">
      <BrandMark size={size} />
      <span className="brand-word">Bubble</span>
    </span>
  );
}
