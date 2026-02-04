/**
 * The Skeld Map — CSS Grid layout matching actual Among Us map
 */
import { useQuery } from "@tanstack/react-query";
import { Room } from "@prescio/common";
import { cn } from "@/lib/utils";
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
  names: Record<string, string>; // lang → name
  gridArea: string;
  accent: string;
  bg: string;
}

const ROOM_CONFIG: RoomConfig[] = [
  { id: Room.UPPER_ENGINE, names: { ko: "상부 엔진", en: "Upper Engine", ja: "上部エンジン", zh: "上引擎" }, gridArea: "ue", accent: "border-blue-500", bg: "from-blue-900/40 to-blue-950/60" },
  { id: Room.REACTOR, names: { ko: "원자로", en: "Reactor", ja: "原子炉", zh: "反应堆" }, gridArea: "re", accent: "border-red-500", bg: "from-red-900/40 to-red-950/60" },
  { id: Room.SECURITY, names: { ko: "보안실", en: "Security", ja: "セキュリティ", zh: "监控室" }, gridArea: "se", accent: "border-green-500", bg: "from-green-900/40 to-green-950/60" },
  { id: Room.MEDBAY, names: { ko: "의무실", en: "MedBay", ja: "医務室", zh: "医疗室" }, gridArea: "mb", accent: "border-cyan-500", bg: "from-cyan-900/40 to-cyan-950/60" },
  { id: Room.CAFETERIA, names: { ko: "식당", en: "Cafeteria", ja: "カフェテリア", zh: "餐厅" }, gridArea: "ca", accent: "border-purple-500", bg: "from-purple-900/40 to-purple-950/60" },
  { id: Room.WEAPONS, names: { ko: "무기고", en: "Weapons", ja: "武器庫", zh: "武器室" }, gridArea: "we", accent: "border-rose-500", bg: "from-rose-900/40 to-rose-950/60" },
  { id: Room.O2, names: { ko: "산소공급실", en: "O2", ja: "O2", zh: "氧气室" }, gridArea: "o2", accent: "border-emerald-500", bg: "from-emerald-900/40 to-emerald-950/60" },
  { id: Room.NAVIGATION, names: { ko: "항해실", en: "Navigation", ja: "ナビゲーション", zh: "导航室" }, gridArea: "na", accent: "border-sky-500", bg: "from-sky-900/40 to-sky-950/60" },
  { id: Room.ADMIN, names: { ko: "관리실", en: "Admin", ja: "アドミン", zh: "管理室" }, gridArea: "ad", accent: "border-amber-500", bg: "from-amber-900/40 to-amber-950/60" },
  { id: Room.STORAGE, names: { ko: "창고", en: "Storage", ja: "倉庫", zh: "仓库" }, gridArea: "st", accent: "border-slate-500", bg: "from-slate-800/40 to-slate-900/60" },
  { id: Room.ELECTRICAL, names: { ko: "전기실", en: "Electrical", ja: "電気室", zh: "电气室" }, gridArea: "el", accent: "border-yellow-500", bg: "from-yellow-900/40 to-yellow-950/60" },
  { id: Room.LOWER_ENGINE, names: { ko: "하부 엔진", en: "Lower Engine", ja: "下部エンジン", zh: "下引擎" }, gridArea: "le", accent: "border-blue-500", bg: "from-blue-900/40 to-blue-950/60" },
  { id: Room.COMMUNICATIONS, names: { ko: "통신실", en: "Comms", ja: "通信室", zh: "通讯室" }, gridArea: "co", accent: "border-violet-500", bg: "from-violet-900/40 to-violet-950/60" },
  { id: Room.SHIELDS, names: { ko: "보호막", en: "Shields", ja: "シールド", zh: "护盾" }, gridArea: "sh", accent: "border-orange-500", bg: "from-orange-900/40 to-orange-950/60" },
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
  lang,
}: {
  room: RoomConfig;
  players: PlayerInfo[];
  hasPlayers: boolean;
  lang: string;
}) {
  const roomName = room.names[lang] ?? room.names.en;

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
          {roomName}
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

  const { lang } = useI18n();

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
            lang={lang}
          />
        ))}
      </div>

      {/* Vent info (compact) */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-600">
        {lang === "ko" ? (
          <span>🔴 벤트: 항해실↔무기고↔보호막 | 관리실↔식당 | 전기실↔보안실↔의무실 | 원자로↔상부엔진↔하부엔진</span>
        ) : lang === "ja" ? (
          <span>🔴 ベント: ナビ↔武器↔シールド | アドミン↔カフェ | 電気↔セキュリティ↔医務 | 原子炉↔上エンジン↔下エンジン</span>
        ) : lang === "zh" ? (
          <span>🔴 通风管: 导航↔武器↔护盾 | 管理↔餐厅 | 电气↔监控↔医疗 | 反应堆↔上引擎↔下引擎</span>
        ) : (
          <span>🔴 Vents: Nav↔Weapons↔Shields | Admin↔Cafe | Elec↔Security↔MedBay | Reactor↔Upper↔Lower</span>
        )}
      </div>
    </div>
  );
}
