import type { LoadRegion } from "./seed";

/**
 * Display data for the prebuilt warmup view (not a planner catalogue).
 * Templates list station ids in order; each runs once with its own hold.
 */
export interface WarmupStation {
  id: string;
  name: string;
  regions: LoadRegion[];
  /** Station hold length (seconds). */
  holdSeconds: number;
  doodlePath?: string;
  cues: string[];
}

export const WARMUP_STATIONS: WarmupStation[] = [
  {
    id: "pulse_raiser_march",
    name: "March in place",
    regions: ["general", "legs"],
    holdSeconds: 90,
    doodlePath: "/doodles/doodle-march-in-place.jpg",
    cues: ["Light bounce", "Arms swing freely", "Breathe through the nose"],
  },
  {
    id: "hip_circles",
    name: "Hip circles",
    regions: ["legs", "general"],
    holdSeconds: 75,
    doodlePath: "/doodles/doodle-hip-circles.jpg",
    cues: ["Slow circles", "Both directions", "Keep ribs quiet"],
  },
  {
    id: "ankle_rocks",
    name: "Ankle rocks",
    regions: ["legs"],
    holdSeconds: 75,
    doodlePath: "/doodles/doodle-calf-raise.jpg",
    cues: ["Knee tracks over mid-foot", "Heel stays down as long as possible"],
  },
  {
    id: "wrist_load",
    name: "Wrist load",
    regions: ["skill", "push"],
    holdSeconds: 60,
    doodlePath: "/doodles/doodle-wrist-load.jpg",
    cues: ["Fingers spread", "Shift weight gently", "Stop before sharp pain"],
  },
  {
    id: "scap_pushup",
    name: "Scapular push-up",
    regions: ["skill", "push"],
    holdSeconds: 75,
    doodlePath: "/doodles/doodle-scap-pushup.jpg",
    cues: ["Arms locked", "Only the shoulder blades move", "Long neck"],
  },
  {
    id: "glute_bridge",
    name: "Glute bridge",
    regions: ["legs", "core"],
    holdSeconds: 75,
    doodlePath: "/doodles/doodle-glute-bridge.jpg",
    cues: ["Ribs down", "Squeeze glutes at the top", "Do not arch the low back"],
  },
];

export const WARMUP_STATION_BY_ID: Record<string, WarmupStation> = Object.fromEntries(
  WARMUP_STATIONS.map((station) => [station.id, station]),
);

export function requireWarmupStation(id: string): WarmupStation {
  const station = WARMUP_STATION_BY_ID[id];
  if (!station) {
    throw new Error(`Unknown warmup station: ${id}`);
  }
  return station;
}
