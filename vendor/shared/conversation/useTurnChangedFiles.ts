import { useMemo } from "react";
import { completedTurnFiles } from "../chat/turnPresentation";
import type { Turn } from "./types";

export function useTurnChangedFiles(turn?: Turn) {
  return useMemo(() => turn ? completedTurnFiles(turn) : [],
    [turn?.diff, turn?.items, turn?.reviewEdits, turn?.reviewDeferred, turn?.status]);
}
