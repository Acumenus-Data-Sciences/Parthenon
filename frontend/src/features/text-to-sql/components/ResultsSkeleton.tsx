export function ResultsSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          background: "var(--surface-darkest)",
          border: "1px solid var(--surface-elevated)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "8px 14px",
            borderBottom: "1px solid var(--surface-elevated)",
            background: "var(--surface-base)",
            height: "36px",
          }}
        />
        <div
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {[80, 65, 90, 55, 72].map((w, i) => (
            <div
              key={i}
              style={{
                height: "14px",
                borderRadius: "4px",
                width: `${w}%`,
                background:
                  "linear-gradient(90deg, var(--surface-overlay) 25%, var(--surface-elevated) 50%, var(--surface-overlay) 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s infinite",
              }}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--surface-elevated)",
          borderRadius: "8px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {[100, 85, 60].map((w, i) => (
          <div
            key={i}
            style={{
              height: "12px",
              borderRadius: "4px",
              width: `${w}%`,
              background:
                "linear-gradient(90deg, var(--surface-overlay) 25%, var(--surface-elevated) 50%, var(--surface-overlay) 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
