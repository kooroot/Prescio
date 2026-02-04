/**
 * The Skeld Map — SVG background + HTML overlay for players
 * SVG: room shapes, connections (visual map)
 * HTML: player pills positioned absolutely over rooms (no overflow issues)
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

const PLAYER_COLORS = [
  "#ef4444", "#3b82f6", "#22c55e", "#eab308",
  "#a855f7", "#ec4899", "#14b8a6", "#f97316",
  "#6366f1", "#84cc16",
];

// Room positions as % of container (responsive)
interface RoomDef {
  id: Room;
  names: Record<string, string>;
  // Position as % of container
  left: number;
  top: number;
  // Base size as % of container
  w: number;
  h: number;
  shape: "oct" | "hex" | "rect";
}

const ROOMS: RoomDef[] = [
  { id: Room.UPPER_ENGINE,   names: { ko: "상부 엔진", en: "Upper Eng", ja: "上エンジン", zh: "上引擎" },      left: 2,  top: 2,   w: 14, h: 16, shape: "rect" },
  { id: Room.MEDBAY,         names: { ko: "의무실", en: "MedBay", ja: "医務室", zh: "医疗室" },                 left: 20, top: 8,   w: 14, h: 14, shape: "rect" },
  { id: Room.CAFETERIA,      names: { ko: "식당", en: "Cafeteria", ja: "カフェテリア", zh: "餐厅" },            left: 36, top: 0,   w: 18, h: 20, shape: "oct" },
  { id: Room.WEAPONS,        names: { ko: "무기고", en: "Weapons", ja: "武器庫", zh: "武器室" },                left: 62, top: 0,   w: 14, h: 14, shape: "hex" },
  { id: Room.NAVIGATION,     names: { ko: "항해실", en: "Navigation", ja: "ナビ", zh: "导航室" },               left: 82, top: 18,  w: 16, h: 16, shape: "hex" },
  { id: Room.O2,             names: { ko: "산소공급실", en: "O2", ja: "O2", zh: "氧气室" },                     left: 56, top: 18,  w: 15, h: 14, shape: "rect" },
  { id: Room.REACTOR,        names: { ko: "원자로", en: "Reactor", ja: "原子炉", zh: "反应堆" },                left: 0,  top: 30,  w: 14, h: 18, shape: "rect" },
  { id: Room.SECURITY,       names: { ko: "보안실", en: "Security", ja: "セキュリティ", zh: "监控室" },          left: 18, top: 32,  w: 13, h: 13, shape: "rect" },
  { id: Room.ADMIN,          names: { ko: "관리실", en: "Admin", ja: "アドミン", zh: "管理室" },                 left: 46, top: 36,  w: 15, h: 14, shape: "rect" },
  { id: Room.LOWER_ENGINE,   names: { ko: "하부 엔진", en: "Lower Eng", ja: "下エンジン", zh: "下引擎" },        left: 2,  top: 58,  w: 14, h: 16, shape: "rect" },
  { id: Room.ELECTRICAL,     names: { ko: "전기실", en: "Electrical", ja: "電気室", zh: "电气室" },              left: 20, top: 55,  w: 15, h: 16, shape: "rect" },
  { id: Room.STORAGE,        names: { ko: "창고", en: "Storage", ja: "倉庫", zh: "仓库" },                      left: 37, top: 54,  w: 18, h: 20, shape: "rect" },
  { id: Room.COMMUNICATIONS, names: { ko: "통신실", en: "Comms", ja: "通信室", zh: "通讯室" },                  left: 57, top: 64,  w: 14, h: 13, shape: "rect" },
  { id: Room.SHIELDS,        names: { ko: "보호막", en: "Shields", ja: "シールド", zh: "护盾" },                 left: 76, top: 54,  w: 15, h: 16, shape: "rect" },
];

// Connections for SVG lines
const CONNECTIONS: Array<[Room, Room]> = [
  [Room.CAFETERIA, Room.WEAPONS], [Room.CAFETERIA, Room.UPPER_ENGINE],
  [Room.CAFETERIA, Room.MEDBAY], [Room.CAFETERIA, Room.ADMIN],
  [Room.CAFETERIA, Room.STORAGE], [Room.WEAPONS, Room.NAVIGATION],
  [Room.WEAPONS, Room.O2], [Room.O2, Room.NAVIGATION],
  [Room.O2, Room.SHIELDS], [Room.O2, Room.CAFETERIA],
  [Room.NAVIGATION, Room.SHIELDS], [Room.SHIELDS, Room.COMMUNICATIONS],
  [Room.SHIELDS, Room.STORAGE], [Room.COMMUNICATIONS, Room.STORAGE],
  [Room.ADMIN, Room.STORAGE], [Room.STORAGE, Room.ELECTRICAL],
  [Room.STORAGE, Room.LOWER_ENGINE], [Room.ELECTRICAL, Room.LOWER_ENGINE],
  [Room.LOWER_ENGINE, Room.REACTOR], [Room.LOWER_ENGINE, Room.SECURITY],
  [Room.SECURITY, Room.REACTOR], [Room.SECURITY, Room.UPPER_ENGINE],
  [Room.REACTOR, Room.UPPER_ENGINE], [Room.UPPER_ENGINE, Room.MEDBAY],
];

const VENTS: Array<[Room, Room]> = [
  [Room.NAVIGATION, Room.WEAPONS], [Room.WEAPONS, Room.SHIELDS],
  [Room.NAVIGATION, Room.SHIELDS], [Room.ADMIN, Room.CAFETERIA],
  [Room.ELECTRICAL, Room.SECURITY], [Room.SECURITY, Room.MEDBAY],
  [Room.ELECTRICAL, Room.MEDBAY], [Room.REACTOR, Room.UPPER_ENGINE],
  [Room.UPPER_ENGINE, Room.LOWER_ENGINE], [Room.REACTOR, Room.LOWER_ENGINE],
];

interface PlayerInfo {
  nickname: string;
  isAlive: boolean;
  color: string;
}

function getRoomCenter(id: Room): [number, number] {
  const r = ROOMS.find((r) => r.id === id)!;
  return [r.left + r.w / 2, r.top + r.h / 2];
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

  const colorMap: Record<string, string> = {};
  [...new Set(locations.map((l) => l.playerId))].forEach((pid, i) => {
    colorMap[pid] = PLAYER_COLORS[i % PLAYER_COLORS.length];
  });

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
    : "Vents: Nav↔Weapons↔Shields | Admin↔Cafe | Elec↔Security↔Med | Reactor↔Upper↔Lower";

  return (
    <div
      className="rounded-xl p-3"
      style={{ background: "linear-gradient(180deg, #0a1628, #0d1f3c)", border: "1px solid #1e3a5f" }}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🚀</span>
          <span className="text-sm font-bold text-white tracking-wider">THE SKELD</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Tasks {data.completedTasks ?? 0}/{data.totalTasks ?? 0}</span>
          <div className="h-2 w-28 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Map container */}
      <div className="relative" style={{ paddingBottom: "42%" }}>
        {/* SVG background: connections — viewBox matches % coordinate space */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ zIndex: 0 }}
        >
          {CONNECTIONS.map(([a, b], i) => {
            const [x1, y1] = getRoomCenter(a);
            const [x2, y2] = getRoomCenter(b);
            return (
              <line key={`c-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#1a2744" strokeWidth={1.2} strokeLinecap="round" />
            );
          })}
          {VENTS.map(([a, b], i) => {
            const [x1, y1] = getRoomCenter(a);
            const [x2, y2] = getRoomCenter(b);
            return (
              <line key={`v-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#dc2626" strokeWidth={0.5} strokeDasharray="1.5,2" opacity={0.3} />
            );
          })}
        </svg>

        {/* HTML room cards — absolutely positioned */}
        {ROOMS.map((room) => {
          const players = playersByRoom[room.id] ?? [];
          const hasPlayers = players.length > 0;
          const name = room.names[lang] ?? room.names.en;

          return (
            <div
              key={room.id}
              className="absolute rounded-lg p-1.5 flex flex-col transition-all duration-300"
              style={{
                left: `${room.left}%`,
                top: `${room.top}%`,
                minWidth: `${room.w}%`,
                minHeight: `${room.h}%`,
                zIndex: hasPlayers ? 10 : 1,
                background: hasPlayers
                  ? "linear-gradient(135deg, rgba(30,58,95,0.9), rgba(22,40,70,0.95))"
                  : "linear-gradient(135deg, rgba(22,32,50,0.6), rgba(15,23,42,0.7))",
                border: hasPlayers ? "2px solid #3b82f6" : "1.5px solid #1e3a5f",
                boxShadow: hasPlayers
                  ? "0 0 16px rgba(59,130,246,0.25)"
                  : "none",
                borderRadius: room.shape === "oct" ? "12px" : room.shape === "hex" ? "8px 16px" : "6px",
              }}
            >
              {/* Room name + badge */}
              <div className="flex items-center justify-between mb-0.5" style={{ minHeight: "18px" }}>
                <span
                  className="font-bold tracking-wide"
                  style={{ fontSize: "11px", color: hasPlayers ? "#93c5fd" : "#475569" }}
                >
                  {name}
                </span>
                {hasPlayers && (
                  <span
                    className="flex items-center justify-center rounded-full text-white font-bold flex-shrink-0 ml-1"
                    style={{ width: "18px", height: "18px", fontSize: "10px", background: "#7c3aed" }}
                  >
                    {players.length}
                  </span>
                )}
              </div>

              {/* Player pills */}
              {hasPlayers && (
                <div className="flex flex-wrap gap-0.5">
                  {players.map((p, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full"
                      style={{
                        padding: "0px 5px 0px 4px",
                        fontSize: "9px",
                        fontWeight: 600,
                        lineHeight: "15px",
                        backgroundColor: p.isAlive ? p.color + "25" : "#1f2937",
                        border: `1.5px solid ${p.isAlive ? p.color : "#374151"}`,
                        color: p.isAlive ? "#fff" : "#6b7280",
                        textDecoration: p.isAlive ? "none" : "line-through",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span
                        style={{
                          width: "5px", height: "5px", borderRadius: "50%",
                          backgroundColor: p.isAlive ? p.color : "#4b5563",
                          flexShrink: 0,
                        }}
                      />
                      {p.nickname}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Vent info */}
      <div className="mt-2 text-[10px] text-center" style={{ color: "#4a5568" }}>
        🔴 {ventLabel}
      </div>
    </div>
  );
}
