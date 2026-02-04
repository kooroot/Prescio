/**
 * The Skeld Map Visualization
 * SVG-based 2D map showing rooms, connections, and player locations
 */
import { useQuery } from "@tanstack/react-query";
import { THE_SKELD, Room, type RoomInfo } from "@prescio/common";
import { Users } from "lucide-react";
import { useI18n } from "@/i18n";

interface MapData {
  gameId: string;
  mapEnabled: boolean;
  locations?: Array<{
    playerId: string;
    nickname: string;
    room: string;
    isAlive: boolean;
  }>;
  population?: Record<string, number>;
  taskProgress?: number;
  completedTasks?: number;
  totalTasks?: number;
}

function fetchMapData(gameId: string): Promise<MapData> {
  return fetch(`/api/games/${gameId}/map`).then((r) => r.json());
}

// Room display names (localized later)
const ROOM_NAMES: Record<Room, string> = {
  [Room.CAFETERIA]: "Cafeteria",
  [Room.WEAPONS]: "Weapons",
  [Room.NAVIGATION]: "Navigation",
  [Room.O2]: "O2",
  [Room.SHIELDS]: "Shields",
  [Room.COMMUNICATIONS]: "Comms",
  [Room.STORAGE]: "Storage",
  [Room.ADMIN]: "Admin",
  [Room.ELECTRICAL]: "Electrical",
  [Room.LOWER_ENGINE]: "Lower Eng",
  [Room.SECURITY]: "Security",
  [Room.REACTOR]: "Reactor",
  [Room.UPPER_ENGINE]: "Upper Eng",
  [Room.MEDBAY]: "MedBay",
};

// Colors for rooms
const ROOM_COLORS: Record<string, string> = {
  cafeteria: "#4a5568",
  weapons: "#c53030",
  navigation: "#2b6cb0",
  o2: "#38a169",
  shields: "#d69e2e",
  communications: "#805ad5",
  storage: "#718096",
  admin: "#dd6b20",
  electrical: "#e53e3e",
  lower_engine: "#2c5282",
  security: "#276749",
  reactor: "#9b2c2c",
  upper_engine: "#2c5282",
  medbay: "#2f855a",
};

interface RoomNodeProps {
  room: RoomInfo;
  population: number;
  players: Array<{ nickname: string; isAlive: boolean }>;
  isSelected?: boolean;
}

function RoomNode({ room, population, players }: RoomNodeProps) {
  const color = ROOM_COLORS[room.id] ?? "#4a5568";
  const hasPlayers = population > 0;

  return (
    <g transform={`translate(${room.x * 8}, ${room.y * 5})`}>
      {/* Room background */}
      <rect
        x={-35}
        y={-20}
        width={70}
        height={40}
        rx={6}
        fill={color}
        fillOpacity={hasPlayers ? 0.6 : 0.25}
        stroke={hasPlayers ? "#a78bfa" : "#4a5568"}
        strokeWidth={hasPlayers ? 1.5 : 0.5}
      />

      {/* Room name */}
      <text
        textAnchor="middle"
        y={-5}
        fill="white"
        fontSize="7"
        fontWeight="600"
      >
        {ROOM_NAMES[room.id]}
      </text>

      {/* Player count */}
      {hasPlayers && (
        <g transform="translate(0, 10)">
          <text
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize="6"
          >
            {players.map((p) => p.nickname).join(", ").slice(0, 20)}
            {players.length > 2 ? "..." : ""}
          </text>
        </g>
      )}

      {/* Population badge */}
      {hasPlayers && (
        <g transform="translate(25, -15)">
          <circle r={7} fill="#7c3aed" />
          <text
            textAnchor="middle"
            y={3}
            fill="white"
            fontSize="7"
            fontWeight="bold"
          >
            {population}
          </text>
        </g>
      )}
    </g>
  );
}

function ConnectionLine({ from, to }: { from: RoomInfo; to: RoomInfo }) {
  return (
    <line
      x1={from.x * 8}
      y1={from.y * 5}
      x2={to.x * 8}
      y2={to.y * 5}
      stroke="#4a5568"
      strokeWidth={0.8}
      strokeDasharray="3,3"
      opacity={0.4}
    />
  );
}

function VentLine({ from, to }: { from: RoomInfo; to: RoomInfo }) {
  return (
    <line
      x1={from.x * 8}
      y1={from.y * 5}
      x2={to.x * 8}
      y2={to.y * 5}
      stroke="#ef4444"
      strokeWidth={0.6}
      strokeDasharray="2,4"
      opacity={0.3}
    />
  );
}

export function GameMap({ gameId }: { gameId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["map", gameId],
    queryFn: () => fetchMapData(gameId),
    refetchInterval: 3000,
  });

  if (isLoading || !data?.mapEnabled) {
    return null;
  }

  const rooms = Object.values(THE_SKELD);
  const population = data.population ?? {};
  const locations = data.locations ?? [];

  // Group players by room
  const playersByRoom: Record<string, Array<{ nickname: string; isAlive: boolean }>> = {};
  for (const loc of locations) {
    if (!playersByRoom[loc.room]) playersByRoom[loc.room] = [];
    playersByRoom[loc.room].push({ nickname: loc.nickname, isAlive: loc.isAlive });
  }

  // Build connection lines (deduplicate)
  const connections: Array<[RoomInfo, RoomInfo]> = [];
  const connectionSet = new Set<string>();
  for (const room of rooms) {
    for (const adjId of room.adjacent) {
      const key = [room.id, adjId].sort().join("-");
      if (!connectionSet.has(key)) {
        connectionSet.add(key);
        connections.push([room, THE_SKELD[adjId as Room]]);
      }
    }
  }

  // Build vent lines
  const vents: Array<[RoomInfo, RoomInfo]> = [];
  const ventSet = new Set<string>();
  for (const room of rooms) {
    for (const ventId of room.vents ?? []) {
      const key = [room.id, ventId].sort().join("-");
      if (!ventSet.has(key)) {
        ventSet.add(key);
        vents.push([room, THE_SKELD[ventId as Room]]);
      }
    }
  }

  const progress = data.taskProgress ?? 0;

  return (
    <div className="rounded-xl border border-monad-border bg-monad-card/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Users className="h-4 w-4 text-purple-400" />
          The Skeld
        </h3>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Tasks: {data.completedTasks ?? 0}/{data.totalTasks ?? 0}</span>
          <div className="h-1.5 w-24 rounded-full bg-gray-700">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>

      <svg
        viewBox="-10 -10 820 500"
        className="w-full"
        style={{ maxHeight: "350px" }}
      >
        {/* Connections */}
        {connections.map(([a, b], i) => (
          <ConnectionLine key={`c-${i}`} from={a} to={b} />
        ))}

        {/* Vent connections */}
        {vents.map(([a, b], i) => (
          <VentLine key={`v-${i}`} from={a} to={b} />
        ))}

        {/* Rooms */}
        {rooms.map((room) => (
          <RoomNode
            key={room.id}
            room={room}
            population={population[room.id] ?? 0}
            players={playersByRoom[room.id] ?? []}
          />
        ))}
      </svg>

      <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 border-t border-dashed border-gray-500" />
          Hallway
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 border-t border-dashed border-red-500" />
          Vent
        </span>
      </div>
    </div>
  );
}
