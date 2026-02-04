/**
 * The Skeld Map — SVG layout + HTML player pills via foreignObject
 */
import { useQuery } from "@tanstack/react-query";
import { Room } from "@prescio/common";
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

// ── Room definitions with proper spacing ──────────
interface RoomDef {
  id: Room;
  names: Record<string, string>;
  // Center position
  cx: number;
  cy: number;
  // Size
  w: number;
  h: number;
  // Visual shape variant
  shape: "rect" | "oct" | "hex";
}

// Carefully positioned to avoid overlap — based on actual Skeld layout
// Canvas: 1000 x 600
const ROOMS: RoomDef[] = [
  { id: Room.CAFETERIA,      names: { ko: "식당", en: "Cafeteria", ja: "カフェテリア", zh: "餐厅" },        cx: 460, cy: 90,  w: 150, h: 120, shape: "oct" },
  { id: Room.WEAPONS,        names: { ko: "무기고", en: "Weapons", ja: "武器庫", zh: "武器室" },            cx: 700, cy: 80,  w: 110, h: 80,  shape: "hex" },
  { id: Room.NAVIGATION,     names: { ko: "항해실", en: "Navigation", ja: "ナビ", zh: "导航室" },           cx: 890, cy: 250, w: 110, h: 100, shape: "hex" },
  { id: Room.O2,             names: { ko: "산소공급실", en: "O2", ja: "O2", zh: "氧气室" },                 cx: 630, cy: 230, w: 120, h: 80,  shape: "rect" },
  { id: Room.SHIELDS,        names: { ko: "보호막", en: "Shields", ja: "シールド", zh: "护盾" },             cx: 780, cy: 420, w: 110, h: 80,  shape: "rect" },
  { id: Room.COMMUNICATIONS, names: { ko: "통신실", en: "Comms", ja: "通信室", zh: "通讯室" },              cx: 600, cy: 500, w: 100, h: 70,  shape: "rect" },
  { id: Room.STORAGE,        names: { ko: "창고", en: "Storage", ja: "倉庫", zh: "仓库" },                  cx: 440, cy: 430, w: 150, h: 110, shape: "rect" },
  { id: Room.ADMIN,          names: { ko: "관리실", en: "Admin", ja: "アドミン", zh: "管理室" },             cx: 560, cy: 330, w: 120, h: 80,  shape: "rect" },
  { id: Room.ELECTRICAL,     names: { ko: "전기실", en: "Electrical", ja: "電気室", zh: "电气室" },          cx: 280, cy: 430, w: 120, h: 90,  shape: "rect" },
  { id: Room.LOWER_ENGINE,   names: { ko: "하부 엔진", en: "Lower Eng", ja: "下エンジン", zh: "下引擎" },    cx: 110, cy: 460, w: 120, h: 90,  shape: "rect" },
  { id: Room.SECURITY,       names: { ko: "보안실", en: "Security", ja: "セキュリティ", zh: "监控室" },      cx: 230, cy: 280, w: 100, h: 70,  shape: "rect" },
  { id: Room.REACTOR,        names: { ko: "원자로", en: "Reactor", ja: "原子炉", zh: "反应堆" },            cx: 80,  cy: 280, w: 120, h: 100, shape: "rect" },
  { id: Room.UPPER_ENGINE,   names: { ko: "상부 엔진", en: "Upper Eng", ja: "上エンジン", zh: "上引擎" },    cx: 110, cy: 110, w: 120, h: 90,  shape: "rect" },
  { id: Room.MEDBAY,         names: { ko: "의무실", en: "MedBay", ja: "医務室", zh: "医疗室" },              cx: 280, cy: 160, w: 120, h: 80,  shape: "rect" },
];

// Hallway connections between rooms
const CONNECTIONS: Array<[Room, Room]> = [
  [Room.CAFETERIA, Room.WEAPONS],
  [Room.CAFETERIA, Room.UPPER_ENGINE],
  [Room.CAFETERIA, Room.MEDBAY],
  [Room.CAFETERIA, Room.ADMIN],
  [Room.CAFETERIA, Room.STORAGE],
  [Room.WEAPONS, Room.NAVIGATION],
  [Room.WEAPONS, Room.O2],
  [Room.O2, Room.NAVIGATION],
  [Room.O2, Room.SHIELDS],
  [Room.O2, Room.CAFETERIA],
  [Room.NAVIGATION, Room.SHIELDS],
  [Room.SHIELDS, Room.COMMUNICATIONS],
  [Room.SHIELDS, Room.STORAGE],
  [Room.COMMUNICATIONS, Room.STORAGE],
  [Room.ADMIN, Room.STORAGE],
  [Room.STORAGE, Room.ELECTRICAL],
  [Room.STORAGE, Room.LOWER_ENGINE],
  [Room.ELECTRICAL, Room.LOWER_ENGINE],
  [Room.LOWER_ENGINE, Room.REACTOR],
  [Room.LOWER_ENGINE, Room.SECURITY],
  [Room.SECURITY, Room.REACTOR],
  [Room.SECURITY, Room.UPPER_ENGINE],
  [Room.REACTOR, Room.UPPER_ENGINE],
  [Room.UPPER_ENGINE, Room.MEDBAY],
  [Room.MEDBAY, Room.CAFETERIA],
];

// Vent connections
const VENTS: Array<[Room, Room]> = [
  [Room.NAVIGATION, Room.WEAPONS],
  [Room.WEAPONS, Room.SHIELDS],
  [Room.NAVIGATION, Room.SHIELDS],
  [Room.ADMIN, Room.CAFETERIA],
  [Room.ELECTRICAL, Room.SECURITY],
  [Room.SECURITY, Room.MEDBAY],
  [Room.ELECTRICAL, Room.MEDBAY],
  [Room.REACTOR, Room.UPPER_ENGINE],
  [Room.UPPER_ENGINE, Room.LOWER_ENGINE],
  [Room.REACTOR, Room.LOWER_ENGINE],
];

const PLAYER_COLORS = [
  "#ef4444", "#3b82f6", "#22c55e", "#eab308",
  "#a855f7", "#ec4899", "#14b8a6", "#f97316",
  "#6366f1", "#84cc16",
];

interface PlayerInfo {
  nickname: string;
  isAlive: boolean;
  color: string;
}

function roomCenter(id: Room): { cx: number; cy: number } {
  const r = ROOMS.find((r) => r.id === id)!;
  return { cx: r.cx, cy: r.cy };
}

function RoomShape({ room, hasPlayers }: { room: RoomDef; hasPlayers: boolean }) {
  const x = room.cx - room.w / 2;
  const y = room.cy - room.h / 2;
  const c = 12; // corner cut for octagon

  let path: string;
  if (room.shape === "oct") {
    path = `M ${x + c},${y} L ${x + room.w - c},${y} L ${x + room.w},${y + c} L ${x + room.w},${y + room.h - c} L ${x + room.w - c},${y + room.h} L ${x + c},${y + room.h} L ${x},${y + room.h - c} L ${x},${y + c} Z`;
  } else if (room.shape === "hex") {
    const mx = room.cx;
    path = `M ${mx},${y} L ${x + room.w},${y + room.h * 0.25} L ${x + room.w},${y + room.h * 0.75} L ${mx},${y + room.h} L ${x},${y + room.h * 0.75} L ${x},${y + room.h * 0.25} Z`;
  } else {
    const r = 6;
    path = `M ${x + r},${y} L ${x + room.w - r},${y} Q ${x + room.w},${y} ${x + room.w},${y + r} L ${x + room.w},${y + room.h - r} Q ${x + room.w},${y + room.h} ${x + room.w - r},${y + room.h} L ${x + r},${y + room.h} Q ${x},${y + room.h} ${x},${y + room.h - r} L ${x},${y + r} Q ${x},${y} ${x + r},${y} Z`;
  }

  return (
    <path
      d={path}
      fill={hasPlayers ? "#1e3a5f" : "#162032"}
      stroke={hasPlayers ? "#3b82f6" : "#1e3a5f"}
      strokeWidth={hasPlayers ? 2.5 : 1.5}
    />
  );
}

export function GameMap({ gameId }: { gameId: string }) {
  const { lang } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["map", gameId],
    queryFn: () => fetchMapData(gameId),
    refetchInterval: 3000,
  });

  if (isLoading || !data?.mapEnabled) return null;

  const locations = data.locations ?? [];

  // Assign colors
  const colorMap: Record<string, string> = {};
  const uniqueIds = [...new Set(locations.map((l) => l.playerId))];
  uniqueIds.forEach((pid, i) => {
    colorMap[pid] = PLAYER_COLORS[i % PLAYER_COLORS.length];
  });

  // Group by room
  const playersByRoom: Record<string, PlayerInfo[]> = {};
  for (const loc of locations) {
    if (!playersByRoom[loc.room]) playersByRoom[loc.room] = [];
    playersByRoom[loc.room].push({
      nickname: loc.nickname.replace("Agent-", ""),
      isAlive: loc.isAlive,
      color: colorMap[loc.playerId] ?? "#888",
    });
  }

  const progress = data.taskProgress ?? 0;

  const ventLabel = lang === "ko"
    ? "벤트: 항해↔무기↔보호막 | 관리↔식당 | 전기↔보안↔의무 | 원자로↔상부↔하부"
    : lang === "ja"
    ? "ベント: ナビ↔武器↔シールド | アドミン↔カフェ | 電気↔セキュリティ↔医務 | 原子炉↔上↔下"
    : "Vents: Nav↔Weapons↔Shields | Admin↔Cafe | Elec↔Security↔Med | Reactor↔Upper↔Lower";

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0a1628] p-3">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🚀</span>
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

      {/* SVG Map */}
      <svg viewBox="0 0 1000 570" className="w-full" style={{ minHeight: "320px" }}>
        {/* Hallway lines */}
        {CONNECTIONS.map(([a, b], i) => {
          const ra = roomCenter(a);
          const rb = roomCenter(b);
          return (
            <line
              key={`h-${i}`}
              x1={ra.cx} y1={ra.cy} x2={rb.cx} y2={rb.cy}
              stroke="#1a2744"
              strokeWidth={8}
              strokeLinecap="round"
            />
          );
        })}

        {/* Vent lines */}
        {VENTS.map(([a, b], i) => {
          const ra = roomCenter(a);
          const rb = roomCenter(b);
          return (
            <line
              key={`v-${i}`}
              x1={ra.cx} y1={ra.cy} x2={rb.cx} y2={rb.cy}
              stroke="#dc2626"
              strokeWidth={1.5}
              strokeDasharray="6,8"
              opacity={0.25}
            />
          );
        })}

        {/* Room shapes */}
        {ROOMS.map((room) => {
          const players = playersByRoom[room.id] ?? [];
          const hasPlayers = players.length > 0;
          const roomName = room.names[lang] ?? room.names.en;

          return (
            <g key={room.id}>
              <RoomShape room={room} hasPlayers={hasPlayers} />

              {/* Room name */}
              <text
                x={room.cx}
                y={room.cy - (hasPlayers ? room.h / 2 - 18 : 4)}
                textAnchor="middle"
                fill={hasPlayers ? "#93c5fd" : "#475569"}
                fontSize={room.shape === "oct" ? 18 : 14}
                fontWeight="700"
              >
                {roomName}
              </text>

              {/* Player pills via foreignObject */}
              {hasPlayers && (() => {
                // Show max 3 pills, then "+N"
                const maxShow = 3;
                const visible = players.slice(0, maxShow);
                const extra = players.length - maxShow;

                return (
                  <foreignObject
                    x={room.cx - room.w / 2 + 4}
                    y={room.cy - room.h / 2 + 22}
                    width={room.w - 8}
                    height={room.h - 10}
                    style={{ overflow: "visible" }}
                  >
                    <div
                      xmlns="http://www.w3.org/1999/xhtml"
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "2px",
                        justifyContent: "center",
                        alignItems: "flex-start",
                      }}
                    >
                      {visible.map((p, i) => (
                        <span
                          key={i}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            padding: "1px 5px",
                            borderRadius: "9999px",
                            fontSize: "9px",
                            fontWeight: 600,
                            lineHeight: "14px",
                            backgroundColor: p.isAlive ? p.color + "30" : "#1f2937",
                            border: `1.5px solid ${p.isAlive ? p.color : "#374151"}`,
                            color: p.isAlive ? "#fff" : "#6b7280",
                            textDecoration: p.isAlive ? "none" : "line-through",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span
                            style={{
                              width: "5px",
                              height: "5px",
                              borderRadius: "50%",
                              backgroundColor: p.isAlive ? p.color : "#4b5563",
                              flexShrink: 0,
                            }}
                          />
                          {p.nickname}
                        </span>
                      ))}
                      {extra > 0 && (
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            color: "#a78bfa",
                            lineHeight: "14px",
                            padding: "1px 4px",
                          }}
                        >
                          +{extra}
                        </span>
                      )}
                    </div>
                  </foreignObject>
                );
              })()}

              {/* Count badge — inside top-right corner */}
              {hasPlayers && (
                <g transform={`translate(${room.cx + room.w / 2 - 16}, ${room.cy - room.h / 2 + 14})`}>
                  <circle r={10} fill="#7c3aed" stroke="#a78bfa" strokeWidth={1.5} />
                  <text textAnchor="middle" y={4} fill="white" fontSize="11" fontWeight="bold">
                    {players.length}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Vent info */}
      <div className="mt-2 text-[10px] text-gray-600 text-center">
        🔴 {ventLabel}
      </div>
    </div>
  );
}
