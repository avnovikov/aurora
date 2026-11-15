import { SKILL_TIER_LABELS, SKILL_TIERS } from "../domain/skillTier";
import type { SkillTier } from "../domain/types";

export { SKILL_TIERS, SKILL_TIER_LABELS };

export function effectiveLabel(tier: SkillTier): string {
  return SKILL_TIER_LABELS[tier];
}
