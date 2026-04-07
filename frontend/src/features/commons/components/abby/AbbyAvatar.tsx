import type { AbbyAvatarProps } from "../../types/abby";

const sizeClasses = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-9 h-9",
} as const;

export default function AbbyAvatar({
  size = "md",
  showStatus = false,
  className = "",
}: AbbyAvatarProps) {
  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <img
        src="/Abby-AI.png"
        alt="Abby"
        className={`${sizeClasses[size]} rounded-full object-cover ring-1 ring-emerald-500/30`}
      />
      {showStatus && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
          title="Abby is online"
        />
      )}
    </div>
  );
}
