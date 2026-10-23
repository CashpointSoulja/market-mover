// The market grades every call: compare the first outcome's price at the call with its price 10 minutes later.
import { midpoint } from "./prices.mjs";

const CHECK_AFTER_MS = 10 * 60_000;
const DECISIVE = 0.03; // 3+ points is a real move
const FLAT = 0.005; // under half a point is no move; anything in between is left ungraded

export function scheduleGrade(call, onGraded) {
  setTimeout(async () => {
    const after = await midpoint(call.market.yesToken).catch(() => null);
    if (after == null || call.priceAtCall == null) return;
    const move = after - call.priceAtCall;
    const actual = move >= DECISIVE ? "up" : move <= -DECISIVE ? "down" : Math.abs(move) <= FLAT ? "none" : null;
    onGraded({ ...call, priceAfter: after, move: Number(move.toFixed(4)), actual, correct: actual == null ? null : actual === call.effect });
  }, CHECK_AFTER_MS);
}
