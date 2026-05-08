import { describe, expect, it } from "vitest";
import { resources } from "../resources";

function flattenStrings(value: unknown, prefix = ""): Array<[string, string]> {
  if (typeof value === "string") return [[prefix, value]];
  if (typeof value !== "object" || value === null) return [];

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => flattenStrings(child, prefix ? `${prefix}.${key}` : key),
  );
}

const spanishSourceMarkers = [
  /[áéíóúñÁÉÍÓÚÑ¿¡]/u,
  /\b(?:Configuración|Puntuación|Análisis|Cohorte|Ejecución|Ejecutar|Selecciona|Seleccionar|Búsqueda|Atrás|Volver|Siguiente|Guardar|Cargando|No se pudo|Aún no|Ningún|Ninguna|Contraseña)\b/iu,
];

describe("English source translation quality", () => {
  it("does not contain Spanish copy in the en-US resource bundle", () => {
    const englishStrings = flattenStrings(resources["en-US"]);
    const spanishLikeEntries = englishStrings.filter(([, text]) =>
      spanishSourceMarkers.some((marker) => marker.test(text)),
    );

    expect(spanishLikeEntries).toEqual([]);
  });
});
