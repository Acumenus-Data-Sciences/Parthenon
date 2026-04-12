// ---------------------------------------------------------------------------
// ResultsTable — publication-style HTML table for manuscript preview
// ---------------------------------------------------------------------------

import type { TableData } from "../types/publish";

interface ResultsTableProps {
  data: TableData;
  tableNumber: number;
}

export default function ResultsTable({ data, tableNumber }: ResultsTableProps) {
  if (data.rows.length === 0) {
    return (
      <div className="my-4 text-sm italic text-gray-400">
        No structured data available for this table.
      </div>
    );
  }

  return (
    <div className="my-6">
      {/* Caption */}
      <p
        className="mb-2 text-sm font-semibold text-gray-700"
        style={{ fontSize: "10pt" }}
      >
        Table {tableNumber}. {data.caption}
      </p>

      {/* Table */}
      <table
        className="w-full border-collapse text-sm text-gray-800"
        style={{ fontSize: "10pt", lineHeight: 1.5 }}
      >
        <thead>
          <tr
            className="border-t-2 border-b border-gray-900"
            style={{ borderBottomWidth: "1px", borderBottomColor: 'var(--border-default)' }}
          >
            {data.headers.map((header) => (
              <th
                key={header}
                className="px-2 py-1.5 text-left font-semibold"
                style={{
                  textAlign: header === data.headers[0] ? "left" : "right",
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={rowIdx === data.rows.length - 1 ? "border-b-2 border-gray-900" : "border-b border-gray-200"}
            >
              {data.headers.map((header, colIdx) => (
                <td
                  key={header}
                  className="px-2 py-1"
                  style={{ textAlign: colIdx === 0 ? "left" : "right" }}
                >
                  {row[header] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footnotes */}
      {data.footnotes && data.footnotes.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {data.footnotes.map((note, i) => (
            <p key={i} className="text-xs text-gray-500" style={{ fontSize: "8pt" }}>
              {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
