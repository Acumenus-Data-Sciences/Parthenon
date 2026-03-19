import { useMutation } from "@tanstack/react-query";
import { createJupyterSession } from "../api";

export function useJupyterSession() {
  return useMutation({
    mutationFn: createJupyterSession,
  });
}
