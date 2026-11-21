import 'dotenv/config';
import express from 'express';
import { createServer as createHttpServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import type {
  BotPostGameThought,
  ChatMessage,
  DayVoteChoice,
  DayVoteKind,
  DeathCause,
  Faction,
  GamePhase,
  HotelColumnNumber,
  HotelFloorNumber,
  HotelRoomNumber,
  MorningReport,
  PrivateClueLog,
  PrivatePlayerIntel,
  PublicPlayer,
  RevealedRoomInfo,
  RoleId,
  RoomStatePayload,
  SceneAnimationPayload,
  SecretChatMessage,
  SecretTargetPing,
  VoteResolution,
} from './src/shared/gameTypes.ts';
import {
  formatDayVoteLabel,
  getColumnOfRoom,
  getFloorOfRoom,
  getMaxDaysForPlayerCount,
  getRoleDistribution,
  getRoomsInColumn,
  getRoomsOnFloor,
  HOTEL_COLUMNS,
  HOTEL_FLOORS,
  HOTEL_ROOMS,
  ROLE_DEFINITIONS,
  serializeDayVote,
} from './src/shared/gameTypes.ts';
import type { BotProfile, FogBotContextPlayer } from './server/aiProvider.ts';
import {
  BOT_POOL,
  decideBotDayVote,
  decideBotNightAction,
  generateAccompliceSecretPing,
  generateBotChat,
  generatePostGameThoughts,
} from './server/aiProvider.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const SETUP_DURATION_MS = 4000;
const VOTE_DURATION_MS = 65000;
const VOTE_RESULT_DURATION_MS = 5000;
const NIGHT_DURATION_MS = 28000;

const HUMAN_AVATAR_COLORS = [
  '#C8A25A',
  '#B84A39',
  '#4F7CAC',
  '#5A9367',
  '#9C528B',
  '#C47D3B',
  '#3F888F',
  '#8A5A44',
];

interface ServerPlayer {
  id: string;
  socketId: string | null;
  name: string;
  isBot: boolean;
  isHost: boolean;
  connected: boolean;
  alive: boolean;
  role: RoleId | null;
  room: HotelRoomNumber | null; // FIXED permanent room for entire game
  readyToVote: boolean;
  dayVote: DayVoteChoice | null;
  deathCause: DeathCause;
  deathDay: number | null;
  deathRoom: HotelRoomNumber | null;
  revealedRole: RoleId | null;
  avatarColor: string;
  botProfile?: BotProfile;
  clueLogs: PrivateClueLog[];
  checkedPlayerIds: string[];
}

interface NightSubmissions {
  murdererRoom: HotelRoomNumber | null;
  keymasterRoom: HotelRoomNumber | null;
  housekeeperFloor: HotelFloorNumber | null;
  glazierColumn: HotelColumnNumber | null;
  detectiveTargetId: string | null;
  accompliceTargetId: string | null;
  witnessWatchFloor: HotelFloorNumber | null;
  submittedPlayerIds: Set<string>;
}

interface GameRoom {
  roomCode: string;
  phase: GamePhase;
  day: number;
  maxDays: number;
  maxPlayers: number;
  phaseEndsAt: number | null;
  revealedRooms: Map<HotelRoomNumber, RevealedRoomInfo>;
  lockedFloors: Set<HotelFloorNumber>;
  lockedColumns: Set<HotelColumnNumber>;
  players: Map<string, ServerPlayer>;
  chat: ChatMessage[];
  secretChat: SecretChatMessage[];
  secretPing: SecretTargetPing | null;
  historyLog: string[];
  morningReport: MorningReport | null;
  voteResolution: VoteResolution | null;
  winner: Faction | null;
  winnerPlayerName: string | null;
  winReason: string | null;
  aiThoughts: BotPostGameThought[];
  aiThoughtsLoading: boolean;
  lastKeymasterLockedRoom: HotelRoomNumber | null;
  night: NightSubmissions;
  timers: Set<ReturnType<typeof setTimeout>>;
  lastHumanReplyAt: number;
  botChatterCountThisPhase: number;
  createdAt: number;
}

const rooms = new Map<string, GameRoom>();
const socketToMembership = new Map<string, { roomCode: string; playerId: string }>();

function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function scheduleRoomTimer(room: GameRoom, fn: () => void, delayMs: number): void {
  const handle = setTimeout(() => {
    room.timers.delete(handle);
    if (!rooms.has(room.roomCode)) return;
    fn();
  }, delayMs);
  room.timers.add(handle);
}

function clearRoomTimers(room: GameRoom): void {
  for (const t of room.timers) {
    clearTimeout(t);
  }
  room.timers.clear();
}

function freshNightSubmissions(): NightSubmissions {
  return {
    murdererRoom: null,
    keymasterRoom: null,
    housekeeperFloor: null,
    glazierColumn: null,
    detectiveTargetId: null,
    accompliceTargetId: null,
    witnessWatchFloor: null,
    submittedPlayerIds: new Set<string>(),
  };
}

function getAlivePlayers(room: GameRoom): ServerPlayer[] {
  return Array.from(room.players.values()).filter((p) => p.alive);
}

function getUnrevealedRooms(room: GameRoom): HotelRoomNumber[] {
  return HOTEL_ROOMS.filter((r) => !room.revealedRooms.has(r));
}

function getVotableFloors(room: GameRoom): HotelFloorNumber[] {
  if (room.day < 2) return [];
  return HOTEL_FLOORS.filter(
    (f) => !room.lockedFloors.has(f) && getRoomsOnFloor(f).some((r) => !room.revealedRooms.has(r))
  );
}

function getVotableColumns(room: GameRoom): HotelColumnNumber[] {
  if (room.day < 2) return [];
  return HOTEL_COLUMNS.filter(
    (c) => !room.lockedColumns.has(c) && getRoomsInColumn(c).some((r) => !room.revealedRooms.has(r))
  );
}

function getRequiredNightActors(room: GameRoom): ServerPlayer[] {
  return getAlivePlayers(room).filter(
    (p) => p.role !== null && ROLE_DEFINITIONS[p.role].hasNightAction
  );
}

function toFogBotContextPlayers(room: GameRoom): FogBotContextPlayer[] {
  return Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    alive: p.alive,
    isBot: p.isBot,
  }));
}

/**
 * STRICT FOG OF WAR:
 * Never leaks any living player's fixed room, floor, column, or secret role!
 */
function buildPublicRoomState(room: GameRoom): RoomStatePayload {
  const allPlayers = Array.from(room.players.values());
  const alivePlayers = allPlayers.filter((p) => p.alive);
  const readyCount = alivePlayers.filter((p) => p.readyToVote).length;
  const votedCount = alivePlayers.filter((p) => p.dayVote !== null).length;
  const requiredNightActors = getRequiredNightActors(room);
  const submittedNightCount = requiredNightActors.filter((p) =>
    room.night.submittedPlayerIds.has(p.id)
  ).length;

  const publicPlayers: PublicPlayer[] = allPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    isHost: p.isHost,
    connected: p.connected,
    alive: p.alive,
    readyToVote: p.readyToVote,
    hasVotedRoom: p.dayVote !== null,
    votedSummary:
      (room.phase === 'VOTE_RESULT' || room.phase === 'GAME_OVER') && p.dayVote
        ? formatDayVoteLabel(serializeDayVote(p.dayVote))
        : null,
    deathCause: p.deathCause,
    deathDay: p.deathDay,
    deathRoom: p.deathRoom,
    revealedRole: room.phase === 'GAME_OVER' ? p.role : p.revealedRole,
    finalRoom: room.phase === 'GAME_OVER' ? p.room : null,
    avatarColor: p.avatarColor,
  }));

  return {
    roomCode: room.roomCode,
    phase: room.phase,
    day: room.day,
    maxDays: room.maxDays,
    maxPlayers: room.maxPlayers,
    phaseEndsAt: room.phaseEndsAt,
    revealedRooms: Array.from(room.revealedRooms.values()),
    lockedFloors: Array.from(room.lockedFloors),
    lockedColumns: Array.from(room.lockedColumns),
    players: publicPlayers,
    chat: room.chat.slice(-85),
    morningReport: room.morningReport,
    voteResolution: room.voteResolution,
    winner: room.winner,
    winnerPlayerName: room.winnerPlayerName,
    winReason: room.winReason,
    aiThoughts: room.aiThoughts,
    aiThoughtsLoading: room.aiThoughtsLoading,
    readyCount,
    aliveCount: alivePlayers.length,
    votedCount,
    nightActionsSubmittedCount: submittedNightCount,
    nightActionsRequiredCount: requiredNightActors.length,
  };
}

function buildPrivateIntel(room: GameRoom, player: ServerPlayer): PrivatePlayerIntel {
  const role = player.role;
  const faction = role ? ROLE_DEFINITIONS[role].faction : null;
  const isEvil = faction === 'EVIL';

  const evilPartners = isEvil
    ? Array.from(room.players.values())
        .filter(
          (other) =>
            other.id !== player.id &&
            other.role !== null &&
            ROLE_DEFINITIONS[other.role].faction === 'EVIL'
        )
        .map((other) => ({
          id: other.id,
          name: other.name,
          role: other.role as RoleId,
        }))
    : [];

  let selectedNightTarget: number | string | null = null;
  if (room.phase === 'NIGHT' && role) {
    if (role === 'MURDERER') selectedNightTarget = room.night.murdererRoom;
    if (role === 'KEYMASTER') selectedNightTarget = room.night.keymasterRoom;
    if (role === 'HOUSEKEEPER') selectedNightTarget = room.night.housekeeperFloor;
    if (role === 'GLAZIER') selectedNightTarget = room.night.glazierColumn;
    if (role === 'DETECTIVE') selectedNightTarget = room.night.detectiveTargetId;
    if (role === 'ACCOMPLICE') selectedNightTarget = room.night.accompliceTargetId;
    if (role === 'WITNESS') selectedNightTarget = room.night.witnessWatchFloor;
  }

  return {
    playerId: player.id,
    role,
    faction,
    myRoom: player.room,
    myFloor: player.room ? getFloorOfRoom(player.room) : null,
    myColumn: player.room ? getColumnOfRoom(player.room) : null,
    evilPartners,
    nightActionSubmitted: room.night.submittedPlayerIds.has(player.id),
    selectedNightTarget,
    lastKeymasterLockedRoom: role === 'KEYMASTER' ? room.lastKeymasterLockedRoom : null,
    myDayVote: player.dayVote,
    secretChat: isEvil ? room.secretChat.slice(-40) : [],
    secretPing: isEvil && room.phase === 'NIGHT' ? room.secretPing : null,
    clueLogs: player.clueLogs.slice(-24),
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      activeRooms: rooms.size,
      providers: {
        groq: Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'YOUR_GROQ_API_KEY'),
        gemini: Boolean(
          process.env.GEMINI_API_KEY &&
            process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
            process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY'
        ),
      },
    });
  });

  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    pingInterval: 20000,
    pingTimeout: 25000,
  });

  function emitPrivateIntel(room: GameRoom, player: ServerPlayer): void {
    if (!player.isBot && player.socketId) {
      io.to(player.socketId).emit('player:intel', buildPrivateIntel(room, player));
    }
  }

  function broadcastRoomState(room: GameRoom): void {
    const publicState = buildPublicRoomState(room);
    io.to(room.roomCode).emit('room:state', publicState);
    for (const p of room.players.values()) {
      emitPrivateIntel(room, p);
    }
  }

  function emitSceneToPlayer(player: ServerPlayer, payload: SceneAnimationPayload): void {
    if (!player.isBot && player.socketId) {
      io.to(player.socketId).emit('scene:trigger', payload);
    }
  }

  function emitSceneToRoom(room: GameRoom, payload: SceneAnimationPayload): void {
    io.to(room.roomCode).emit('scene:trigger', payload);
  }

  function pushChat(
    room: GameRoom,
    msg: Omit<ChatMessage, 'id' | 'timestamp' | 'phase' | 'day'>
  ): ChatMessage {
    const entry: ChatMessage = {
      ...msg,
      id: uid('msg'),
      phase: room.phase,
      day: room.day,
      timestamp: Date.now(),
    };
    room.chat.push(entry);
    if (room.chat.length > 150) {
      room.chat = room.chat.slice(-120);
    }
    io.to(room.roomCode).emit('chat:message', entry);
    return entry;
  }

  function pushSecretEvilChat(room: GameRoom, sender: ServerPlayer, text: string): void {
    const entry: SecretChatMessage = {
      id: uid('smsg'),
      senderId: sender.id,
      senderName: sender.name,
      isBot: sender.isBot,
      text,
      timestamp: Date.now(),
    };
    room.secretChat.push(entry);
    if (room.secretChat.length > 60) {
      room.secretChat = room.secretChat.slice(-50);
    }
    for (const p of room.players.values()) {
      if (!p.isBot && p.socketId && p.role && ROLE_DEFINITIONS[p.role].faction === 'EVIL') {
        io.to(p.socketId).emit('secretChat:message', entry);
      }
    }
  }

  function broadcastSecretPing(room: GameRoom, ping: SecretTargetPing): void {
    room.secretPing = ping;
    for (const p of room.players.values()) {
      if (!p.isBot && p.socketId && p.role && ROLE_DEFINITIONS[p.role].faction === 'EVIL') {
        io.to(p.socketId).emit('night:pingUpdate', ping);
      }
    }
  }

  function checkStandardWinCondition(
    room: GameRoom
  ): { winner: Faction; winnerPlayerName: string | null; reason: string } | null {
    const alive = getAlivePlayers(room);
    const murderer = Array.from(room.players.values()).find((p) => p.role === 'MURDERER');

    if (murderer && !murderer.alive) {
      return {
        winner: 'GOOD',
        winnerPlayerName: null,
        reason: `ฝ่ายผู้บริสุทธิ์โหวตเจอห้องฆาตกร (${murderer.name} · ห้อง ${murderer.room}) สำเร็จภายในวันที่ ${room.day}!`,
      };
    }

    const aliveEvil = alive.filter(
      (p) => p.role !== null && ROLE_DEFINITIONS[p.role].faction === 'EVIL'
    ).length;
    const aliveGood = alive.filter(
      (p) => p.role !== null && ROLE_DEFINITIONS[p.role].faction === 'GOOD'
    ).length;

    if (aliveEvil >= aliveGood && aliveEvil > 0) {
      return {
        winner: 'EVIL',
        winnerPlayerName: null,
        reason: `ฝ่ายฆาตกรกำจัดผู้บริสุทธิ์จนจำนวนคนดีเหลือเท่ากับฝ่ายฆาตกร (คนดี ${aliveGood} vs ฝ่ายฆาตกร ${aliveEvil})`,
      };
    }

    return null;
  }

  function enterGameOver(
    room: GameRoom,
    winner: Faction,
    reason: string,
    winnerPlayerName: string | null = null
  ): void {
    clearRoomTimers(room);
    room.phase = 'GAME_OVER';
    room.phaseEndsAt = null;
    room.winner = winner;
    room.winnerPlayerName = winnerPlayerName;
    room.winReason = reason;
    room.aiThoughts = [];
    room.aiThoughtsLoading = true;

    for (const p of room.players.values()) {
      p.revealedRole = p.role;
    }

    const bannerPrefix =
      winner === 'GOOD'
        ? 'ฝ่ายผู้บริสุทธิ์ชนะ!'
        : winner === 'EVIL'
          ? 'ฝ่ายฆาตกรชนะ!'
          : `คนเมา (${winnerPlayerName ?? 'Drunk'}) ชนะเพียงคนเดียว!`;

    room.historyLog.push(`จบเกม: ${bannerPrefix} — ${reason}`);
    pushChat(room, {
      senderId: 'SYSTEM',
      senderName: 'โรงแรมมรณะ',
      isSystem: true,
      isBot: false,
      text: `${bannerPrefix} ${reason}`,
      kind: 'ALERT',
    });

    broadcastRoomState(room);

    const snapshotPlayers = Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      role: p.role ?? 'KEYMASTER',
      room: p.room,
      alive: p.alive,
      persona: p.botProfile?.persona,
      deathCause: p.deathCause,
    }));

    void generatePostGameThoughts({
      winner,
      winnerPlayerName,
      winReason: reason,
      players: snapshotPlayers,
      historyLog: [...room.historyLog],
      recentChat: [...room.chat],
    }).then((thoughts) => {
      if (!rooms.has(room.roomCode) || room.phase !== 'GAME_OVER') return;
      room.aiThoughts = thoughts;
      room.aiThoughtsLoading = false;
      broadcastRoomState(room);
    });
  }

  async function triggerSingleBotChat(
    room: GameRoom,
    bot: ServerPlayer,
    triggerReason: 'PHASE_START' | 'HUMAN_REPLY' | 'PRE_READY',
    lastHumanMessage?: { senderName: string; text: string }
  ): Promise<void> {
    if (!rooms.has(room.roomCode)) return;
    if (!bot.alive || !bot.botProfile || !bot.role || !bot.room) return;
    if (room.phase !== 'DAY' && room.phase !== 'VOTE') return;

    const evilPartners =
      ROLE_DEFINITIONS[bot.role].faction === 'EVIL'
        ? Array.from(room.players.values())
            .filter(
              (p) =>
                p.id !== bot.id && p.role !== null && ROLE_DEFINITIONS[p.role].faction === 'EVIL'
            )
            .map((p) => p.name)
        : [];

    const { text } = await generateBotChat({
      bot: bot.botProfile,
      role: bot.role,
      myRoom: bot.room,
      myFloor: getFloorOfRoom(bot.room),
      myColumn: getColumnOfRoom(bot.room),
      phase: room.phase,
      day: room.day,
      maxDays: room.maxDays,
      revealedRooms: Array.from(room.revealedRooms.values()),
      lockedFloors: Array.from(room.lockedFloors),
      lockedColumns: Array.from(room.lockedColumns),
      players: toFogBotContextPlayers(room),
      recentChat: room.chat.slice(-12),
      morningHeadline: room.morningReport?.headline ?? null,
      evilPartners,
      privateClues: bot.clueLogs,
      triggerReason,
      lastHumanMessage,
    });

    if (!rooms.has(room.roomCode)) return;
    if (!bot.alive || (room.phase !== 'DAY' && room.phase !== 'VOTE')) return;

    pushChat(room, {
      senderId: bot.id,
      senderName: bot.name,
      isSystem: false,
      isBot: true,
      text,
      kind: 'CHAT',
    });
  }

  function checkAllReadyToVote(room: GameRoom): void {
    if (room.phase !== 'DAY') return;
    const alive = getAlivePlayers(room);
    if (alive.length > 0 && alive.every((p) => p.readyToVote)) {
      startRoomVotePhase(room);
    }
  }

  function accelerateBotsReadyIfHumansReady(room: GameRoom): void {
    if (room.phase !== 'DAY') return;
    const aliveHumans = getAlivePlayers(room).filter((p) => !p.isBot);
    const allHumansReady = aliveHumans.length > 0 && aliveHumans.every((h) => h.readyToVote);
    if (!allHumansReady) return;

    const unreadyBots = getAlivePlayers(room).filter((p) => p.isBot && !p.readyToVote);
    unreadyBots.forEach((bot, idx) => {
      scheduleRoomTimer(
        room,
        () => {
          if (room.phase !== 'DAY' || !bot.alive || bot.readyToVote) return;
          bot.readyToVote = true;
          broadcastRoomState(room);
          checkAllReadyToVote(room);
        },
        1200 + idx * 800 + Math.floor(Math.random() * 600)
      );
    });
  }

  /**
   * DAY PHASE: Discussion & Deduction (100% Ready Check -> transitions to Room Lynching Vote)
   * FIXED ROOM RULE: Nobody can move rooms!
   */
  function startDayPhase(room: GameRoom): void {
    clearRoomTimers(room);
    room.phase = 'DAY';
    room.phaseEndsAt = null;
    room.voteResolution = null;
    room.secretPing = null;
    room.botChatterCountThisPhase = 0;

    for (const p of room.players.values()) {
      p.readyToVote = false;
      p.dayVote = null;
    }

    if (room.day === 1) {
      const initialList = Array.from(room.revealedRooms.values())
        .filter((r) => r.kind === 'INITIAL_CRIME')
        .map((r) => r.room)
        .sort((a, b) => a - b)
        .join(', ');
      pushChat(room, {
        senderId: 'SYSTEM',
        senderName: 'โรงแรมมรณะ',
        isSystem: true,
        isBot: false,
        text: `เข้าสู่วันที่ 1/${room.maxDays} — พบศพตั้งต้นในห้องว่าง 3 ห้อง (${initialList})! วันแรกโหวตได้เฉพาะ "เปิดรายห้อง" ส่วนโหวตปิดตายทั้งชั้น/ทั้งแถวจะปลดล็อกตั้งแต่วันที่ 2 หลังได้เบาะแสจากแม่บ้านและช่างเช็ดกระจก!`,
        kind: 'ALERT',
      });
    } else if (room.morningReport) {
      pushChat(room, {
        senderId: 'SYSTEM',
        senderName: `ข่าวด่วนยามเช้า วันที่ ${room.day}/${room.maxDays}`,
        isSystem: true,
        isBot: false,
        text: `${room.morningReport.headline} — ${room.morningReport.subtext}`,
        kind: room.morningReport.victimId ? 'DEATH' : 'ALERT',
      });
    }

    broadcastRoomState(room);

    const aliveBots = shuffle(getAlivePlayers(room).filter((p) => p.isBot));

    // Initial wave of 3 bot deductions/bluffs
    const openingSpeakers = aliveBots.slice(0, Math.min(3, aliveBots.length));
    openingSpeakers.forEach((bot, idx) => {
      scheduleRoomTimer(
        room,
        () => {
          if (room.phase !== 'DAY') return;
          void triggerSingleBotChat(room, bot, 'PHASE_START');
        },
        1700 + idx * 3200 + Math.floor(Math.random() * 1200)
      );
    });

    // Staggered bot Ready checks (13–25s)
    aliveBots.forEach((bot, idx) => {
      const readyDelay = 13500 + idx * 2100 + Math.floor(Math.random() * 2000);
      scheduleRoomTimer(
        room,
        () => {
          if (room.phase !== 'DAY' || !bot.alive || bot.readyToVote) return;
          if (idx === aliveBots.length - 1 || Math.random() < 0.25) {
            void triggerSingleBotChat(room, bot, 'PRE_READY');
          }
          bot.readyToVote = true;
          broadcastRoomState(room);
          checkAllReadyToVote(room);
        },
        readyDelay
      );
    });
  }

  /**
   * 3-MODE DAY VOTE PHASE:
   * Players vote freely for 1 of 3 modes (highest vote wins):
   *  1) Open 1 unrevealed Room
   *  2) Lock down 1 Horizontal Floor (eliminates all occupants on that floor!)
   *  3) Lock down 1 Vertical Column (eliminates all occupants in that column!)
   */
  function startRoomVotePhase(room: GameRoom): void {
    clearRoomTimers(room);
    room.phase = 'VOTE';
    room.phaseEndsAt = Date.now() + VOTE_DURATION_MS;

    for (const p of room.players.values()) {
      p.readyToVote = false;
      p.dayVote = null;
    }

    pushChat(room, {
      senderId: 'SYSTEM',
      senderName: room.day >= 2 ? 'หีบลงคะแนนโหวต 3 รูปแบบ' : 'หีบลงคะแนนโหวตห้อง (วันที่ 1)',
      isSystem: true,
      isBot: false,
      text:
        room.day >= 2
          ? `เปิดหีบโหวต วันที่ ${room.day}/${room.maxDays}! ปลดล็อกครบ 3 แบบบนแผนผัง: [เปิด 1 ห้อง] / [ปิดตายทั้งชั้นแนวนอน] / [ปิดตายทั้งแถวแนวตั้ง] — คะแนนสูงสุดชนะ!`
          : `เปิดหีบโหวต วันที่ 1/${room.maxDays}! วันแรกเลือกโหวตได้เฉพาะ [เปิด 1 ห้อง] (หรือ Skip) — โหวตปิดชั้น/ปิดแถวจะเปิดให้ใช้ตั้งแต่วันที่ 2 เป็นต้นไป!`,
      kind: 'VOTE',
    });

    broadcastRoomState(room);

    const aliveBots = shuffle(getAlivePlayers(room).filter((p) => p.isBot));
    aliveBots.forEach((bot, idx) => {
      scheduleRoomTimer(
        room,
        () => {
          void submitBotRoomVote(room, bot);
        },
        4500 + idx * 2200 + Math.floor(Math.random() * 1600)
      );
    });

    scheduleRoomTimer(
      room,
      () => {
        if (room.phase === 'VOTE') {
          resolveRoomVotePhase(room);
        }
      },
      VOTE_DURATION_MS
    );
  }

  async function submitBotRoomVote(room: GameRoom, bot: ServerPlayer): Promise<void> {
    if (!rooms.has(room.roomCode) || room.phase !== 'VOTE') return;
    if (!bot.alive || bot.dayVote !== null || !bot.botProfile || !bot.role || !bot.room) return;

    const unrevealedRooms = getUnrevealedRooms(room);
    if (unrevealedRooms.length === 0) return;

    const murderer = Array.from(room.players.values()).find((p) => p.role === 'MURDERER');
    const isEvil = ROLE_DEFINITIONS[bot.role].faction === 'EVIL';

    const { choice, comment } = await decideBotDayVote({
      bot: bot.botProfile,
      role: bot.role,
      myRoom: bot.room,
      day: room.day,
      maxDays: room.maxDays,
      unrevealedRooms,
      votableFloors: getVotableFloors(room),
      votableColumns: getVotableColumns(room),
      revealedRooms: Array.from(room.revealedRooms.values()),
      privateClues: bot.clueLogs,
      recentChat: room.chat.slice(-12),
      murdererRoomIfEvil: isEvil ? murderer?.room ?? null : null,
    });

    if (!rooms.has(room.roomCode) || room.phase !== 'VOTE' || !bot.alive || bot.dayVote !== null) {
      return;
    }

    bot.dayVote = choice;
    const voteLabel = formatDayVoteLabel(serializeDayVote(choice));

    if (comment && Math.random() < 0.72) {
      pushChat(room, {
        senderId: bot.id,
        senderName: bot.name,
        isSystem: false,
        isBot: true,
        text: comment,
        kind: 'CHAT',
      });
    }

    pushChat(room, {
      senderId: 'SYSTEM',
      senderName: 'หีบลงคะแนน',
      isSystem: true,
      isBot: false,
      text: `${bot.name} ลงคะแนนโหวตแล้ว`,
      kind: 'VOTE',
    });
    room.historyLog.push(`โหวตวันที่ ${room.day}: ${bot.name} เลือก ${voteLabel}`);

    broadcastRoomState(room);
    checkAllVotedRoom(room);
  }

  function accelerateBotsRoomVoteIfHumansVoted(room: GameRoom): void {
    if (room.phase !== 'VOTE') return;
    const aliveHumans = getAlivePlayers(room).filter((p) => !p.isBot);
    const allHumansVoted =
      aliveHumans.length > 0 && aliveHumans.every((h) => h.dayVote !== null);
    if (!allHumansVoted) return;

    const unvotedBots = getAlivePlayers(room).filter((p) => p.isBot && p.dayVote === null);
    unvotedBots.forEach((bot, idx) => {
      scheduleRoomTimer(
        room,
        () => {
          void submitBotRoomVote(room, bot);
        },
        900 + idx * 700
      );
    });
  }

  function checkAllVotedRoom(room: GameRoom): void {
    if (room.phase !== 'VOTE') return;
    const alive = getAlivePlayers(room);
    if (alive.length > 0 && alive.every((p) => p.dayVote !== null)) {
      clearRoomTimers(room);
      scheduleRoomTimer(room, () => resolveRoomVotePhase(room), 900);
    }
  }

  function resolveRoomVotePhase(room: GameRoom): void {
    clearRoomTimers(room);
    room.phase = 'VOTE_RESULT';
    room.phaseEndsAt = Date.now() + VOTE_RESULT_DURATION_MS;

    const alive = getAlivePlayers(room);
    const voteBuckets = new Map<string, string[]>();

    for (const p of alive) {
      const key = p.dayVote === null ? 'SKIP' : serializeDayVote(p.dayVote);
      const arr = voteBuckets.get(key) ?? [];
      arr.push(p.name);
      voteBuckets.set(key, arr);
    }

    const tally = Array.from(voteBuckets.entries())
      .map(([voteKey, voters]) => ({
        voteKey,
        label: formatDayVoteLabel(voteKey),
        count: voters.length,
        voters,
      }))
      .sort((a, b) => b.count - a.count);

    const top = tally[0];
    const second = tally[1];
    const isTie = Boolean(top && second && top.count === second.count);
    const skipWon = !top || top.voteKey === 'SKIP' || isTie;

    let winnerKind: DayVoteKind = 'SKIP';
    let lynchedRoom: HotelRoomNumber | null = null;
    let lockedFloor: HotelFloorNumber | null = null;
    let lockedColumn: HotelColumnNumber | null = null;
    const affectedRooms: HotelRoomNumber[] = [];
    const eliminatedPlayers: Array<{
      id: string;
      name: string;
      role: RoleId;
      room: HotelRoomNumber;
    }> = [];

    const eliminateOccupantIfAny = (
      r: HotelRoomNumber,
      kindWhenOccupied: 'LYNCHED_PLAYER' | 'LOCKED_PLAYER',
      kindWhenEmpty: 'EMPTY_LYNCHED' | 'LOCKED_EMPTY'
    ) => {
      if (room.revealedRooms.has(r)) return;
      affectedRooms.push(r);
      const owner = Array.from(room.players.values()).find((p) => p.alive && p.room === r);
      if (owner && owner.role) {
        const ownerRole = owner.role;
        owner.alive = false;
        owner.deathCause = 'LYNCHED';
        owner.deathDay = room.day;
        owner.deathRoom = r;
        owner.revealedRole = ownerRole;

        room.revealedRooms.set(r, {
          room: r,
          kind: kindWhenOccupied,
          day: room.day,
          occupantName: owner.name,
          occupantRole: ownerRole,
        });

        eliminatedPlayers.push({
          id: owner.id,
          name: owner.name,
          role: ownerRole,
          room: r,
        });
      } else {
        room.revealedRooms.set(r, {
          room: r,
          kind: kindWhenEmpty,
          day: room.day,
        });
      }
    };

    if (!skipWon && top) {
      if (top.voteKey.startsWith('ROOM:')) {
        const chosenRoom = Number(top.voteKey.slice(5)) as HotelRoomNumber;
        if (HOTEL_ROOMS.includes(chosenRoom) && !room.revealedRooms.has(chosenRoom)) {
          winnerKind = 'ROOM';
          lynchedRoom = chosenRoom;
          eliminateOccupantIfAny(chosenRoom, 'LYNCHED_PLAYER', 'EMPTY_LYNCHED');
        }
      } else if (top.voteKey.startsWith('FLOOR:')) {
        const chosenFloor = Number(top.voteKey.slice(6)) as HotelFloorNumber;
        if (HOTEL_FLOORS.includes(chosenFloor) && !room.lockedFloors.has(chosenFloor)) {
          winnerKind = 'FLOOR';
          lockedFloor = chosenFloor;
          room.lockedFloors.add(chosenFloor);
          for (const r of getRoomsOnFloor(chosenFloor)) {
            eliminateOccupantIfAny(r, 'LOCKED_PLAYER', 'LOCKED_EMPTY');
          }
        }
      } else if (top.voteKey.startsWith('COLUMN:')) {
        const chosenCol = Number(top.voteKey.slice(7)) as HotelColumnNumber;
        if (HOTEL_COLUMNS.includes(chosenCol) && !room.lockedColumns.has(chosenCol)) {
          winnerKind = 'COLUMN';
          lockedColumn = chosenCol;
          room.lockedColumns.add(chosenCol);
          for (const r of getRoomsInColumn(chosenCol)) {
            eliminateOccupantIfAny(r, 'LOCKED_PLAYER', 'LOCKED_EMPTY');
          }
        }
      }
    }

    const wasEmpty = affectedRooms.length > 0 && eliminatedPlayers.length === 0;
    const eliminatedNamesDesc = eliminatedPlayers
      .map((e) => `${e.name} (${ROLE_DEFINITIONS[e.role].nameTh} · ห้อง ${e.room})`)
      .join(', ');

    let summaryText = '';
    if (winnerKind === 'ROOM' && lynchedRoom) {
      summaryText =
        eliminatedPlayers.length > 0
          ? `มติโรงแรมบุกเปิดห้อง ${lynchedRoom}! พบตัว ${eliminatedNamesDesc} และกำจัดออกจากเกมทันที!`
          : `มติโรงแรมบุกเปิดห้อง ${lynchedRoom} — ปรากฏว่าเป็น "ห้องว่างเปล่า"! เปิดเผยตัดช้อยส์เพิ่มอีก 1 ห้อง`;
    } else if (winnerKind === 'FLOOR' && lockedFloor) {
      summaryText =
        eliminatedPlayers.length > 0
          ? `ประตูเหล็กปิดตายทั้ง "ชั้น ${lockedFloor}" (ห้อง ${lockedFloor}01–${lockedFloor}03)! กวาดล้าง ${eliminatedPlayers.length} คน: ${eliminatedNamesDesc}`
          : `ประตูเหล็กปิดตายทั้ง "ชั้น ${lockedFloor}" (ห้อง ${lockedFloor}01–${lockedFloor}03)! ไม่มีใครหลงเหลืออยู่บนชั้นนี้ (ปิดตายห้องว่างทั้งหมด)`;
    } else if (winnerKind === 'COLUMN' && lockedColumn) {
      summaryText =
        eliminatedPlayers.length > 0
          ? `ประตูเหล็กปิดตายทั้ง "แถวแนวตั้งที่ ${lockedColumn}" (ห้อง 10${lockedColumn}–70${lockedColumn})! กวาดล้าง ${eliminatedPlayers.length} คน: ${eliminatedNamesDesc}`
          : `ประตูเหล็กปิดตายทั้ง "แถวแนวตั้งที่ ${lockedColumn}" (ห้อง 10${lockedColumn}–70${lockedColumn})! ไม่มีใครหลงเหลืออยู่ในแถวนี้ (ปิดตายห้องว่างทั้งหมด)`;
    } else if (isTie) {
      summaryText = 'คะแนนโหวตเสมอกัน! รอบนี้ไม่มีห้อง ชั้น หรือแถวใดถูกบุกปิดตาย';
    } else {
      summaryText = 'เสียงข้างมากงดออกเสียง รอบนี้ไม่มีการเปิดห้องหรือปิดตายพื้นที่';
    }

    room.voteResolution = {
      day: room.day,
      winnerKind,
      lynchedRoom,
      lockedFloor,
      lockedColumn,
      affectedRooms,
      eliminatedPlayers,
      wasEmpty,
      isTie,
      skipWon,
      tally,
      summaryText,
    };

    room.historyLog.push(`ผลโหวตวันที่ ${room.day}: ${summaryText}`);
    pushChat(room, {
      senderId: 'SYSTEM',
      senderName: 'สรุปผลโหวตรุมประชาทัณฑ์',
      isSystem: true,
      isBot: false,
      text: summaryText,
      kind: eliminatedPlayers.length > 0 ? 'DEATH' : 'VOTE',
    });

    broadcastRoomState(room);

    // Contextual full-screen Steel Shutter / Room Breach Animation!
    if (winnerKind === 'ROOM' && lynchedRoom) {
      const firstElim = eliminatedPlayers[0];
      emitSceneToRoom(room, {
        id: uid('scn'),
        type: 'ROOM_LYNCHED',
        lockdownMode: 'ROOM',
        title: `ROOM ${lynchedRoom} BREACHED`,
        subtitle: firstElim
          ? `พบตัว ${firstElim.name} — ตัวจริงคือ ${ROLE_DEFINITIONS[firstElim.role].nameTh}!`
          : `ห้อง ${lynchedRoom} เป็นห้องว่างเปล่า!`,
        detail: summaryText,
        room: lynchedRoom,
        floor: getFloorOfRoom(lynchedRoom),
        day: room.day,
      });
    } else if (winnerKind === 'FLOOR' && lockedFloor) {
      emitSceneToRoom(room, {
        id: uid('scn'),
        type: 'ROOM_LYNCHED',
        lockdownMode: 'FLOOR',
        title: `FLOOR ${lockedFloor} LOCKDOWN`,
        subtitle:
          eliminatedPlayers.length > 0
            ? `ปิดตายชั้น ${lockedFloor} ทั้งชั้น! กวาดล้าง ${eliminatedPlayers.length} คน!`
            : `ปิดตายชั้น ${lockedFloor} ทั้งชั้น! (ไม่มีผู้พักอาศัยในชั้นนี้)`,
        detail: summaryText,
        floor: lockedFloor,
        day: room.day,
      });
    } else if (winnerKind === 'COLUMN' && lockedColumn) {
      emitSceneToRoom(room, {
        id: uid('scn'),
        type: 'ROOM_LYNCHED',
        lockdownMode: 'COLUMN',
        title: `COLUMN ${lockedColumn} LOCKDOWN`,
        subtitle:
          eliminatedPlayers.length > 0
            ? `ปิดตายแถวแนวตั้ง ${lockedColumn} (x0${lockedColumn})! กวาดล้าง ${eliminatedPlayers.length} คน!`
            : `ปิดตายแถวแนวตั้ง ${lockedColumn} (x0${lockedColumn})! (ไม่มีผู้พักอาศัยในแถวนี้)`,
        detail: summaryText,
        column: lockedColumn,
        day: room.day,
      });
    }

    scheduleRoomTimer(
      room,
      () => {
        // EXACT WIN PRIORITY FOR ROOM / FLOOR / COLUMN ELIMINATION:
        // 1. If Murderer is among eliminated -> GOOD wins immediately (takes priority over Drunk!)
        const murdererEliminated = eliminatedPlayers.find((e) => e.role === 'MURDERER');
        if (murdererEliminated) {
          enterGameOver(
            room,
            'GOOD',
            `จับฆาตกรได้สำเร็จ! ${murdererEliminated.name} (ห้อง ${murdererEliminated.room}) ถูกกำจัดจากผลโหวต${
              winnerKind === 'FLOOR'
                ? `ปิดตายชั้น ${lockedFloor}`
                : winnerKind === 'COLUMN'
                  ? `ปิดตายแถวแนวตั้ง ${lockedColumn}`
                  : `เปิดห้อง ${lynchedRoom}`
            }!`
          );
          return;
        }

        // 2. Else if Drunk is among eliminated (without Murderer) -> DRUNK wins ALONE immediately!
        const drunkEliminated = eliminatedPlayers.find((e) => e.role === 'DRUNK');
        if (drunkEliminated) {
          enterGameOver(
            room,
            'SPECIAL',
            `คนเมา (${drunkEliminated.name} · ห้อง ${drunkEliminated.room}) โดนโหวต${
              winnerKind === 'FLOOR'
                ? `ปิดตายชั้น ${lockedFloor}`
                : winnerKind === 'COLUMN'
                  ? `ปิดตายแถวแนวตั้ง ${lockedColumn}`
                  : `เปิดห้อง ${lynchedRoom}`
            } เข้าทางเต็มๆ! คนเมาชนะเพียงคนเดียว!`,
            drunkEliminated.name
          );
          return;
        }

        // 3. Check Standard Win Condition (e.g. Evil parity if too many innocents were wiped out)
        const winCheck = checkStandardWinCondition(room);
        if (winCheck) {
          enterGameOver(room, winCheck.winner, winCheck.reason, winCheck.winnerPlayerName);
          return;
        }

        // 4. Check Time Limit (maxDays reached without finding Murderer!)
        if (room.day >= room.maxDays) {
          const murderer = Array.from(room.players.values()).find((p) => p.role === 'MURDERER');
          enterGameOver(
            room,
            'EVIL',
            `หมดเวลาครบ ${room.maxDays} วันแล้ว! ฆาตกร (${murderer?.name ?? 'ฆาตกร'} · ห้อง ${murderer?.room ?? '?'}) หลบหนีออกจากโรงแรมไปได้สำเร็จ!`
          );
          return;
        }

        // 5. Proceed into Night Phase
        startNightPhase(room);
      },
      VOTE_RESULT_DURATION_MS
    );
  }

  function tryFinishNightEarly(room: GameRoom): void {
    if (room.phase !== 'NIGHT') return;
    const requiredActors = getRequiredNightActors(room);
    if (requiredActors.every((p) => room.night.submittedPlayerIds.has(p.id))) {
      clearRoomTimers(room);
      scheduleRoomTimer(room, () => resolveNightPhase(room), 950);
    }
  }

  function startNightPhase(room: GameRoom): void {
    clearRoomTimers(room);
    room.phase = 'NIGHT';
    room.phaseEndsAt = Date.now() + NIGHT_DURATION_MS;
    room.night = freshNightSubmissions();
    room.secretPing = null;

    pushChat(room, {
      senderId: 'SYSTEM',
      senderName: 'โรงแรมมรณะ',
      isSystem: true,
      isBot: false,
      text: `ค่ำคืนที่ ${room.day} มาเยือนแล้ว... ไฟทั้ง 7 ชั้นดับสนิท ผู้มีบทบาทพิเศษจงใช้สกิลภายใน 28 วินาที`,
      kind: 'ALERT',
    });

    broadcastRoomState(room);

    // Schedule AI bot night actions (Accomplice inspects early so they can whisper real floor intel!)
    const requiredBotActors = getRequiredNightActors(room).filter((p) => p.isBot);
    requiredBotActors.forEach((bot, idx) => {
      const baseDelay =
        bot.role === 'ACCOMPLICE'
          ? 1400
          : bot.role === 'MURDERER'
            ? 6200
            : 2800 + idx * 1150;
      scheduleRoomTimer(
        room,
        () => {
          void (async () => {
            if (room.phase !== 'NIGHT' || !bot.alive || !bot.role || !bot.botProfile || !bot.room)
              return;
            const evilPartnerIds =
              ROLE_DEFINITIONS[bot.role].faction === 'EVIL'
                ? Array.from(room.players.values())
                    .filter(
                      (p) =>
                        p.id !== bot.id &&
                        p.role !== null &&
                        ROLE_DEFINITIONS[p.role].faction === 'EVIL'
                    )
                    .map((p) => p.id)
                : [];

            const decision = await decideBotNightAction({
              bot: bot.botProfile,
              role: bot.role,
              myRoom: bot.room,
              day: room.day,
              unrevealedRooms: getUnrevealedRooms(room),
              players: toFogBotContextPlayers(room),
              evilPartnerIds,
              alreadyCheckedIds: bot.checkedPlayerIds,
              lastKeymasterLockedRoom: room.lastKeymasterLockedRoom,
              recentChat: room.chat.slice(-10),
              secretChat: ROLE_DEFINITIONS[bot.role].faction === 'EVIL' ? room.secretChat : [],
              secretPing: ROLE_DEFINITIONS[bot.role].faction === 'EVIL' ? room.secretPing : null,
              privateClues: bot.clueLogs,
            });

            if (room.phase !== 'NIGHT' || !bot.alive) return;
            applyNightAction(room, bot, decision);
          })();
        },
        baseDelay + Math.floor(Math.random() * 900)
      );
    });

    // AI Accomplice sends Secret Killer Chat whisper & Target Ping after instant floor inspection
    const aliveAccomplice = getAlivePlayers(room).find((p) => p.role === 'ACCOMPLICE');
    const aliveMurderer = getAlivePlayers(room).find((p) => p.role === 'MURDERER');
    if (
      aliveAccomplice &&
      aliveAccomplice.isBot &&
      aliveAccomplice.botProfile &&
      aliveAccomplice.room &&
      aliveMurderer
    ) {
      scheduleRoomTimer(
        room,
        () => {
          void (async () => {
            if (
              room.phase !== 'NIGHT' ||
              !aliveAccomplice.alive ||
              !aliveAccomplice.botProfile ||
              !aliveAccomplice.room
            )
              return;
            const res = await generateAccompliceSecretPing({
              bot: aliveAccomplice.botProfile,
              murdererName: aliveMurderer.name,
              day: room.day,
              unrevealedRooms: getUnrevealedRooms(room),
              myRoom: aliveAccomplice.room,
              recentChat: room.chat.slice(-10),
              privateClues: aliveAccomplice.clueLogs,
            });
            if (room.phase !== 'NIGHT' || !aliveAccomplice.alive) return;
            pushSecretEvilChat(room, aliveAccomplice, res.whisper);
            broadcastSecretPing(room, {
              senderName: aliveAccomplice.name,
              kind: res.pingFloor ? 'FLOOR' : 'ROOM',
              room: res.pingFloor ? null : res.pingRoom,
              floor: res.pingFloor ?? null,
              playerId: null,
              playerName: null,
              timestamp: Date.now(),
            });
          })();
        },
        3400
      );
    }

    scheduleRoomTimer(
      room,
      () => {
        if (room.phase === 'NIGHT') {
          resolveNightPhase(room);
        }
      },
      NIGHT_DURATION_MS
    );

    if (getRequiredNightActors(room).length === 0) {
      scheduleRoomTimer(room, () => resolveNightPhase(room), 3000);
    }
  }

  function applyNightAction(
    room: GameRoom,
    player: ServerPlayer,
    target: number | string | null
  ): boolean {
    if (room.phase !== 'NIGHT' || !player.alive || !player.role) return false;
    const roleDef = ROLE_DEFINITIONS[player.role];
    if (!roleDef.hasNightAction) return false;

    if (player.role === 'MURDERER') {
      const roomNum = Number(target) as HotelRoomNumber;
      if (!HOTEL_ROOMS.includes(roomNum) || room.revealedRooms.has(roomNum) || roomNum === player.room) {
        return false;
      }
      room.night.murdererRoom = roomNum;
    } else if (player.role === 'KEYMASTER') {
      const roomNum = Number(target) as HotelRoomNumber;
      if (
        !HOTEL_ROOMS.includes(roomNum) ||
        room.revealedRooms.has(roomNum) ||
        roomNum === room.lastKeymasterLockedRoom // STRICT BAN: cannot lock same room twice in a row!
      ) {
        return false;
      }
      room.night.keymasterRoom = roomNum;
    } else if (player.role === 'HOUSEKEEPER') {
      const floorNum = Number(target) as HotelFloorNumber;
      if (!HOTEL_FLOORS.includes(floorNum)) return false;
      room.night.housekeeperFloor = floorNum;
    } else if (player.role === 'WITNESS') {
      const floorNum = Number(target) as HotelFloorNumber;
      if (!HOTEL_FLOORS.includes(floorNum)) return false;
      room.night.witnessWatchFloor = floorNum;
    } else if (player.role === 'GLAZIER') {
      const colNum = Number(target) as HotelColumnNumber;
      if (!HOTEL_COLUMNS.includes(colNum)) return false;
      room.night.glazierColumn = colNum;
    } else if (player.role === 'DETECTIVE') {
      const targetId = String(target);
      const targetPlayer = room.players.get(targetId);
      if (!targetPlayer || !targetPlayer.alive || targetPlayer.id === player.id) return false;
      room.night.detectiveTargetId = targetId;
    } else if (player.role === 'ACCOMPLICE') {
      const targetId = String(target);
      const targetPlayer = room.players.get(targetId);
      if (!targetPlayer || !targetPlayer.alive || targetPlayer.id === player.id) return false;
      room.night.accompliceTargetId = targetId;

      // Instant Floor Discovery for Accomplice so they can relay via Secret Chat & Target Ping TONIGHT!
      if (!room.night.submittedPlayerIds.has(player.id) && targetPlayer.room) {
        const floor = getFloorOfRoom(targetPlayer.room);
        if (!player.checkedPlayerIds.includes(targetPlayer.id)) {
          player.checkedPlayerIds.push(targetPlayer.id);
        }
        player.clueLogs.push({
          id: uid('clue'),
          night: room.day,
          category: 'ACCOMPLICE',
          title: `สืบชั้นเหยื่อ · ${targetPlayer.name} = ชั้น ${floor}`,
          detail: `สืบพบทันที! "${targetPlayer.name}" พักอยู่ที่ ชั้น ${floor} (ห้อง ${floor}01–${floor}03) — ส่งซิกบอกฆาตกรในแชทลับได้เลย!`,
          tone: 'DANGER',
        });
        room.historyLog.push(
          `คืน ${room.day}: ผู้ช่วยฆาตกร (${player.name}) สืบ ${targetPlayer.name} = ชั้น ${floor}`
        );
      }
    }

    room.night.submittedPlayerIds.add(player.id);
    broadcastRoomState(room);
    tryFinishNightEarly(room);
    return true;
  }

  function resolveNightPhase(room: GameRoom): void {
    clearRoomTimers(room);

    const aliveBeforeKill = getAlivePlayers(room);
    const murderer = aliveBeforeKill.find((p) => p.role === 'MURDERER');
    const keymaster = aliveBeforeKill.find((p) => p.role === 'KEYMASTER');
    const lockedRoom = room.night.keymasterRoom;
    room.lastKeymasterLockedRoom = lockedRoom;

    const targetRoom = room.night.murdererRoom;
    let victim: ServerPlayer | null = null;
    let lockSaved = false;
    let savedOccupant: ServerPlayer | null = null;

    // 1. Murderer Attack vs Keymaster Lock
    if (murderer && targetRoom !== null) {
      const occupant = aliveBeforeKill.find((p) => p.room === targetRoom && p.id !== murderer.id);
      if (lockedRoom === targetRoom) {
        lockSaved = true;
        savedOccupant = occupant ?? null;
        room.historyLog.push(
          `คืน ${room.day}: ฆาตกร (${murderer.name}) บุกห้อง ${targetRoom} แต่ช่างกุญแจล็อกป้องกันไว้ได้!`
        );
      } else if (occupant && occupant.role) {
        const victimRole = occupant.role;
        victim = occupant;
        victim.alive = false;
        victim.deathCause = 'MURDERED';
        victim.deathDay = room.day;
        victim.deathRoom = targetRoom;
        victim.revealedRole = victimRole;

        room.revealedRooms.set(targetRoom, {
          room: targetRoom,
          kind: 'MURDERED_PLAYER',
          day: room.day,
          occupantName: victim.name,
          occupantRole: victimRole,
        });

        room.historyLog.push(
          `คืน ${room.day}: ฆาตกร (${murderer.name}) สังหาร ${victim.name} (${ROLE_DEFINITIONS[victimRole].nameTh}) คาห้อง ${targetRoom}`
        );
      } else {
        room.historyLog.push(
          `คืน ${room.day}: ฆาตกร (${murderer.name}) บุกห้อง ${targetRoom} แต่เป็นห้องว่างเปล่า!`
        );
      }
    } else {
      room.historyLog.push(`คืน ${room.day}: ไม่มีเหตุลอบสังหาร`);
    }

    const animatedPlayerIds = new Set<string>();

    // KILLED Animation for Victim
    if (victim && targetRoom) {
      animatedPlayerIds.add(victim.id);
      emitSceneToPlayer(victim, {
        id: uid('scn'),
        type: 'KILLED',
        title: 'คุณถูกสังหาร!',
        subtitle: `คมมีดปลิดชีพคุณกลางดึกในห้อง ${targetRoom} (ชั้น ${getFloorOfRoom(targetRoom)})`,
        detail:
          victim.role === 'DRUNK'
            ? 'คุณคือคนเมาแต่ถูกฆาตกรฆ่าตอนกลางคืน (ถือว่าแพ้) — เข้าสู่สถานะผู้ชม'
            : 'คุณกำลังเข้าสู่สถานะวิญญาณผู้ชม — ยังดูเกมและรอดูความคิด AI หลังจบเกมได้',
        room: targetRoom,
        floor: getFloorOfRoom(targetRoom),
        day: room.day,
        isVictimMe: true,
      });
    }

    // SAVED_BY_LOCKSMITH Animation for Saved Occupant & Keymaster
    if (lockSaved && targetRoom) {
      const recipients = new Set<ServerPlayer>();
      if (savedOccupant) recipients.add(savedOccupant);
      if (keymaster) recipients.add(keymaster);
      for (const r of recipients) {
        if (animatedPlayerIds.has(r.id)) continue;
        animatedPlayerIds.add(r.id);
        const isKm = r.id === keymaster?.id;
        emitSceneToPlayer(r, {
          id: uid('scn'),
          type: 'SAVED_BY_LOCKSMITH',
          title: isKm ? 'กลอนกุญแจช่วยชีวิตไว้ได้!' : 'รอดตายหวุดหวิด!',
          subtitle: isKm
            ? `ฆาตกรบุกห้อง ${targetRoom} แต่กลอนนิรภัยที่คุณล็อกไว้ต้านได้สำเร็จ!`
            : `มีคนพยายามพังประตูห้อง ${targetRoom} กลางดึก แต่กลอนกุญแจทองล็อกแน่นจนรอดมาได้!`,
          room: targetRoom,
          floor: getFloorOfRoom(targetRoom),
          day: room.day,
        });
      }
      if (keymaster) {
        keymaster.clueLogs.push({
          id: uid('clue'),
          night: room.day,
          category: 'KEYMASTER',
          title: `ล็อกห้อง ${targetRoom} ป้องกันสำเร็จ!`,
          detail: `คืนที่ ${room.day} ฆาตกรพยายามบุกห้อง ${targetRoom} แต่กลอนของคุณช่วยชีวิตไว้ได้! (คืนหน้าห้ามล็อกห้อง ${targetRoom} ซ้ำ)`,
          tone: 'SAFE',
        });
      }
    }

    // Remaining alive players AFTER tonight's kill (used for Housekeeper / Glazier counts)
    const aliveNow = getAlivePlayers(room);

    // 2. HOUSEKEEPER (แม่บ้าน): Counts living players on selected horizontal floor (1–7)
    const housekeeper = aliveNow.find((p) => p.role === 'HOUSEKEEPER');
    if (housekeeper && room.night.housekeeperFloor) {
      const f = room.night.housekeeperFloor;
      const count = aliveNow.filter((p) => p.room !== null && getFloorOfRoom(p.room) === f).length;
      const detail = `ชั้น ${f} (ห้อง ${f}01–${f}03) มีผู้เล่นที่ยังมีชีวิตพักอยู่ทั้งหมด ${count} คน`;
      housekeeper.clueLogs.push({
        id: uid('clue'),
        night: room.day,
        category: 'HOUSEKEEPER',
        title: `ตรวจแนวนอน · ชั้น ${f}`,
        detail,
        tone: count > 0 ? 'INFO' : 'SAFE',
      });
      room.historyLog.push(`คืน ${room.day}: แม่บ้าน (${housekeeper.name}) ตรวจชั้น ${f} = ${count} คน`);
      if (!animatedPlayerIds.has(housekeeper.id)) {
        animatedPlayerIds.add(housekeeper.id);
        emitSceneToPlayer(housekeeper, {
          id: uid('scn'),
          type: 'CLUE_DISCOVERED',
          title: `รายงานแม่บ้าน · ชั้น ${f}`,
          subtitle: `ตรวจแนวนอนชั้น ${f} เสร็จสิ้น`,
          detail,
          floor: f,
          day: room.day,
        });
      }
    }

    // 3. GLAZIER (ช่างเช็ดกระจก): Counts living players in selected vertical column (1, 2, or 3) across Floors 1–7
    const glazier = aliveNow.find((p) => p.role === 'GLAZIER');
    if (glazier && room.night.glazierColumn) {
      const c = room.night.glazierColumn;
      const count = aliveNow.filter(
        (p) => p.room !== null && getColumnOfRoom(p.room) === c
      ).length;
      const detail = `แนวตั้งแถวที่ ${c} (ห้อง 10${c}–70${c}) มีผู้เล่นที่ยังมีชีวิตพักอยู่ทั้งหมด ${count} คน`;
      glazier.clueLogs.push({
        id: uid('clue'),
        night: room.day,
        category: 'GLAZIER',
        title: `ตรวจแนวตั้ง · แถว ${c} (x0${c})`,
        detail,
        tone: count > 0 ? 'INFO' : 'SAFE',
      });
      room.historyLog.push(`คืน ${room.day}: ช่างเช็ดกระจก (${glazier.name}) ตรวจแถวแนวตั้ง ${c} = ${count} คน`);
      if (!animatedPlayerIds.has(glazier.id)) {
        animatedPlayerIds.add(glazier.id);
        emitSceneToPlayer(glazier, {
          id: uid('scn'),
          type: 'CLUE_DISCOVERED',
          title: `รายงานช่างเช็ดกระจก · แถว ${c}`,
          subtitle: `ตรวจแนวตั้งตลอด 7 ชั้น (x0${c}) เสร็จสิ้น`,
          detail,
          day: room.day,
        });
      }
    }

    // 4. DETECTIVE (นักสืบ): Reveals which FLOOR the selected player lives on
    const detective = aliveNow.find((p) => p.role === 'DETECTIVE');
    if (detective && room.night.detectiveTargetId) {
      const target = room.players.get(room.night.detectiveTargetId);
      if (target && target.room) {
        const floor = getFloorOfRoom(target.room);
        detective.checkedPlayerIds.push(target.id);
        const detail = `ผู้เล่น "${target.name}" พักอยู่ที่ ชั้น ${floor} (ห้อง ${floor}01–${floor}03)`;
        detective.clueLogs.push({
          id: uid('clue'),
          night: room.day,
          category: 'DETECTIVE',
          title: `สืบตำแหน่ง · ${target.name}`,
          detail,
          tone: 'INFO',
        });
        room.historyLog.push(`คืน ${room.day}: นักสืบ (${detective.name}) สืบ ${target.name} = ชั้น ${floor}`);
        if (!animatedPlayerIds.has(detective.id)) {
          animatedPlayerIds.add(detective.id);
          emitSceneToPlayer(detective, {
            id: uid('scn'),
            type: 'CLUE_DISCOVERED',
            title: `ผลสืบสวน · ${target.name}`,
            subtitle: `พบเบาะแสชั้นพักของผู้ต้องสงสัย`,
            detail,
            floor,
            day: room.day,
          });
        }
      }
    }

    // 5. ACCOMPLICE (ผู้ช่วยฆาตกร): Floor clue already delivered immediately on Night Action so Accomplice can signal Murderer live!

    // 6. WITNESS (พยาน): Watches 1 selected floor; if Murderer kills someone on THAT floor, learns whether Murderer's room is HIGHER, LOWER, or SAME FLOOR!
    const witness = aliveNow.find((p) => p.role === 'WITNESS');
    if (witness && room.night.witnessWatchFloor) {
      const watchedFloor = room.night.witnessWatchFloor;
      if (victim && targetRoom && murderer && murderer.room && getFloorOfRoom(targetRoom) === watchedFloor) {
        const murdererFloor = getFloorOfRoom(murderer.room);
        const relation =
          murdererFloor > watchedFloor
            ? 'สูงกว่า'
            : murdererFloor < watchedFloor
              ? 'ต่ำกว่า'
              : 'ชั้นเดียวกัน';
        const detail = `เกิดเหตุฆาตกรรมบนชั้น ${watchedFloor} ที่คุณเฝ้าดูพอดี! คุณเห็นเงาฆาตกรหลบหนีไปทางห้องที่อยู่ "${relation}" ชั้น ${watchedFloor}!`;
        witness.clueLogs.push({
          id: uid('clue'),
          night: room.day,
          category: 'WITNESS',
          title: `พยานเห็นฆาตกร! (เฝ้าชั้น ${watchedFloor})`,
          detail,
          tone: 'DANGER',
        });
        room.historyLog.push(
          `คืน ${room.day}: พยาน (${witness.name}) เฝ้าชั้น ${watchedFloor} ตรงจุดเกิดเหตุ! รู้ว่าฆาตกรอยู่ "${relation}"`
        );
        if (!animatedPlayerIds.has(witness.id)) {
          animatedPlayerIds.add(witness.id);
          emitSceneToPlayer(witness, {
            id: uid('scn'),
            type: 'CLUE_DISCOVERED',
            title: 'พยานเห็นเหตุการณ์!',
            subtitle: `ฆาตกรลงมือบนชั้น ${watchedFloor} ที่คุณเฝ้าดูพอดี!`,
            detail,
            floor: watchedFloor,
            day: room.day,
          });
        }
      } else {
        witness.clueLogs.push({
          id: uid('clue'),
          night: room.day,
          category: 'WITNESS',
          title: `เฝ้าดูชั้น ${watchedFloor}`,
          detail: `คืนที่ ${room.day} ไม่มีเหตุฆาตกรรมเกิดขึ้นบนชั้น ${watchedFloor} ที่คุณเฝ้าดู จึงไม่ได้เบาะแสใดๆ`,
          tone: 'INFO',
        });
      }
    }

    // Morning Report
    if (victim && targetRoom) {
      const crimeFloor = getFloorOfRoom(targetRoom);
      room.morningReport = {
        day: room.day + 1,
        victimId: victim.id,
        victimName: victim.name,
        victimRole: victim.role,
        crimeRoom: targetRoom,
        crimeFloor,
        lockSaved: false,
        headline: `เมื่อคืนพบศพ ${victim.name} (${ROLE_DEFINITIONS[victim.role ?? 'KEYMASTER'].nameTh}) ในห้อง ${targetRoom} (ชั้น ${crimeFloor})!`,
        subtext: `เปิดเผยห้อง ${targetRoom} บนแผนผังแล้ว รีบวิเคราะห์เบาะแสแนวตั้ง/แนวนอนก่อนหมดเวลา!`,
      };
    } else {
      // Exact rule: both empty room AND keymaster block announce "เมื่อคืนไม่มีผู้เสียชีวิต"
      room.morningReport = {
        day: room.day + 1,
        victimId: null,
        victimName: null,
        victimRole: null,
        crimeRoom: null,
        crimeFloor: null,
        lockSaved,
        headline: 'เมื่อคืนไม่มีผู้เสียชีวิต',
        subtext: 'โรงแรมเงียบสงัดตลอดคืน... ช่างกุญแจป้องกันไว้ได้ หรือฆาตกรบุกผิดห้องว่างกันแน่?',
      };
    }

    // Check immediate Murderer Team victory after night kill
    const winCheck = checkStandardWinCondition(room);
    if (winCheck) {
      room.day += 1;
      room.phase = 'DAY';
      room.phaseEndsAt = null;
      broadcastRoomState(room);
      scheduleRoomTimer(
        room,
        () => enterGameOver(room, winCheck.winner, winCheck.reason, winCheck.winnerPlayerName),
        4000
      );
      return;
    }

    room.day += 1;
    startDayPhase(room);
  }

  function startNewMatch(room: GameRoom): void {
    clearRoomTimers(room);

    const humans = Array.from(room.players.values()).filter((p) => !p.isBot && p.connected);
    room.players.clear();
    humans.forEach((h) => {
      h.alive = true;
      h.readyToVote = false;
      h.dayVote = null;
      h.deathCause = null;
      h.deathDay = null;
      h.deathRoom = null;
      h.revealedRole = null;
      h.clueLogs = [];
      h.checkedPlayerIds = [];
      room.players.set(h.id, h);
    });

    const botsNeeded = Math.max(0, room.maxPlayers - humans.length);
    const takenNames = new Set(humans.map((h) => h.name.toLowerCase()));
    const shuffledPool = shuffle(BOT_POOL).filter((b) => !takenNames.has(b.name.toLowerCase()));

    for (let i = 0; i < botsNeeded; i++) {
      const template = shuffledPool[i] ?? {
        name: `บอท${i + 1}`,
        persona: 'เพื่อนซี้ปากแจ๋ว ชอบบลัฟและตัดช้อยส์เลขห้อง',
        avatarColor: HUMAN_AVATAR_COLORS[i % HUMAN_AVATAR_COLORS.length],
      };
      const botId = uid('bot');
      const preferredProvider: 'groq' | 'gemini' = i % 2 === 0 ? 'groq' : 'gemini';
      const botProfile: BotProfile = {
        id: botId,
        name: template.name,
        persona: template.persona,
        preferredProvider,
        avatarColor: template.avatarColor,
      };
      room.players.set(botId, {
        id: botId,
        socketId: null,
        name: botProfile.name,
        isBot: true,
        isHost: false,
        connected: true,
        alive: true,
        role: null,
        room: null,
        readyToVote: false,
        dayVote: null,
        deathCause: null,
        deathDay: null,
        deathRoom: null,
        revealedRole: null,
        avatarColor: botProfile.avatarColor,
        botProfile,
        clueLogs: [],
        checkedPlayerIds: [],
      });
    }

    // 1. Deal 8 authentic roles & permanent FIXED rooms from the 21 hotel rooms
    const allPlayers = Array.from(room.players.values());
    const roles = shuffle(getRoleDistribution(allPlayers.length));
    const shuffledRooms = shuffle([...HOTEL_ROOMS]);

    allPlayers.forEach((p, idx) => {
      p.role = roles[idx] ?? 'KEYMASTER';
      p.room = shuffledRooms[idx]; // Permanent fixed room for entire game!
    });

    // 2. INITIAL 3 DEAD ROOMS: Randomly reveal 3 EMPTY rooms before Day 1 starts!
    const occupiedRoomSet = new Set(allPlayers.map((p) => p.room));
    const emptyRooms = shuffle(HOTEL_ROOMS.filter((r) => !occupiedRoomSet.has(r)));
    const initialCrimeRooms = emptyRooms.slice(0, 3);

    room.revealedRooms = new Map();
    for (const r of initialCrimeRooms) {
      room.revealedRooms.set(r, {
        room: r,
        kind: 'INITIAL_CRIME',
        day: 0,
      });
    }

    room.phase = 'SETUP';
    room.day = 1;
    room.maxDays = getMaxDaysForPlayerCount(allPlayers.length);
    room.phaseEndsAt = Date.now() + SETUP_DURATION_MS;
    room.lockedFloors = new Set();
    room.lockedColumns = new Set();
    room.chat = [];
    room.secretChat = [];
    room.secretPing = null;
    room.historyLog = [
      `เริ่มเกมใหม่ (${allPlayers.length} คน, จำกัด ${room.maxDays} วัน, ห้ามย้ายห้อง) — เปิดห้องศพตั้งต้น 3 ห้อง: ${initialCrimeRooms.join(', ')}`,
    ];
    room.morningReport = null;
    room.voteResolution = null;
    room.winner = null;
    room.winnerPlayerName = null;
    room.winReason = null;
    room.aiThoughts = [];
    room.aiThoughtsLoading = false;
    room.lastKeymasterLockedRoom = null;
    room.night = freshNightSubmissions();

    pushChat(room, {
      senderId: 'SYSTEM',
      senderName: 'โรงแรมมรณะ',
      isSystem: true,
      isBot: false,
      text: `เช็คอินครบ ${allPlayers.length} คน (จำกัดเวลา ${room.maxDays} วัน)! แจกบทบาทลับและห้องประจำตัวถาวรเรียบร้อย`,
      kind: 'ALERT',
    });

    broadcastRoomState(room);
    scheduleRoomTimer(room, () => startDayPhase(room), SETUP_DURATION_MS);
  }

  function resetRoomToLobby(room: GameRoom): void {
    clearRoomTimers(room);
    room.phase = 'LOBBY';
    room.day = 0;
    room.maxDays = getMaxDaysForPlayerCount(room.maxPlayers);
    room.phaseEndsAt = null;
    room.revealedRooms = new Map();
    room.lockedFloors = new Set();
    room.lockedColumns = new Set();
    room.chat = [];
    room.secretChat = [];
    room.secretPing = null;
    room.historyLog = [];
    room.morningReport = null;
    room.voteResolution = null;
    room.winner = null;
    room.winnerPlayerName = null;
    room.winReason = null;
    room.aiThoughts = [];
    room.aiThoughtsLoading = false;
    room.lastKeymasterLockedRoom = null;
    room.night = freshNightSubmissions();

    for (const [id, p] of room.players.entries()) {
      if (p.isBot || !p.connected) {
        room.players.delete(id);
      } else {
        p.alive = true;
        p.role = null;
        p.room = null;
        p.readyToVote = false;
        p.dayVote = null;
        p.deathCause = null;
        p.deathDay = null;
        p.deathRoom = null;
        p.revealedRole = null;
        p.clueLogs = [];
        p.checkedPlayerIds = [];
      }
    }

    const remaining = Array.from(room.players.values());
    if (remaining.length > 0 && !remaining.some((p) => p.isHost)) {
      remaining[0].isHost = true;
    }

    broadcastRoomState(room);
  }

  // Socket.io Real-time Event Handlers
  io.on('connection', (socket) => {
    socket.on(
      'room:create',
      (
        payload: { name?: string; maxPlayers?: number },
        ack?: (res: { ok: boolean; roomCode?: string; playerId?: string; error?: string }) => void
      ) => {
        const cleanName = String(payload?.name ?? '').trim().slice(0, 20);
        if (!cleanName) {
          ack?.({ ok: false, error: 'กรุณาตั้งชื่อเล่นก่อนสร้างห้อง' });
          return;
        }

        const maxPlayers = Math.max(5, Math.min(8, Number(payload?.maxPlayers) || 8));
        const roomCode = generateRoomCode();
        const playerId = uid('p');

        const hostPlayer: ServerPlayer = {
          id: playerId,
          socketId: socket.id,
          name: cleanName,
          isBot: false,
          isHost: true,
          connected: true,
          alive: true,
          role: null,
          room: null,
          readyToVote: false,
          dayVote: null,
          deathCause: null,
          deathDay: null,
          deathRoom: null,
          revealedRole: null,
          avatarColor: HUMAN_AVATAR_COLORS[0],
          clueLogs: [],
          checkedPlayerIds: [],
        };

        const room: GameRoom = {
          roomCode,
          phase: 'LOBBY',
          day: 0,
          maxDays: getMaxDaysForPlayerCount(maxPlayers),
          maxPlayers,
          phaseEndsAt: null,
          revealedRooms: new Map(),
          lockedFloors: new Set(),
          lockedColumns: new Set(),
          players: new Map([[playerId, hostPlayer]]),
          chat: [],
          secretChat: [],
          secretPing: null,
          historyLog: [],
          morningReport: null,
          voteResolution: null,
          winner: null,
          winnerPlayerName: null,
          winReason: null,
          aiThoughts: [],
          aiThoughtsLoading: false,
          lastKeymasterLockedRoom: null,
          night: freshNightSubmissions(),
          timers: new Set(),
          lastHumanReplyAt: 0,
          botChatterCountThisPhase: 0,
          createdAt: Date.now(),
        };

        rooms.set(roomCode, room);
        socketToMembership.set(socket.id, { roomCode, playerId });
        void socket.join(roomCode);

        ack?.({ ok: true, roomCode, playerId });
        broadcastRoomState(room);
      }
    );

    socket.on(
      'room:check',
      (
        payload: { roomCode?: string },
        ack?: (res: { exists: boolean; phase?: GamePhase; humanCount?: number; maxPlayers?: number }) => void
      ) => {
        const code = String(payload?.roomCode ?? '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          ack?.({ exists: false });
          return;
        }
        const humanCount = Array.from(room.players.values()).filter(
          (p) => !p.isBot && p.connected
        ).length;
        ack?.({ exists: true, phase: room.phase, humanCount, maxPlayers: room.maxPlayers });
      }
    );

    socket.on(
      'room:join',
      (
        payload: { roomCode?: string; name?: string; playerId?: string },
        ack?: (res: { ok: boolean; roomCode?: string; playerId?: string; error?: string }) => void
      ) => {
        const code = String(payload?.roomCode ?? '').trim().toUpperCase();
        const cleanName = String(payload?.name ?? '').trim().slice(0, 20);
        const room = rooms.get(code);

        if (!room) {
          ack?.({ ok: false, error: `ไม่พบห้องรหัส "${code}" หรือห้องถูกปิดไปแล้ว` });
          return;
        }

        if (payload?.playerId && room.players.has(payload.playerId)) {
          const existing = room.players.get(payload.playerId)!;
          if (!existing.isBot) {
            existing.socketId = socket.id;
            existing.connected = true;
            socketToMembership.set(socket.id, { roomCode: code, playerId: existing.id });
            void socket.join(code);
            ack?.({ ok: true, roomCode: code, playerId: existing.id });
            broadcastRoomState(room);
            return;
          }
        }

        if (!cleanName) {
          ack?.({ ok: false, error: 'กรุณาตั้งชื่อเล่นก่อนเข้าห้อง' });
          return;
        }
        if (room.phase !== 'LOBBY') {
          ack?.({ ok: false, error: 'ห้องนี้เริ่มเกมไปแล้ว รอรอบถัดไปนะ' });
          return;
        }

        const currentHumans = Array.from(room.players.values()).filter((p) => !p.isBot);
        if (currentHumans.length >= 8) {
          ack?.({ ok: false, error: 'ห้องเต็มแล้ว (สูงสุด 8 คนตามบทบาทต้นฉบับ)' });
          return;
        }
        if (currentHumans.some((p) => p.name.toLowerCase() === cleanName.toLowerCase())) {
          ack?.({ ok: false, error: 'ชื่อนี้มีคนใช้ในห้องแล้ว ลองตั้งชื่ออื่นดู' });
          return;
        }

        const playerId = uid('p');
        const newPlayer: ServerPlayer = {
          id: playerId,
          socketId: socket.id,
          name: cleanName,
          isBot: false,
          isHost: false,
          connected: true,
          alive: true,
          role: null,
          room: null,
          readyToVote: false,
          dayVote: null,
          deathCause: null,
          deathDay: null,
          deathRoom: null,
          revealedRole: null,
          avatarColor: HUMAN_AVATAR_COLORS[currentHumans.length % HUMAN_AVATAR_COLORS.length],
          clueLogs: [],
          checkedPlayerIds: [],
        };

        room.players.set(playerId, newPlayer);
        if (currentHumans.length + 1 > room.maxPlayers) {
          room.maxPlayers = Math.min(8, currentHumans.length + 1);
          room.maxDays = getMaxDaysForPlayerCount(room.maxPlayers);
        }

        socketToMembership.set(socket.id, { roomCode: code, playerId });
        void socket.join(code);

        ack?.({ ok: true, roomCode: code, playerId });
        broadcastRoomState(room);
      }
    );

    socket.on('room:updateConfig', (payload: { maxPlayers?: number }) => {
      const member = socketToMembership.get(socket.id);
      if (!member) return;
      const room = rooms.get(member.roomCode);
      if (!room || room.phase !== 'LOBBY') return;
      const player = room.players.get(member.playerId);
      if (!player || !player.isHost) return;

      const humanCount = Array.from(room.players.values()).filter((p) => !p.isBot).length;
      const requested = Number(payload?.maxPlayers);
      if (Number.isFinite(requested)) {
        room.maxPlayers = Math.max(Math.max(5, humanCount), Math.min(8, Math.round(requested)));
        room.maxDays = getMaxDaysForPlayerCount(room.maxPlayers);
        broadcastRoomState(room);
      }
    });

    socket.on('game:start', () => {
      const member = socketToMembership.get(socket.id);
      if (!member) return;
      const room = rooms.get(member.roomCode);
      if (!room || room.phase !== 'LOBBY') return;
      const player = room.players.get(member.playerId);
      if (!player || !player.isHost) return;
      startNewMatch(room);
    });

    socket.on('game:playAgain', () => {
      const member = socketToMembership.get(socket.id);
      if (!member) return;
      const room = rooms.get(member.roomCode);
      if (!room || room.phase !== 'GAME_OVER') return;
      const player = room.players.get(member.playerId);
      if (!player || !player.isHost) return;
      resetRoomToLobby(room);
    });

    // Ready Check during Day Phase -> advances to Room Lynching Vote when 100% ready
    socket.on('player:toggleReady', () => {
      const member = socketToMembership.get(socket.id);
      if (!member) return;
      const room = rooms.get(member.roomCode);
      if (!room || room.phase !== 'DAY') return;
      const player = room.players.get(member.playerId);
      if (!player || !player.alive) return;

      player.readyToVote = !player.readyToVote;
      broadcastRoomState(room);
      checkAllReadyToVote(room);
      if (player.readyToVote) {
        accelerateBotsReadyIfHumansReady(room);
      }
    });

    // 3-MODE DAY VOTE: Open 1 Room / Lock Down 1 Floor / Lock Down 1 Column / SKIP
    socket.on(
      'vote:castRoom',
      (payload: {
        kind?: DayVoteKind;
        room?: number | 'SKIP';
        floor?: number;
        column?: number;
      }) => {
        const member = socketToMembership.get(socket.id);
        if (!member) return;
        const room = rooms.get(member.roomCode);
        if (!room || room.phase !== 'VOTE') return;
        const player = room.players.get(member.playerId);
        if (!player || !player.alive) return;

        let nextChoice: DayVoteChoice | null = null;
        if (payload?.kind === 'SKIP' || payload?.room === 'SKIP') {
          nextChoice = { kind: 'SKIP' };
        } else if (payload?.kind === 'FLOOR') {
          const floorNum = Number(payload.floor) as HotelFloorNumber;
          if (!getVotableFloors(room).includes(floorNum)) return;
          nextChoice = { kind: 'FLOOR', floor: floorNum };
        } else if (payload?.kind === 'COLUMN') {
          const colNum = Number(payload.column) as HotelColumnNumber;
          if (!getVotableColumns(room).includes(colNum)) return;
          nextChoice = { kind: 'COLUMN', column: colNum };
        } else {
          const roomNum = Number(payload?.room) as HotelRoomNumber;
          if (!HOTEL_ROOMS.includes(roomNum) || room.revealedRooms.has(roomNum)) return;
          nextChoice = { kind: 'ROOM', room: roomNum };
        }

        const wasUnvoted = player.dayVote === null;
        player.dayVote = nextChoice;
        const voteLabel = formatDayVoteLabel(serializeDayVote(nextChoice));

        if (wasUnvoted) {
          room.historyLog.push(`โหวตวันที่ ${room.day}: ${player.name} เลือก ${voteLabel}`);
          pushChat(room, {
            senderId: 'SYSTEM',
            senderName: 'หีบลงคะแนน',
            isSystem: true,
            isBot: false,
            text: `${player.name} ลงคะแนนโหวตแล้ว`,
            kind: 'VOTE',
          });
        }

        broadcastRoomState(room);
        checkAllVotedRoom(room);
        accelerateBotsRoomVoteIfHumansVoted(room);
      }
    );

    socket.on('chat:send', (payload: { text?: string }) => {
      const member = socketToMembership.get(socket.id);
      if (!member) return;
      const room = rooms.get(member.roomCode);
      if (!room || (room.phase !== 'DAY' && room.phase !== 'VOTE')) return;
      const player = room.players.get(member.playerId);
      if (!player || !player.alive) return;

      const cleanText = String(payload?.text ?? '').trim().slice(0, 220);
      if (!cleanText) return;

      pushChat(room, {
        senderId: player.id,
        senderName: player.name,
        isSystem: false,
        isBot: false,
        text: cleanText,
        kind: 'CHAT',
      });

      const now = Date.now();
      if (now - room.lastHumanReplyAt > 4200 && room.botChatterCountThisPhase < 10) {
        room.lastHumanReplyAt = now;
        const aliveBots = shuffle(getAlivePlayers(room).filter((p) => p.isBot));
        const responderCount = Math.min(aliveBots.length, Math.random() < 0.45 ? 2 : 1);
        for (let i = 0; i < responderCount; i++) {
          const responder = aliveBots[i];
          room.botChatterCountThisPhase += 1;
          scheduleRoomTimer(
            room,
            () => {
              void triggerSingleBotChat(room, responder, 'HUMAN_REPLY', {
                senderName: player.name,
                text: cleanText,
              });
            },
            1600 + i * 2400 + Math.floor(Math.random() * 1300)
          );
        }
      }
    });

    // SECRET KILLER & ACCOMPLICE UNDERGROUND NIGHT CHAT
    socket.on('secretChat:send', (payload: { text?: string }) => {
      const member = socketToMembership.get(socket.id);
      if (!member) return;
      const room = rooms.get(member.roomCode);
      if (!room || room.phase !== 'NIGHT') return;
      const player = room.players.get(member.playerId);
      if (!player || !player.alive || !player.role) return;
      if (ROLE_DEFINITIONS[player.role].faction !== 'EVIL') return;

      const cleanText = String(payload?.text ?? '').trim().slice(0, 200);
      if (!cleanText) return;
      pushSecretEvilChat(room, player, cleanText);
    });

    // ACCOMPLICE SIGNAL / PING TARGET TO MURDERER (ROOM, FLOOR, OR PLAYER)
    socket.on(
      'night:pingTarget',
      (payload: {
        kind?: 'ROOM' | 'FLOOR' | 'PLAYER';
        room?: number;
        floor?: number;
        playerId?: string;
      }) => {
        const member = socketToMembership.get(socket.id);
        if (!member) return;
        const room = rooms.get(member.roomCode);
        if (!room || room.phase !== 'NIGHT') return;
        const player = room.players.get(member.playerId);
        if (!player || !player.alive || player.role !== 'ACCOMPLICE') return;

        if (payload?.kind === 'ROOM') {
          const roomNum = Number(payload.room) as HotelRoomNumber;
          if (!HOTEL_ROOMS.includes(roomNum) || room.revealedRooms.has(roomNum)) return;
          broadcastSecretPing(room, {
            senderName: player.name,
            kind: 'ROOM',
            room: roomNum,
            floor: null,
            playerId: null,
            playerName: null,
            timestamp: Date.now(),
          });
        } else if (payload?.kind === 'FLOOR') {
          const floorNum = Number(payload.floor) as HotelFloorNumber;
          if (!HOTEL_FLOORS.includes(floorNum)) return;
          broadcastSecretPing(room, {
            senderName: player.name,
            kind: 'FLOOR',
            room: null,
            floor: floorNum,
            playerId: null,
            playerName: null,
            timestamp: Date.now(),
          });
        } else if (payload?.kind === 'PLAYER' && payload.playerId) {
          const target = room.players.get(String(payload.playerId));
          if (!target || !target.alive) return;
          broadcastSecretPing(room, {
            senderName: player.name,
            kind: 'PLAYER',
            room: null,
            floor: null,
            playerId: target.id,
            playerName: target.name,
            timestamp: Date.now(),
          });
        }
      }
    );

    socket.on('night:action', (payload: { target?: number | string }) => {
      const member = socketToMembership.get(socket.id);
      if (!member) return;
      const room = rooms.get(member.roomCode);
      if (!room || room.phase !== 'NIGHT') return;
      const player = room.players.get(member.playerId);
      if (!player || !player.alive) return;

      applyNightAction(room, player, payload?.target ?? null);
    });

    socket.on('room:leave', () => handleDisconnect(socket.id));
    socket.on('disconnect', () => handleDisconnect(socket.id));
  });

  function handleDisconnect(socketId: string): void {
    const member = socketToMembership.get(socketId);
    if (!member) return;
    socketToMembership.delete(socketId);

    const room = rooms.get(member.roomCode);
    if (!room) return;
    const player = room.players.get(member.playerId);
    if (!player) return;

    if (room.phase === 'LOBBY') {
      room.players.delete(player.id);
      const remainingHumans = Array.from(room.players.values()).filter((p) => !p.isBot);
      if (remainingHumans.length === 0) {
        clearRoomTimers(room);
        rooms.delete(room.roomCode);
        return;
      }
      if (player.isHost) remainingHumans[0].isHost = true;
      broadcastRoomState(room);
      return;
    }

    player.connected = false;
    player.socketId = null;

    if (room.phase === 'DAY' && player.alive && !player.readyToVote) {
      scheduleRoomTimer(
        room,
        () => {
          if (!player.connected && room.phase === 'DAY' && player.alive) {
            player.readyToVote = true;
            broadcastRoomState(room);
            checkAllReadyToVote(room);
          }
        },
        12000
      );
    }

    const connectedHumans = Array.from(room.players.values()).filter(
      (p) => !p.isBot && p.connected
    );
    if (connectedHumans.length === 0) {
      scheduleRoomTimer(
        room,
        () => {
          const stillEmpty = Array.from(room.players.values()).every((p) => p.isBot || !p.connected);
          if (stillEmpty) {
            clearRoomTimers(room);
            rooms.delete(room.roomCode);
          }
        },
        45000
      );
    } else if (player.isHost) {
      player.isHost = false;
      connectedHumans[0].isHost = true;
    }

    broadcastRoomState(room);
  }

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[HOTEL MURDER] Server listening on http://0.0.0.0:${PORT} (${IS_PRODUCTION ? 'production' : 'development'})`
    );
  });
}

startServer().catch((err) => {
  console.error('[HOTEL MURDER] Fatal startup error:', err);
  process.exit(1);
});
