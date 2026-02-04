/**
 * The Skeld Map — Room & connection definitions
 */

/** Room IDs on The Skeld */
export enum Room {
  CAFETERIA = "cafeteria",
  WEAPONS = "weapons",
  NAVIGATION = "navigation",
  O2 = "o2",
  SHIELDS = "shields",
  COMMUNICATIONS = "communications",
  STORAGE = "storage",
  ADMIN = "admin",
  ELECTRICAL = "electrical",
  LOWER_ENGINE = "lower_engine",
  SECURITY = "security",
  REACTOR = "reactor",
  UPPER_ENGINE = "upper_engine",
  MEDBAY = "medbay",
}

/** Room metadata */
export interface RoomInfo {
  id: Room;
  name: string;
  /** Adjacent rooms (can walk to) */
  adjacent: Room[];
  /** Connected vent destinations (impostor only) */
  vents?: Room[];
  /** Tasks available in this room */
  tasks?: string[];
  /** Position on map for visualization (0-100 scale) */
  x: number;
  y: number;
}

/** Player location on the map */
export interface PlayerLocation {
  playerId: string;
  room: Room;
  /** Timestamp of last move */
  movedAt: number;
  /** Is currently moving (in transit) */
  isMoving: boolean;
}

/** Task assigned to a player */
export interface TaskAssignment {
  id: string;
  name: string;
  room: Room;
  /** Secondary room for multi-step tasks */
  room2?: Room;
  completed: boolean;
  /** Visual confirmation task (proves crew) */
  isVisual: boolean;
}

/** Map state within a game */
export interface MapState {
  /** Player locations indexed by playerId */
  locations: Record<string, PlayerLocation>;
  /** Tasks assigned per player */
  tasks: Record<string, TaskAssignment[]>;
  /** Task completion progress (0-1) */
  taskProgress: number;
  /** Total tasks across all crew */
  totalTasks: number;
  /** Completed tasks count */
  completedTasks: number;
}

/**
 * The Skeld — Full map definition
 */
export const THE_SKELD: Record<Room, RoomInfo> = {
  [Room.CAFETERIA]: {
    id: Room.CAFETERIA,
    name: "Cafeteria",
    adjacent: [Room.WEAPONS, Room.UPPER_ENGINE, Room.MEDBAY, Room.ADMIN, Room.STORAGE],
    x: 50, y: 10,
    tasks: ["wiring", "download"],
  },
  [Room.WEAPONS]: {
    id: Room.WEAPONS,
    name: "Weapons",
    adjacent: [Room.CAFETERIA, Room.NAVIGATION, Room.O2],
    x: 75, y: 15,
    tasks: ["asteroids", "download"],
  },
  [Room.NAVIGATION]: {
    id: Room.NAVIGATION,
    name: "Navigation",
    adjacent: [Room.WEAPONS, Room.O2, Room.SHIELDS],
    vents: [Room.WEAPONS, Room.SHIELDS],
    x: 90, y: 45,
    tasks: ["chart_course", "stabilize_steering"],
  },
  [Room.O2]: {
    id: Room.O2,
    name: "O2",
    adjacent: [Room.WEAPONS, Room.NAVIGATION, Room.SHIELDS, Room.CAFETERIA],
    x: 70, y: 40,
    tasks: ["clean_filter", "empty_garbage"],
  },
  [Room.SHIELDS]: {
    id: Room.SHIELDS,
    name: "Shields",
    adjacent: [Room.NAVIGATION, Room.O2, Room.COMMUNICATIONS, Room.STORAGE],
    vents: [Room.NAVIGATION, Room.WEAPONS],
    x: 75, y: 70,
    tasks: ["prime_shields"],
  },
  [Room.COMMUNICATIONS]: {
    id: Room.COMMUNICATIONS,
    name: "Communications",
    adjacent: [Room.SHIELDS, Room.STORAGE],
    x: 60, y: 85,
    tasks: ["download"],
  },
  [Room.STORAGE]: {
    id: Room.STORAGE,
    name: "Storage",
    adjacent: [Room.CAFETERIA, Room.COMMUNICATIONS, Room.SHIELDS, Room.ADMIN, Room.ELECTRICAL, Room.LOWER_ENGINE],
    x: 45, y: 75,
    tasks: ["fuel_engines", "empty_garbage", "wiring"],
  },
  [Room.ADMIN]: {
    id: Room.ADMIN,
    name: "Admin",
    adjacent: [Room.CAFETERIA, Room.STORAGE],
    vents: [Room.CAFETERIA],
    x: 55, y: 50,
    tasks: ["swipe_card", "upload", "wiring"],
  },
  [Room.ELECTRICAL]: {
    id: Room.ELECTRICAL,
    name: "Electrical",
    adjacent: [Room.STORAGE, Room.LOWER_ENGINE],
    vents: [Room.SECURITY, Room.MEDBAY],
    x: 30, y: 70,
    tasks: ["calibrate_distributor", "divert_power", "download", "wiring"],
  },
  [Room.LOWER_ENGINE]: {
    id: Room.LOWER_ENGINE,
    name: "Lower Engine",
    adjacent: [Room.STORAGE, Room.ELECTRICAL, Room.SECURITY, Room.REACTOR],
    vents: [Room.UPPER_ENGINE, Room.REACTOR],
    x: 15, y: 75,
    tasks: ["align_engine", "fuel_engines"],
  },
  [Room.SECURITY]: {
    id: Room.SECURITY,
    name: "Security",
    adjacent: [Room.LOWER_ENGINE, Room.UPPER_ENGINE, Room.REACTOR],
    vents: [Room.ELECTRICAL, Room.MEDBAY],
    x: 20, y: 50,
    tasks: ["wiring"],
  },
  [Room.REACTOR]: {
    id: Room.REACTOR,
    name: "Reactor",
    adjacent: [Room.UPPER_ENGINE, Room.SECURITY, Room.LOWER_ENGINE],
    vents: [Room.UPPER_ENGINE, Room.LOWER_ENGINE],
    x: 5, y: 50,
    tasks: ["start_reactor", "unlock_manifolds"],
  },
  [Room.UPPER_ENGINE]: {
    id: Room.UPPER_ENGINE,
    name: "Upper Engine",
    adjacent: [Room.REACTOR, Room.SECURITY, Room.CAFETERIA, Room.MEDBAY],
    vents: [Room.LOWER_ENGINE, Room.REACTOR],
    x: 15, y: 25,
    tasks: ["align_engine", "fuel_engines"],
  },
  [Room.MEDBAY]: {
    id: Room.MEDBAY,
    name: "MedBay",
    adjacent: [Room.UPPER_ENGINE, Room.CAFETERIA],
    vents: [Room.ELECTRICAL, Room.SECURITY],
    x: 35, y: 30,
    tasks: ["submit_scan", "inspect_sample"],
  },
};

/** Get shortest path between two rooms (BFS) */
export function getPath(from: Room, to: Room): Room[] {
  if (from === to) return [from];
  const queue: Room[][] = [[from]];
  const visited = new Set<Room>([from]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];
    const room = THE_SKELD[current];

    for (const next of room.adjacent) {
      if (next === to) return [...path, next];
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return []; // unreachable
}

/** Get distance (number of moves) between two rooms */
export function getDistance(from: Room, to: Room): number {
  return Math.max(0, getPath(from, to).length - 1);
}

/** Check if two rooms are adjacent */
export function isAdjacent(a: Room, b: Room): boolean {
  return THE_SKELD[a].adjacent.includes(b);
}

/** Check if impostor can vent from room A to room B */
export function canVent(from: Room, to: Room): boolean {
  return THE_SKELD[from].vents?.includes(to) ?? false;
}

/** Get all vent destinations from a room */
export function getVentTargets(room: Room): Room[] {
  return THE_SKELD[room].vents ?? [];
}
