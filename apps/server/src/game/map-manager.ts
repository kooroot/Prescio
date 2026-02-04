/**
 * Map Manager — Player location tracking & movement
 */
import {
  Room,
  THE_SKELD,
  isAdjacent,
  canVent,
  getVentTargets,
  type MapState,
  type PlayerLocation,
  type TaskAssignment,
  type GameState,
  Role,
} from "@prescio/common";
import { v4 as uuidv4 } from "uuid";

// ── Task pool ───────────────────────────────────
interface TaskDef {
  name: string;
  displayName: string;
  room: Room;
  room2?: Room;
  isVisual: boolean;
}

const TASK_POOL: TaskDef[] = [
  { name: "swipe_card", displayName: "Swipe Card", room: Room.ADMIN, isVisual: false },
  { name: "upload_data", displayName: "Upload Data", room: Room.ADMIN, isVisual: false },
  { name: "wiring_admin", displayName: "Fix Wiring", room: Room.ADMIN, isVisual: false },
  { name: "asteroids", displayName: "Clear Asteroids", room: Room.WEAPONS, isVisual: true },
  { name: "chart_course", displayName: "Chart Course", room: Room.NAVIGATION, isVisual: false },
  { name: "stabilize_steering", displayName: "Stabilize Steering", room: Room.NAVIGATION, isVisual: false },
  { name: "clean_filter", displayName: "Clean O2 Filter", room: Room.O2, isVisual: false },
  { name: "prime_shields", displayName: "Prime Shields", room: Room.SHIELDS, isVisual: true },
  { name: "empty_garbage", displayName: "Empty Garbage", room: Room.STORAGE, isVisual: true },
  { name: "fuel_engines", displayName: "Fuel Engines", room: Room.STORAGE, room2: Room.UPPER_ENGINE, isVisual: false },
  { name: "calibrate_dist", displayName: "Calibrate Distributor", room: Room.ELECTRICAL, isVisual: false },
  { name: "divert_power", displayName: "Divert Power", room: Room.ELECTRICAL, isVisual: false },
  { name: "download_elec", displayName: "Download Data", room: Room.ELECTRICAL, isVisual: false },
  { name: "wiring_elec", displayName: "Fix Wiring", room: Room.ELECTRICAL, isVisual: false },
  { name: "align_upper", displayName: "Align Engine", room: Room.UPPER_ENGINE, isVisual: false },
  { name: "align_lower", displayName: "Align Engine", room: Room.LOWER_ENGINE, isVisual: false },
  { name: "start_reactor", displayName: "Start Reactor", room: Room.REACTOR, isVisual: false },
  { name: "unlock_manifolds", displayName: "Unlock Manifolds", room: Room.REACTOR, isVisual: false },
  { name: "submit_scan", displayName: "Submit Scan", room: Room.MEDBAY, isVisual: true },
  { name: "inspect_sample", displayName: "Inspect Sample", room: Room.MEDBAY, isVisual: false },
  { name: "wiring_security", displayName: "Fix Wiring", room: Room.SECURITY, isVisual: false },
  { name: "download_comms", displayName: "Download Data", room: Room.COMMUNICATIONS, isVisual: false },
];

const TASKS_PER_CREW = 5;

// ── Map initialization ──────────────────────────
export function initializeMap(game: GameState): MapState {
  const locations: Record<string, PlayerLocation> = {};
  const tasks: Record<string, TaskAssignment[]> = {};
  let totalTasks = 0;

  for (const player of game.players) {
    // Everyone starts in Cafeteria
    locations[player.id] = {
      playerId: player.id,
      room: Room.CAFETERIA,
      movedAt: Date.now(),
      isMoving: false,
    };

    // Assign tasks to crew members only
    if (player.role === Role.CREW) {
      const playerTasks = assignTasks(TASKS_PER_CREW);
      tasks[player.id] = playerTasks;
      totalTasks += playerTasks.length;
    } else {
      // Impostors get fake tasks (for display)
      tasks[player.id] = assignTasks(TASKS_PER_CREW);
    }
  }

  return {
    locations,
    tasks,
    taskProgress: 0,
    totalTasks,
    completedTasks: 0,
  };
}

function assignTasks(count: number): TaskAssignment[] {
  const shuffled = [...TASK_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((t) => ({
    id: uuidv4(),
    name: t.displayName,
    room: t.room,
    room2: t.room2,
    completed: false,
    isVisual: t.isVisual,
  }));
}

// ── Movement ────────────────────────────────────
export interface MoveResult {
  success: boolean;
  error?: string;
  from?: Room;
  to?: Room;
}

export function movePlayer(
  mapState: MapState,
  playerId: string,
  targetRoom: Room
): MoveResult {
  const loc = mapState.locations[playerId];
  if (!loc) return { success: false, error: "Player not found on map" };

  if (loc.room === targetRoom) {
    return { success: false, error: "Already in this room" };
  }

  if (!isAdjacent(loc.room, targetRoom)) {
    return { success: false, error: `Cannot walk from ${loc.room} to ${targetRoom}` };
  }

  const from = loc.room;
  loc.room = targetRoom;
  loc.movedAt = Date.now();

  return { success: true, from, to: targetRoom };
}

// ── Vent ─────────────────────────────────────────
export function ventPlayer(
  mapState: MapState,
  playerId: string,
  targetRoom: Room,
  isImpostor: boolean
): MoveResult {
  if (!isImpostor) {
    return { success: false, error: "Only impostors can use vents" };
  }

  const loc = mapState.locations[playerId];
  if (!loc) return { success: false, error: "Player not found on map" };

  if (!canVent(loc.room, targetRoom)) {
    return { success: false, error: `No vent connection from ${loc.room} to ${targetRoom}` };
  }

  const from = loc.room;
  loc.room = targetRoom;
  loc.movedAt = Date.now();

  return { success: true, from, to: targetRoom };
}

// ── Tasks ────────────────────────────────────────
export interface TaskResult {
  success: boolean;
  error?: string;
  taskName?: string;
  isVisual?: boolean;
  taskProgress?: number;
}

export function completeTask(
  mapState: MapState,
  playerId: string,
  taskId: string,
  isImpostor: boolean
): TaskResult {
  // Impostors can fake tasks but they don't count
  const playerTasks = mapState.tasks[playerId];
  if (!playerTasks) return { success: false, error: "No tasks found" };

  const task = playerTasks.find((t) => t.id === taskId);
  if (!task) return { success: false, error: "Task not found" };
  if (task.completed) return { success: false, error: "Task already completed" };

  const loc = mapState.locations[playerId];
  if (!loc) return { success: false, error: "Player not on map" };
  if (loc.room !== task.room && loc.room !== task.room2) {
    return { success: false, error: `Must be in ${THE_SKELD[task.room].name} to complete this task` };
  }

  task.completed = true;

  // Only crew tasks count toward progress
  if (!isImpostor) {
    mapState.completedTasks++;
    mapState.taskProgress = mapState.totalTasks > 0
      ? mapState.completedTasks / mapState.totalTasks
      : 0;
  }

  return {
    success: true,
    taskName: task.name,
    isVisual: task.isVisual,
    taskProgress: mapState.taskProgress,
  };
}

// ── Kill check ───────────────────────────────────
export function canKillInRange(
  mapState: MapState,
  killerId: string,
  targetId: string
): boolean {
  const killerLoc = mapState.locations[killerId];
  const targetLoc = mapState.locations[targetId];
  if (!killerLoc || !targetLoc) return false;
  return killerLoc.room === targetLoc.room;
}

// ── Query helpers ────────────────────────────────
export function getPlayersInRoom(mapState: MapState, room: Room): string[] {
  return Object.values(mapState.locations)
    .filter((loc) => loc.room === room)
    .map((loc) => loc.playerId);
}

export function getPlayerRoom(mapState: MapState, playerId: string): Room | null {
  return mapState.locations[playerId]?.room ?? null;
}

export function getRoomPopulation(mapState: MapState): Record<Room, number> {
  const pop = {} as Record<Room, number>;
  for (const room of Object.values(Room)) {
    pop[room] = 0;
  }
  for (const loc of Object.values(mapState.locations)) {
    pop[loc.room]++;
  }
  return pop;
}
