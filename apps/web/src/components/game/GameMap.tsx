/**
 * The Skeld Map — CSS Grid with ship-like styling
 * Grid handles dynamic room sizing naturally (no overlap)
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

interface RoomConfig {
  id: Room;
  names: Record<string, string>;
  gridArea: string;
}

const ROOMS: RoomConfig[] = [
  { id: Room.UPPER_ENGINE,   names: { ko: "상부 엔진", en: "Upper Engine", ja: "上部エンジン", zh: "上引擎" }, gridArea: "ue" },
  { id: Room.REACTOR,        names: { ko: "원자로", en: "Reactor", ja: "原子炉", zh: "反应堆" }, gridArea: "re" },
  { id: Room.SECURITY,       names: { ko: "보안실", en: "Security", ja: "セキュリティ", zh: "监控室" }, gridArea: "se" },
  { id: Room.MEDBAY,         names: { ko: "의무실", en: "MedBay", ja: "医務室", zh: "医疗室" }, gridArea: "mb" },
  { id: Room.CAFETERIA,      names: { ko: "식당", en: "Cafeteria", ja: "カフェテリア", zh: "餐厅" }, gridArea: "ca" },
  { id: Room.WEAPONS,        names: { ko: "무기고", en: "Weapons", ja: "武器庫", zh: "武器室" }, gridArea: "we" },
  { id: Room.O2,             names: { ko: "산소공급실", en: "O2", ja: "O2", zh: "氧气室" }, gridArea: "o2" },
  { id: Room.NAVIGATION,     names: { ko: "항해실", en: "Navigation", ja: "ナビ", zh: "导航室" }, gridArea: "na" },
  { id: Room.ADMIN,          names: { ko: "관리실", en: "Admin", ja: "アドミン", zh: "管理室" }, gridArea: "ad" },
  { id: Room.STORAGE,        names: { ko: "창고", en: "Storage", ja: "倉庫", zh: "仓库" }, gridArea: "st" },
  { id: Room.ELECTRICAL,     names: { ko: "전기실", en: "Electrical", ja: "電気室", zh: "电气室" }, gridArea: "el" },
  { id: Room.LOWER_ENGINE,   names: { ko: "하부 엔진", en: "Lower Engine", ja: "下エンジン", zh: "下引擎" }, gridArea: "le" },
  { id: Room.COMMUNICATIONS, names: { ko: "통신실", en: "Comms", ja: "通信室", zh: "通讯室" }, gridArea: "co" },
  { id: Room.SHIELDS,        names: { ko: "보호막", en: "Shields", ja: "シールド", zh: "护盾" }, gridArea: "sh" },
];

interface PlayerInfo {
  nickname: string;
  isAlive: boolean;
  color: string;
}

function RoomCard({ room, players, lang }: { room: RoomConfig; players: PlayerInfo[]; lang: string }) {
  const hasPlayers = players.length > 0;
  const name = room.names[lang] ?? room.names.en;

  return (
    <div
      className="relative rounded-lg p-2 min-h-[52px] flex flex-col transition-all duration-300"
      style={{
        gridArea: room.gridArea,
        background: hasPlayers
          ? "linear-gradient(135deg, rgba(30,58,95,0.8), rgba(22,32,50,0.9))"
          : "linear-gradient(135deg, rgba(22,32,50,0.5), rgba(15,23,42,0.6))",
        border: hasPlayers ? "2px solid #3b82f6" : "1.5px solid #1e3a5f",
        boxShadow: hasPlayers ? "0 0 12px rgba(59,130,246,0.2), inset 0 1px 0 rgba(255,255,255,0.05)" : "none",
      }}
    >
      {/* Room name + count */}
      <div className="flex items-center justify-between mb-1">
        <span
          className="font-bold tracking-wide"
          style={{
            fontSize: "12px",
            color: hasPlayers ? "#93c5fd" : "#475569",
          }}
        >
          {name}
        </span>
        {hasPlayers && (
          <span
            className="flex items-center justify-center rounded-full text-white font-bold"
            style={{
              width: "20px",
              height: "20px",
              fontSize: "11px",
              background: "#7c3aed",
            }}
          >
            {players.length}
          </span>
        )}
      </div>

      {/* Player pills */}
      {hasPlayers && (
        <div className="flex flex-wrap gap-1 mt-auto">
          {players.map((p, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full"
              style={{
                padding: "1px 7px 1px 5px",
                fontSize: "10px",
                fontWeight: 600,
                lineHeight: "16px",
                backgroundColor: p.isAlive ? p.color + "25" : "#1f2937",
                border: `1.5px solid ${p.isAlive ? p.color : "#374151"}`,
                color: p.isAlive ? "#fff" : "#6b7280",
                textDecoration: p.isAlive ? "none" : "line-through",
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
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
    <div
      className="rounded-xl p-3"
      style={{
        background: "linear-gradient(180deg, #0a1628 0%, #0d1f3c 100%)",
        border: "1px solid #1e3a5f",
      }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
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

      {/* Map Grid
        The Skeld layout (5 rows × 6 cols):
        Row 1: Upper Eng  | .        | MedBay   | Cafeteria | Weapons    | .
        Row 2: Reactor    | Security | .        | O2        | .          | Navigation
        Row 3: .          | .        | .        | Admin     | .          | .
        Row 4: Lower Eng  | Electrical | Storage | Storage  | Comms      | Shields
      */}
      <div
        className="gap-1.5"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1.3fr 1fr 1fr",
          gridTemplateAreas: `
            "ue  .   mb  ca  we  .  "
            "re  se  .   o2  .   na "
            ".   .   .   ad  .   .  "
            "le  el  st  st  co  sh "
          `,
        }}
      >
        {ROOMS.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            players={playersByRoom[room.id] ?? []}
            lang={lang}
          />
        ))}
      </div>

      {/* Vent info */}
      <div className="mt-2 text-[10px] text-center" style={{ color: "#4a5568" }}>
        🔴 {ventLabel}
      </div>
    </div>
  );
}
