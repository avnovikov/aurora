import { applyLightDayDose } from "./lightDay";
import type { PlannedSession, PlannedWorkItem } from "./planSession";

const LIGHT_DAY_RULE_ID = "light_day";
const LIGHT_DAY_REASON_SUFFIX = "light day after warmup pulse";

/**
 * Same moves, light-day doses. Used when the athlete accepts the end-of-warmup
 * "keep it light" confirm after the session was already planned.
 */
export function lightenPlannedSession(planned: PlannedSession): PlannedSession {
  if (planned.lightDay) {
    return planned;
  }
  return {
    ...planned,
    lightDay: true,
    work: planned.work.map(lightenWorkItem),
  };
}

function lightenWorkItem(item: PlannedWorkItem): PlannedWorkItem {
  const alreadyLight = item.ruleIds.includes(LIGHT_DAY_RULE_ID);
  return {
    ...item,
    dose: applyLightDayDose(item.dose),
    ruleIds: alreadyLight ? item.ruleIds : [...item.ruleIds, LIGHT_DAY_RULE_ID],
    reason: alreadyLight ? item.reason : `${item.reason}; ${LIGHT_DAY_REASON_SUFFIX}`,
  };
}
