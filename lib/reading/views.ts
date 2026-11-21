export type TraditionView = "both" | "catholic" | "orthodox" | "neutral";
export const TRADITION_VIEWS: TraditionView[] = ["both", "catholic", "orthodox", "neutral"];

export function isTraditionView(v: unknown): v is TraditionView {
  return v === "both" || v === "catholic" || v === "orthodox" || v === "neutral";
}
