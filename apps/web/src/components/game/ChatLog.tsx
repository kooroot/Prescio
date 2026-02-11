import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ChatMessage } from "@prescio/common";

interface ChatLogProps {
  messages: ChatMessage[];
}

// Stable color palette for player avatars
const AVATAR_COLORS = [
  "bg-impostor",
  "bg-crew",
  "bg-alive",
  "bg-yellow-600",
  "bg-monad-purple",
  "bg-[#9B87FF]",
  "bg-cyan-600",
  "bg-orange-600",
  "bg-lime-600",
  "bg-teal-600",
];

function getPlayerColor(playerId: string): string {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = (hash * 31 + playerId.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ChatLog({ messages }: ChatLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll disabled
  // useEffect(() => {
  //   bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  // }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        <div className="text-center">
          <span className="text-4xl">💬</span>
          <p className="mt-2 text-sm">Waiting for discussion to begin...</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-1 p-3">
        {messages.map((msg) =>
          msg.isSystem ? (
            <SystemMessage key={msg.id} message={msg} />
          ) : (
            <PlayerMessage key={msg.id} message={msg} />
          ),
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

function SystemMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-center py-1.5">
      <span className="rounded-full bg-monad-card/80 px-4 py-1 text-xs text-gray-400 italic">
        {message.content}
      </span>
    </div>
  );
}

function PlayerMessage({ message }: { message: ChatMessage }) {
  const color = getPlayerColor(message.playerId);

  return (
    <div className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.03] transition-colors">
      <Avatar className={`h-8 w-8 shrink-0 ${color}`}>
        <AvatarFallback className={`${color} text-white text-xs font-bold`}>
          {getInitials(message.playerNickname)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-gray-200 truncate">
            {message.playerNickname}
          </span>
          <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTime(message.timestamp)}
          </span>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed break-words">
          {message.content}
        </p>
      </div>
    </div>
  );
}
