/**
 * The Skeld Map — CSS Grid layout matching actual Among Us map
 */
import { useQuery } from "@tanstack/react-query";
import { Room } from "@prescio/common";
import { cn } from "@/lib/utils";

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

const PLAYER_COLORS = [
  "bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500",
  "bg-purple-500", "bg-pink-500", "bg-teal-500", "bg-orange-500",
  "bg-indigo-500", "bg-lime-500",
];

const PLAYER_BORDER_COLORS = [
  "border-red-400", "border-blue-400", "border-green-400", "border-yellow-400",
  "border-purple-400", "border-pink-400", "border-teal-400", "border-orange-400",
  "border-indigo-400", "border-lime-400",
];

// Room config: grid position + display
interface RoomConfig {
  id: Room;
  name: string;
  nameEn: string;
  gridArea: string;
  accent: string; // border color when active
  bg: string; // background
}

const ROOM_CONFIG: RoomConfig[] = [
  { id: Room.UPPER_ENGINE, name: "상부 엔진", nameEn: "Upper Engine", gridArea: "ue", accent: "border-blue-500", bg: "from-blue-900/40 to-blue-950/60" },
  { id: Room.REACTOR, name: "원자로", nameEn: "Reactor", gridArea: "re", accent: "border-red-500", bg: "from-red-900/40 to-red-950/60" },
  { id: Room.SECURITY, name: "보안실", nameEn: "Security", gridArea: "se", accent: "border-green-500", bg: "from-green-900/40 to-green-950/60" },
  { id: Room.MEDBAY, name: "의무실", nameEn: "MedBay", gridArea: "mb", accent: "border-cyan-500", bg: "from-cyan-900/40 to-cyan-950/60" },
  { id: Room.CAFETERIA, name: "식당", nameEn: "Cafeteria", gridArea: "ca", accent: "border-purple-500", bg: "from-purple-900/40 to-purple-950/60" },
  { id: Room.WEAPONS, name: "무기고", nameEn: "Weapons", gridArea: "we", accent: "border-rose-500", bg: "from-rose-900/40 to-rose-950/60" },
  { id: Room.O2, name: "산소공급실", nameEn: "O2", gridArea: "o2", accent: "border-emerald-500", bg: "from-emerald-900/40 to-emerald-950/60" },
  { id: Room.NAVIGATION, name: "항해실", nameEn: "Navigation", gridArea: "na", accent: "border-sky-500", bg: "from-sky-900/40 to-sky-950/60" },
  { id: Room.ADMIN, name: "관리실", nameEn: "Admin", gridArea: "ad", accent: "border-amber-500", bg: "from-amber-900/40 to-amber-950/60" },
  { id: Room.STORAGE, name: "창고", nameEn: "Storage", gridArea: "st", accent: "border-slate-500", bg: "from-slate-800/40 to-slate-900/60" },
  { id: Room.ELECTRICAL, name: "전기실", nameEn: "Electrical", gridArea: "el", accent: "border-yellow-500", bg: "from-yellow-900/40 to-yellow-950/60" },
  { id: Room.LOWER_ENGINE, name: "하부 엔진", nameEn: "Lower Engine", gridArea: "le", accent: "border-blue-500", bg: "from-blue-900/40 to-blue-950/60" },
  { id: Room.COMMUNICATIONS, name: "통신실", nameEn: "Comms", gridArea: "co", accent: "border-violet-500", bg: "from-violet-900/40 to-violet-950/60" },
  { id: Room.SHIELDS, name: "보호막", nameEn: "Shields", gridArea: "sh", accent: "border-orange-500", bg: "from-orange-900/40 to-orange-950/60" },
];

interface PlayerInfo {
  nickname: string;
  isAlive: boolean;
  colorIdx: number;
}

function RoomCard({
  room,
  players,
  hasPlayers,
}: {
  room: RoomConfig;
  players: PlayerInfo[];
  hasPlayers: boolean;
}) {
  return (
    <div
      className={cn(
        "relative rounded-lg border-2 bg-gradient-to-br p-2 transition-all duration-300 min-h-[60px] flex flex-col",
        room.bg,
        hasPlayers
          ? `${room.accent} shadow-lg shadow-black/30`
          : "border-gray-800/50",
      )}
      style={{ gridArea: room.gridArea }}
    >
      {/* Room name */}
      <div className="flex items-center justify-between mb-1">
        <span className={cn(
          "text-[11px] font-bold uppercase tracking-wide",
          hasPlayers ? "text-white" : "text-gray-500",
        )}>
          {room.name}
        </span>
        {hasPlayers && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">
            {players.length}
          </span>
        )}
      </div>

      {/* Players */}
      {hasPlayers && (
        <div className="flex flex-wrap gap-1 mt-auto">
          {players.map((p, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border",
                p.isAlive
                  ? `${PLAYER_COLORS[p.colorIdx]} bg-opacity-30 ${PLAYER_BORDER_COLORS[p.colorIdx]} text-white`
                  : "bg-gray-800 border-gray-700 text-gray-500 line-through",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full flex-shrink-0",
                  p.isAlive ? PLAYER_COLORS[p.colorIdx] : "bg-gray-600",
                )}
              />
              {p.nickname}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GameMap({ gameId }: { gameId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["map", gameId],
    queryFn: () => fetchMapData(gameId),
    refetchInterval: 3000,
  });

  if (isLoading || !data?.mapEnabled) return null;

  const locations = data.locations ?? [];

  // Assign persistent color indices
  const colorMap: Record<string, number> = {};
  const uniqueIds = [...new Set(locations.map((l) => l.playerId))];
  uniqueIds.forEach((pid, i) => {
    colorMap[pid] = i % PLAYER_COLORS.length;
  });

  // Group by room
  const playersByRoom: Record<string, PlayerInfo[]> = {};
  for (const loc of locations) {
    if (!playersByRoom[loc.room]) playersByRoom[loc.room] = [];
    playersByRoom[loc.room].push({
      nickname: loc.nickname.replace("Agent-", ""),
      isAlive: loc.isAlive,
      colorIdx: colorMap[loc.playerId] ?? 0,
    });
  }

  const progress = data.taskProgress ?? 0;

  return (
    <div className="rounded-xl border border-monad-border bg-gray-950/80 p-3 backdrop-blur">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🚀</span>
          <span className="text-sm font-bold text-white tracking-wider">THE SKELD</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Tasks {data.completedTasks ?? 0}/{data.totalTasks ?? 0}
          </span>
          <div className="h-2 w-28 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Map Grid — The Skeld Layout
        Row 1: [Upper Engine] [         ] [MedBay    ] [Cafeteria     ] [Weapons  ] [         ]
        Row 2: [Reactor     ] [Security ] [          ] [Admin   ] [O2       ] [Navigation]
        Row 3: [Lower Engine] [Electrical] [Storage              ] [Comms    ] [Shields   ]
      */}
      <div
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: "1fr 1fr 1fr 1.2fr 1fr 1fr",
          gridTemplateRows: "auto auto auto",
          gridTemplateAreas: `
            "ue  .   mb  ca  we  .  "
            "re  se  .   ad  o2  na "
            "le  el  st  st  co  sh "
          `,
        }}
      >
        {ROOM_CONFIG.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            players={playersByRoom[room.id] ?? []}
            hasPlayers={(playersByRoom[room.id]?.length ?? 0) > 0}
          />
        ))}
      </div>

      {/* Vent info (compact) */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-600">
        <span>🔴 Vents: 항해실↔무기고↔보호막 | 관리실↔식당 | 전기실↔보안실↔의무실 | 원자로↔상부엔진↔하부엔진</span>
      </div>
    </div>
  );
}
