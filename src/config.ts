// Central configuration for EgoBH simulation
// All tweakable parameters are exposed here to make the system modelable.

export type SimMode = "Auto" | "Tour";

export interface AppConfig {
  world: {
    width: number;
    height: number;
    wrap?: boolean; // periodic boundaries like a torus (no walls). If true, positions wrap instead of clamping
  };
  sim: {
    dayDurationSec: number; // duration of a day phase
    autoWaitSec: number;    // waiting time between days when mode=Auto
    maxDt: number;          // clamp for frame dt (GameLoop)
    spatialHashCellAgents: number;
    spatialHashCellCows: number;
    initialMode: SimMode;
    initialPreset: "uniform10each" | "all70" | "all30";
    /** If set to a non-null number, overrides presets and creates exactly this many agents. */
    totalAgentsOverride?: number | null;
    /** Ego percent used when totalAgentsOverride is active (0..100). */
    singleEgoPercent?: number;
  };
  rules: {
    cowValue: number;       // base points in a cow to distribute
    targetCows: number;     // desired cows simultaneously alive
    survivePoints: number;  // threshold to survive the day
    reproEvery: number;     // extra points per new child
    houseCapacity: number;  // agents per house
  };
  cows: {
    houseBuffer: number;    // min distance between cow spawn and any house (px)
  };
  camera: {
    minScale: number;
    maxScale: number;
  };
  render: {
    maxDevicePixelRatio: number; // upper clamp for devicePixelRatio in 2D canvas
  };
  analysis?: {
    coverageCellSize?: number; // grid cell size in px for scan coverage measurement
  };
  presets: {
    uniformEach: number; // number of agents per ego percentile (when uniform10each)
    allCount: number;    // number of agents when all70/all30
  };
  ai: {
    greedy: {
      wallMargin: number;   // distance from walls to push back agents
      centerBias: number;   // small probability to bias towards world center when idle
    };
  };
  entities: {
    agentDefaults: {
      speed: number;
      senseRadius: number;
      pickupRadius: number;
    };
  };
  ui: {
    historyCap: number; // max number of days kept in history arrays
  };
  debug?: {
    showSenseOverlayDefault?: boolean; // draw agents' sense radius for analysis
  };
}

export const CONFIG: AppConfig = {
  world: { width: 2000, height: 1500, wrap: true },
  sim: {
    dayDurationSec: 30,
    autoWaitSec: 1.0,
    maxDt: 0.05,
    spatialHashCellAgents: 96,
    spatialHashCellCows: 96,
    initialMode: "Auto",
    initialPreset: "uniform10each",
    totalAgentsOverride: 1,
    singleEgoPercent: 50,
  },
  rules: {
    cowValue: 50,
    targetCows: 1,
    survivePoints: 55,
    reproEvery: 50,
    houseCapacity: 10000,
  },
  cows: {
    houseBuffer: 64,
  },
  camera: {
    minScale: 0.25,
    maxScale: 4,
  },
  render: {
    maxDevicePixelRatio: 2,
  },
  analysis: {
    coverageCellSize: 16,
  },
  presets: {
    uniformEach: 10,
    allCount: 1,
  },
  ai: {
    greedy: {
      wallMargin: 30,
      centerBias: 0.001,
    },
  },
  entities: {
    agentDefaults: {
      speed: 180,
      senseRadius: 220,
      pickupRadius: 18,
    },
  },
  ui: {
    historyCap: 200,
  },
  debug: {
    showSenseOverlayDefault: false,
  },
};

export default CONFIG;
