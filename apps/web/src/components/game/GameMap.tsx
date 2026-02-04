/**
 * The Skeld Map — Faithful 2D recreation
 */
import { useQuery } from "@tanstack/react-query";
import { Room } from "@prescio/common";
import { Users } from "lucide-react";

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

// ── Room layout matching The Skeld ──────────────────
// Each room: SVG path, label position, name
interface RoomDef {
  id: Room;
  name: string;
  nameKo: string;
  // SVG path for the room shape
  path: string;
  // Label anchor point
  labelX: number;
  labelY: number;
  // Size class for glow intensity
  size: "sm" | "md" | "lg";
}

const ROOMS: RoomDef[] = [
  {
    id: Room.CAFETERIA, name: "Cafeteria", nameKo: "식당",
    path: "M 370,20 L 430,20 470,40 490,80 490,150 470,190 430,210 370,210 330,190 310,150 310,80 330,40 Z",
    labelX: 400, labelY: 120, size: "lg",
  },
  {
    id: Room.WEAPONS, name: "Weapons", nameKo: "무기고",
    path: "M 560,30 L 620,30 650,50 650,100 620,120 560,120 540,100 540,50 Z",
    labelX: 595, labelY: 80, size: "md",
  },
  {
    id: Room.NAVIGATION, name: "Navigation", nameKo: "항해실",
    path: "M 680,120 L 740,150 760,190 760,230 740,270 680,280 660,260 660,160 Z",
    labelX: 710, labelY: 200, size: "md",
  },
  {
    id: Room.O2, name: "O2", nameKo: "산소공급실",
    path: "M 480,130 L 550,130 570,150 570,210 550,230 480,230 460,210 460,150 Z",
    labelX: 515, labelY: 180, size: "md",
  },
  {
    id: Room.SHIELDS, name: "Shields", nameKo: "보호막제어실",
    path: "M 580,300 L 660,300 680,320 680,390 660,410 580,410 560,390 560,320 Z",
    labelX: 620, labelY: 350, size: "md",
  },
  {
    id: Room.COMMUNICATIONS, name: "Comms", nameKo: "통신실",
    path: "M 440,380 L 530,380 540,395 540,440 530,455 440,455 430,440 430,395 Z",
    labelX: 485, labelY: 420, size: "sm",
  },
  {
    id: Room.STORAGE, name: "Storage", nameKo: "창고",
    path: "M 310,290 L 440,290 460,310 460,410 440,430 310,430 290,410 290,310 Z",
    labelX: 375, labelY: 360, size: "lg",
  },
  {
    id: Room.ADMIN, name: "Admin", nameKo: "관리실",
    path: "M 440,220 L 540,220 560,240 560,300 540,320 440,320 420,300 420,240 Z",
    labelX: 490, labelY: 270, size: "md",
  },
  {
    id: Room.ELECTRICAL, name: "Electrical", nameKo: "전기실",
    path: "M 200,290 L 300,290 310,310 310,390 300,410 200,410 190,390 190,310 Z",
    labelX: 250, labelY: 350, size: "md",
  },
  {
    id: Room.LOWER_ENGINE, name: "Lower Engine", nameKo: "하부 엔진",
    path: "M 60,340 L 150,340 170,360 170,420 150,440 60,440 40,420 40,360 Z",
    labelX: 105, labelY: 390, size: "md",
  },
  {
    id: Room.SECURITY, name: "Security", nameKo: "보안실",
    path: "M 160,200 L 230,200 245,215 245,270 230,285 160,285 145,270 145,215 Z",
    labelX: 195, labelY: 245, size: "sm",
  },
  {
    id: Room.REACTOR, name: "Reactor", nameKo: "원자로",
    path: "M 20,180 L 110,180 130,200 130,290 110,310 20,310 0,290 0,200 Z",
    labelX: 65, labelY: 245, size: "md",
  },
  {
    id: Room.UPPER_ENGINE, name: "Upper Engine", nameKo: "상부 엔진",
    path: "M 60,50 L 150,50 170,70 170,140 150,160 60,160 40,140 40,70 Z",
    labelX: 105, labelY: 105, size: "md",
  },
  {
    id: Room.MEDBAY, name: "MedBay", nameKo: "의무실",
    path: "M 210,100 L 310,100 325,120 325,200 310,220 210,220 195,200 195,120 Z",
    labelX: 260, labelY: 160, size: "md",
  },
];

// Hallway connections (visual corridors)
const HALLWAYS: Array<{ d: string }> = [
  // Cafeteria → Weapons
  { d: "M 470,60 L 540,45 Q 555,42 555,55 L 555,55" },
  // Cafeteria → Upper Engine
  { d: "M 330,80 L 170,80 Q 160,80 160,90 L 160,90" },
  // Cafeteria → MedBay
  { d: "M 330,140 L 325,140" },
  // Cafeteria → Admin (via hallway)
  { d: "M 400,210 L 400,230 Q 400,235 420,235 L 420,240" },
  // Cafeteria → Storage
  { d: "M 370,210 L 360,290" },
  // Weapons → Navigation
  { d: "M 650,100 L 670,140" },
  // Weapons → O2
  { d: "M 560,100 L 540,130" },
  // O2 → Navigation
  { d: "M 570,200 L 660,220" },
  // O2 → Shields
  { d: "M 550,230 L 590,300" },
  // O2 → Cafeteria
  { d: "M 480,140 L 470,140" },
  // Shields → Navigation
  { d: "M 680,320 L 700,280" },
  // Shields → Communications
  { d: "M 560,380 L 540,400" },
  // Shields → Storage
  { d: "M 560,350 L 460,350" },
  // Communications → Storage
  { d: "M 430,420 L 420,420" },
  // Admin → Storage
  { d: "M 420,290 L 400,290" },
  // Storage → Electrical
  { d: "M 290,350 L 310,350" },
  // Storage → Lower Engine
  { d: "M 290,380 L 170,380" },
  // Electrical → Lower Engine
  { d: "M 190,370 L 170,370" },
  // Lower Engine → Reactor
  { d: "M 60,340 L 60,310" },
  // Lower Engine → Security
  { d: "M 130,340 L 180,285" },
  // Security → Reactor
  { d: "M 145,250 L 130,250" },
  // Security → Upper Engine
  { d: "M 170,200 L 150,160" },
  // Reactor → Upper Engine
  { d: "M 60,180 L 60,160" },
  // Upper Engine → MedBay
  { d: "M 170,100 L 195,120" },
  // Upper Engine → Cafeteria
  { d: "M 150,80 L 310,80" },
  // MedBay → Cafeteria
  { d: "M 310,140 L 330,140" },
];

// Vent connections
const VENT_LINES: Array<[number, number, number, number]> = [
  // Navigation ↔ Weapons ↔ Shields
  [710, 200, 595, 80],
  [595, 80, 620, 350],
  [620, 350, 710, 200],
  // Admin ↔ Cafeteria
  [490, 270, 400, 190],
  // Electrical ↔ Security ↔ MedBay
  [250, 350, 195, 245],
  [195, 245, 260, 160],
  [260, 160, 250, 350],
  // Reactor ↔ Upper Engine ↔ Lower Engine
  [65, 245, 105, 105],
  [105, 105, 105, 390],
  [105, 390, 65, 245],
];

interface PlayerDot {
  nickname: string;
  isAlive: boolean;
  color: string;
}

const PLAYER_COLORS = [
  "#ef4444", "#3b82f6", "#22c55e", "#f59e0b",
  "#a855f7", "#ec4899", "#14b8a6", "#f97316",
  "#6366f1", "#84cc16",
];

export function GameMap({ gameId }: { gameId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["map", gameId],
    queryFn: () => fetchMapData(gameId),
    refetchInterval: 3000,
  });

  if (isLoading || !data?.mapEnabled) return null;

  const population = data.population ?? {};
  const locations = data.locations ?? [];

  // Assign colors to players
  const playerColorMap: Record<string, string> = {};
  const uniquePlayers = [...new Set(locations.map((l) => l.playerId))];
  uniquePlayers.forEach((pid, i) => {
    playerColorMap[pid] = PLAYER_COLORS[i % PLAYER_COLORS.length];
  });

  // Group players by room
  const playersByRoom: Record<string, PlayerDot[]> = {};
  for (const loc of locations) {
    if (!playersByRoom[loc.room]) playersByRoom[loc.room] = [];
    playersByRoom[loc.room].push({
      nickname: loc.nickname.replace("Agent-", ""),
      isAlive: loc.isAlive,
      color: playerColorMap[loc.playerId] ?? "#888",
    });
  }

  const progress = data.taskProgress ?? 0;

  return (
    <div className="rounded-xl border border-monad-border bg-black/60 p-4 backdrop-blur">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
          <Users className="h-4 w-4 text-purple-400" />
          The Skeld
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-400">
            Tasks {data.completedTasks ?? 0}/{data.totalTasks ?? 0}
          </span>
          <div className="h-2 w-32 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* SVG Map */}
      <svg
        viewBox="-20 -10 810 490"
        className="w-full"
        style={{ minHeight: "300px" }}
      >
        <defs>
          {/* Glow filter for active rooms */}
          <filter id="roomGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="ventGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background stars */}
        {Array.from({ length: 30 }).map((_, i) => (
          <circle
            key={`star-${i}`}
            cx={Math.random() * 800}
            cy={Math.random() * 480}
            r={Math.random() * 1.2 + 0.3}
            fill="white"
            opacity={Math.random() * 0.4 + 0.1}
          />
        ))}

        {/* Hallway connections */}
        {HALLWAYS.map((h, i) => (
          <path
            key={`hall-${i}`}
            d={h.d}
            fill="none"
            stroke="#334155"
            strokeWidth={12}
            strokeLinecap="round"
            opacity={0.5}
          />
        ))}

        {/* Vent connections */}
        {VENT_LINES.map(([x1, y1, x2, y2], i) => (
          <line
            key={`vent-${i}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#dc2626"
            strokeWidth={1.5}
            strokeDasharray="6,8"
            opacity={0.3}
            filter="url(#ventGlow)"
          />
        ))}

        {/* Rooms */}
        {ROOMS.map((room) => {
          const count = population[room.id] ?? 0;
          const hasPlayers = count > 0;
          const players = playersByRoom[room.id] ?? [];

          return (
            <g key={room.id}>
              {/* Room shape */}
              <path
                d={room.path}
                fill={hasPlayers ? "#2563eb" : "#1e40af"}
                fillOpacity={hasPlayers ? 0.7 : 0.4}
                stroke={hasPlayers ? "#60a5fa" : "#3b82f6"}
                strokeWidth={hasPlayers ? 2 : 1}
                filter={hasPlayers ? "url(#roomGlow)" : undefined}
              />

              {/* Room name */}
              <text
                x={room.labelX}
                y={room.labelY - (hasPlayers ? 10 : 0)}
                textAnchor="middle"
                fill="#93c5fd"
                fontSize={room.size === "lg" ? 16 : room.size === "md" ? 13 : 11}
                fontWeight="700"
                style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
              >
                {room.nameKo}
              </text>

              {/* Player dots */}
              {hasPlayers && (
                <g>
                  {players.slice(0, 6).map((p, i) => {
                    const cols = Math.min(players.length, 3);
                    const row = Math.floor(i / cols);
                    const col = i % cols;
                    const startX = room.labelX - (cols - 1) * 12;
                    const px = startX + col * 24;
                    const py = room.labelY + 6 + row * 22;

                    return (
                      <g key={i}>
                        {/* Player circle */}
                        <circle
                          cx={px}
                          cy={py}
                          r={7}
                          fill={p.isAlive ? p.color : "#374151"}
                          stroke={p.isAlive ? "white" : "#6b7280"}
                          strokeWidth={1.5}
                          opacity={p.isAlive ? 1 : 0.5}
                        />
                        {/* Dead X */}
                        {!p.isAlive && (
                          <text
                            x={px}
                            y={py + 3}
                            textAnchor="middle"
                            fill="#ef4444"
                            fontSize="8"
                            fontWeight="bold"
                          >
                            ✕
                          </text>
                        )}
                        {/* Name label */}
                        <text
                          x={px}
                          y={py + 16}
                          textAnchor="middle"
                          fill={p.isAlive ? "#e2e8f0" : "#6b7280"}
                          fontSize="8"
                          fontWeight="500"
                        >
                          {p.nickname}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Population badge */}
              {hasPlayers && (
                <g transform={`translate(${room.labelX + (room.size === "lg" ? 50 : 40)}, ${room.labelY - 20})`}>
                  <circle r={10} fill="#7c3aed" stroke="#a78bfa" strokeWidth={1} />
                  <text
                    textAnchor="middle"
                    y={4}
                    fill="white"
                    fontSize="11"
                    fontWeight="bold"
                  >
                    {count}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-5 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-blue-600/60 border border-blue-400" />
          Room
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-6 border-t-2 border-dashed border-red-600/50" />
          Vent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
          Players
        </span>
      </div>
    </div>
  );
}
