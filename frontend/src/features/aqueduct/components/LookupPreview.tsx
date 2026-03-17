interface LookupPreviewProps {
  sql: string;
  vocabulary: string;
}

export default function LookupPreview({ sql, vocabulary }: LookupPreviewProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#161619] p-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium text-[#C9A227]">
          {vocabulary.toUpperCase()} Lookup SQL
        </h4>
        <button
          onClick={() => {
            const blob = new Blob([sql], { type: "text/sql" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${vocabulary}_lookup.sql`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="rounded bg-[#C9A227]/20 px-3 py-1 text-xs text-[#C9A227] hover:bg-[#C9A227]/30"
        >
          Download
        </button>
      </div>
      <pre className="max-h-96 overflow-auto rounded bg-black/40 p-3 text-xs text-gray-300">
        {sql}
      </pre>
    </div>
  );
}
