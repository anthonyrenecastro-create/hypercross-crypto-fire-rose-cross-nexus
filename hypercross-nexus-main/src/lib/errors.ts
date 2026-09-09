export function toErrorMessage(
  value: unknown,
  fallback = "Something went wrong."
): string {
  if (typeof value === "string" && value.trim()) return value.trim();

  if (value instanceof Error && value.message) return value.message;

  if (value && typeof value === "object") {
    const candidate = (value as Record<string, unknown>).message;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }

    const nested = (value as Record<string, unknown>).error;
    if (nested && typeof nested === "object") {
      const nestedMessage = toErrorMessage(nested, "");
      if (nestedMessage) return nestedMessage;
    }
  }

  return typeof fallback === "string" && fallback.trim() ? fallback.trim() : "Something went wrong.";
}
