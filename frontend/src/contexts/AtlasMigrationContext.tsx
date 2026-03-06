import { createContext, useContext } from "react";

interface AtlasMigrationContextValue {
  openAtlasMigration: () => void;
}

export const AtlasMigrationContext = createContext<AtlasMigrationContextValue>({
  openAtlasMigration: () => {},
});

export function useAtlasMigration() {
  return useContext(AtlasMigrationContext);
}
