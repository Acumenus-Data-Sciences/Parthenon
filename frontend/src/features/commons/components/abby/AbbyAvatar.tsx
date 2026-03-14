import type { AbbyAvatarProps } from "../../types/abby";

const sizeClasses = {
  sm: "w-6 h-6 text-[9px]",
  md: "w-8 h-8 text-[11px]",
  lg: "w-9 h-9 text-[13px]",
} as const;

export default function AbbyAvatar({
  size = "md",
  showStatus = false,
  className = "",
}: AbbyAvatarProps) {
  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full font-medium text-white flex items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-700 select-none`}
      >
        Ab
      </div>
      {showStatus && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
          title="Abby is online"
        />
      )}
    </div>
  );
}
