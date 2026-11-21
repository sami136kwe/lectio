"use client";

import { createContext, useContext } from "react";

import type { TraditionView } from "./views";

export { TRADITION_VIEWS, type TraditionView } from "./views";

type ReadingPrefs = { view: TraditionView; reviewedOnly: boolean; showGreek: boolean };

const ReadingContext = createContext<ReadingPrefs>({ view: "both", reviewedOnly: false, showGreek: false });

/** Reading preferences of the signed-in user (from the profile), for every card on the page. */
export function ReadingPrefsProvider({ view, reviewedOnly, showGreek, children }: ReadingPrefs & { children: React.ReactNode }) {
  return <ReadingContext.Provider value={{ view, reviewedOnly, showGreek }}>{children}</ReadingContext.Provider>;
}

export function useReadingPrefs(): ReadingPrefs {
  return useContext(ReadingContext);
}
