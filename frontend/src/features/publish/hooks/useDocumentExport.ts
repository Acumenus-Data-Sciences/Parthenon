import { useMutation } from "@tanstack/react-query";
import { exportDocument, type ExportRequest } from "../api/publishApi";

export function useExportDocument() {
  return useMutation({
    mutationFn: (req: ExportRequest) => exportDocument(req),
    onSuccess: (blob, variables) => {
      const ext = variables.format === "figures-zip" ? "zip" : variables.format;
      const filename = `${variables.title.replace(/\s+/g, "_")}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}
