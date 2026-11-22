export type RoleId =
  | 'KEYMASTER'
  | 'HOUSEKEEPER'
  | 'GLAZIER'
  | 'DETECTIVE'
  | 'WITNESS'
  | 'MURDERER'
  | 'ACCOMPLICE'
  | 'DRUNK';

export type Faction = 'GOOD' | 'EVIL' | 'SPECIAL';

export type GamePhase =
  | 'LOBBY'
  | 'SETUP'
  | 'DAY'
  | 'VOTE'
  | 'VOTE_RESULT'
  | 'NIGHT'
  | 'GAME_OVER';

export type DeathCause = 'MURDERED' | 'LYNCHED' | null;

export const HOTEL_FLOORS = [7, 6, 5, 4, 3, 2, 1] as const;
export type HotelFloorNumber = (typeof HOTEL_FLOORS)[number];

export const HOTEL_COLUMNS = [1, 2, 3] as const;
export type HotelColumnNumber = (typeof HOTEL_COLUMNS)[number];

export const HOTEL_ROOMS = [
  101, 102, 103,
  201, 202, 203,
  301, 302, 303,
  401, 402, 403,
  501, 502, 503,
  601, 602, 603,
  701, 702, 703,
] as const;
export type HotelRoomNumber = (typeof HOTEL_ROOMS)[number];

export function getFloorOfRoom(room: number): HotelFloorNumber {
  return Math.floor(room / 100) as HotelFloorNumber;
}

export function getColumnOfRoom(room: number): HotelColumnNumber {
  return (room % 10) as HotelColumnNumber;
}

export function getRoomsOnFloor(floor: HotelFloorNumber): HotelRoomNumber[] {
  return [floor * 100 + 1, floor * 100 + 2, floor * 100 + 3] as HotelRoomNumber[];
}

export function getFloorCountForPlayerCount(totalPlayers: number): number {
  return Math.max(4, Math.min(7, totalPlayers - 1));
}

export function getFloorsForCount(totalFloors: number): HotelFloorNumber[] {
  const clamped = Math.max(4, Math.min(7, totalFloors));
  return HOTEL_FLOORS.filter((f) => f <= clamped);
}

export function getRoomsForFloorCount(totalFloors: number): HotelRoomNumber[] {
  const clamped = Math.max(4, Math.min(7, totalFloors));
  return HOTEL_ROOMS.filter((r) => getFloorOfRoom(r) <= clamped);
}

export function getRoomsInColumn(col: HotelColumnNumber, totalFloors = 7): HotelRoomNumber[] {
  return getFloorsForCount(totalFloors).map((f) => (f * 100 + col) as HotelRoomNumber);
}

export function getMaxDaysForPlayerCount(totalPlayers: number): number {
  return totalPlayers <= 6 ? 3 : 4;
}

export type DayVoteKind = 'ROOM' | 'FLOOR' | 'COLUMN' | 'SKIP';

export type DayVoteChoice =
  | { kind: 'ROOM'; room: HotelRoomNumber }
  | { kind: 'FLOOR'; floor: HotelFloorNumber }
  | { kind: 'COLUMN'; column: HotelColumnNumber }
  | { kind: 'SKIP' };

export function serializeDayVote(choice: DayVoteChoice): string {
  if (choice.kind === 'ROOM') return `ROOM:${choice.room}`;
  if (choice.kind === 'FLOOR') return `FLOOR:${choice.floor}`;
  if (choice.kind === 'COLUMN') return `COLUMN:${choice.column}`;
  return 'SKIP';
}

export function formatDayVoteLabel(voteKey: string): string {
  if (voteKey === 'SKIP') return 'งดออกเสียง (Skip)';
  if (voteKey.startsWith('ROOM:')) return `เปิดห้อง ${voteKey.slice(5)}`;
  if (voteKey.startsWith('FLOOR:')) return `ปิดตายชั้น ${voteKey.slice(6)} (แนวนอน)`;
  if (voteKey.startsWith('COLUMN:')) return `ปิดตายแถว ${voteKey.slice(7)} (แนวตั้ง)`;
  return voteKey;
}

export interface RoleDefinition {
  id: RoleId;
  nameTh: string;
  nameEn: string;
  faction: Faction;
  shortAbilityTh: string;
  detailTh: string;
  hasNightAction: boolean;
  nightTargetType: 'ROOM' | 'FLOOR' | 'COLUMN' | 'PLAYER' | 'NONE';
}

export const ROLE_DEFINITIONS: Record<RoleId, RoleDefinition> = {
  KEYMASTER: {
    id: 'KEYMASTER',
    nameTh: 'ช่างกุญแจ',
    nameEn: 'Keymaster',
    faction: 'GOOD',
    shortAbilityTh: 'กลางคืนล็อก 1 ห้องป้องกันการฆ่า (ห้ามล็อกห้องซ้ำคืนก่อนหน้า)',
    detailTh:
      'ฝ่ายผู้บริสุทธิ์ — ช่วงกลางคืนเลือกกดล็อก 1 ห้องเพื่อปกป้อง (หากฆาตกรบุกห้องนี้จะไม่มีคนตาย) ข้อห้ามเด็ดขาด: ห้ามล็อกห้องเดิมซ้ำกับคืนก่อนหน้า!',
    hasNightAction: true,
    nightTargetType: 'ROOM',
  },
  HOUSEKEEPER: {
    id: 'HOUSEKEEPER',
    nameTh: 'แม่บ้าน',
    nameEn: 'Housekeeper',
    faction: 'GOOD',
    shortAbilityTh: 'กลางคืนตรวจ 1 ชั้น (แนวนอน) เพื่อรู้ว่ามีคนรอดอยู่กี่คนในชั้นนั้น',
    detailTh:
      'ฝ่ายผู้บริสุทธิ์ — ช่วงกลางคืนเลือกตรวจสอบ 1 ชั้นแนวนอน ระบบจะแจ้งผลลับเฉพาะคุณว่าในชั้นนั้นมีผู้เล่นที่ยังมีชีวิตเหลืออยู่กี่คน',
    hasNightAction: true,
    nightTargetType: 'FLOOR',
  },
  GLAZIER: {
    id: 'GLAZIER',
    nameTh: 'ช่างเช็ดกระจก',
    nameEn: 'Glazier',
    faction: 'GOOD',
    shortAbilityTh: 'กลางคืนตรวจ 1 แถว (แนวตั้ง 1-3) เพื่อรู้ว่ามีคนรอดอยู่กี่คนทั้งแถว',
    detailTh:
      'ฝ่ายผู้บริสุทธิ์ — ช่วงกลางคืนเลือกตรวจสอบ 1 แถวแนวตั้ง (แถว 1: x01, แถว 2: x02, แถว 3: x03) ระบบจะแจ้งผลลับว่าตลอดแนวตั้งทุกชั้นมีผู้เล่นรอดชีวิตอยู่กี่คน',
    hasNightAction: true,
    nightTargetType: 'COLUMN',
  },
  DETECTIVE: {
    id: 'DETECTIVE',
    nameTh: 'นักสืบ',
    nameEn: 'Detective',
    faction: 'GOOD',
    shortAbilityTh: 'กลางคืนเลือกชื่อผู้เล่น 1 คน เพื่อสืบว่าพักอยู่ที่ชั้นไหน (ไม่รู้ฝ่าย/บทบาท)',
    detailTh:
      'ฝ่ายผู้บริสุทธิ์ — คุณไม่รู้ว่าใครเป็นฆาตกรหรืออยู่ฝ่ายไหน แต่ช่วงกลางคืนสามารถเลือกชื่อผู้เล่นที่ยังมีชีวิต 1 คน เพื่อสืบและรู้ได้ว่าผู้เล่นคนนั้นพักอยู่ที่ชั้นไหน',
    hasNightAction: true,
    nightTargetType: 'PLAYER',
  },
  WITNESS: {
    id: 'WITNESS',
    nameTh: 'พยาน',
    nameEn: 'Witness',
    faction: 'GOOD',
    shortAbilityTh: 'กลางคืนเฝ้าดู 1 ชั้น หากมีคนถูกฆ่าชั้นนั้นจะรู้ว่าห้องฆาตกรอยู่ชั้นบน/ล่าง/ชั้นเดียวกัน',
    detailTh:
      'ฝ่ายผู้บริสุทธิ์ — ช่วงกลางคืนเลือกเฝ้าดู 1 ชั้น หากคืนนั้นฆาตกรลงมือฆ่าคนในชั้นเดียวกับที่คุณเฝ้า คุณจะได้เบาะแสลับว่าห้องพักของฆาตกรตัวจริงอยู่ "ชั้นบน (สูงกว่า)" หรือ "ชั้นล่าง (ต่ำกว่า)" หรือ "ชั้นเดียวกัน" (หากเฝ้าผิดชั้นหรือไม่มีคนตายจะไม่ได้เบาะแสใดๆ)',
    hasNightAction: true,
    nightTargetType: 'FLOOR',
  },
  MURDERER: {
    id: 'MURDERER',
    nameTh: 'ฆาตกร',
    nameEn: 'Murderer',
    faction: 'EVIL',
    shortAbilityTh: 'กลางคืนเลือกฆ่าได้อย่างอิสระทุกห้องทุกชั้น + เห็นตัวผู้ช่วยตั้งแต่เริ่มเกม',
    detailTh:
      'ฝ่ายฆาตกร — เห็นชื่อและบทบาทของผู้ช่วยฆาตกรตั้งแต่เริ่มเกม ช่วงกลางคืนคุณมีอิสระเต็มที่ในการเลือกสังหารห้องใดก็ได้ที่ยังไม่ถูกปิดทั่วทั้งโรงแรม (จะเชื่อซิกของผู้ช่วยหรือเลือกเองก็ได้ตามใจชอบ!)',
    hasNightAction: true,
    nightTargetType: 'ROOM',
  },
  ACCOMPLICE: {
    id: 'ACCOMPLICE',
    nameTh: 'ผู้ช่วยฆาตกร',
    nameEn: 'Accomplice',
    faction: 'EVIL',
    shortAbilityTh: 'เห็นตัวฆาตกรตั้งแต่เริ่มเกม + กลางคืนสืบชั้นเหยื่อทันทีแล้วส่งซิกให้ฆาตกร',
    detailTh:
      'ฝ่ายฆาตกร — เห็นชื่อและบทบาทของฆาตกรตั้งแต่เริ่มเกม ช่วงกลางคืนเลือกสืบชื่อผู้เล่น 1 คนเพื่อรู้ชั้นพักทันที พร้อมบันทึกในสมุดเบาะแส และใช้แชทลับใต้ดิน + ปุ่มส่งซิกชี้เป้าให้ฆาตกร!',
    hasNightAction: true,
    nightTargetType: 'PLAYER',
  },
  DRUNK: {
    id: 'DRUNK',
    nameTh: 'คนเมา',
    nameEn: 'Drunk',
    faction: 'SPECIAL',
    shortAbilityTh: 'ฝ่ายพิเศษ: ปั่นให้คนโหวตห้อง/ชั้น/แถวที่มีคุณอยู่เพื่อชนะเดี่ยวทันที!',
    detailTh:
      'ฝ่ายพิเศษ / จอมป่วน — ไม่ขึ้นกับฝ่ายไหน เป้าหมายเดียวคือปั่นแชทให้คนอื่นโหวตเปิดห้องคุณ หรือโหวตปิดตายชั้น/แถวที่คุณอยู่ให้ได้ (โดยไม่มีฆาตกรโดนไปด้วย) คุณจะชนะเพียงคนเดียวทันที! (หากโดนฆาตกรฆ่าตอนกลางคืนถือว่าแพ้)',
    hasNightAction: false,
    nightTargetType: 'NONE',
  },
};

export function getRoleDistribution(totalPlayers: number): RoleId[] {
  const clamped = Math.max(5, Math.min(8, totalPlayers));
  const ordered: RoleId[] = [
    'MURDERER',
    'KEYMASTER',
    'HOUSEKEEPER',
    'GLAZIER',
    'DETECTIVE',
    'ACCOMPLICE',
    'WITNESS',
    'DRUNK',
  ];
  return ordered.slice(0, clamped);
}

export type RevealedRoomKind =
  | 'INITIAL_CRIME'
  | 'EMPTY_LYNCHED'
  | 'LYNCHED_PLAYER'
  | 'MURDERED_PLAYER'
  | 'LOCKED_EMPTY'
  | 'LOCKED_PLAYER';

export interface RevealedRoomInfo {
  room: HotelRoomNumber;
  kind: RevealedRoomKind;
  day: number;
  occupantName?: string;
  /** NEVER populated during gameplay — revealed ONLY at GAME_OVER! */
  occupantRole?: RoleId;
}

/**
 * STRICT FOG OF WAR & NO ROLE REVEAL ON DEATH:
 * PublicPlayer NEVER exposes another living player's fixed room/floor,
 * and NEVER exposes ANY player's role (alive or dead) until GAME_OVER!
 */
export interface PublicPlayer {
  id: string;
  name: string;
  isBot: boolean;
  isHost: boolean;
  connected: boolean;
  alive: boolean;
  readyToVote: boolean;
  hasVotedRoom: boolean;
  votedSummary: string | null; // revealed only on VOTE_RESULT / GAME_OVER
  deathCause: DeathCause;
  deathDay: number | null;
  deathRoom: HotelRoomNumber | null;
  revealedRole: RoleId | null; // ONLY revealed at GAME_OVER!
  finalRoom: HotelRoomNumber | null; // ONLY revealed at GAME_OVER!
  avatarColor: string;
}

export interface SecretChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  isBot: boolean;
  text: string;
  timestamp: number;
}

export interface SecretTargetPing {
  senderName: string;
  kind: 'ROOM' | 'FLOOR' | 'PLAYER';
  room: HotelRoomNumber | null;
  floor: HotelFloorNumber | null;
  playerId: string | null;
  playerName: string | null;
  timestamp: number;
}

export interface PrivateClueLog {
  id: string;
  night: number;
  category:
    | 'HOUSEKEEPER'
    | 'GLAZIER'
    | 'DETECTIVE'
    | 'WITNESS'
    | 'ACCOMPLICE'
    | 'KEYMASTER'
    | 'MURDERER';
  title: string;
  detail: string;
  tone?: 'DANGER' | 'SAFE' | 'INFO';
}

export interface PrivatePlayerIntel {
  playerId: string;
  role: RoleId | null;
  faction: Faction | null;
  myRoom: HotelRoomNumber | null;
  myFloor: HotelFloorNumber | null;
  myColumn: HotelColumnNumber | null;
  evilPartners: Array<{ id: string; name: string; role: RoleId }>;
  nightActionSubmitted: boolean;
  nightAcknowledged: boolean;
  latestNightResult: PrivateClueLog | null;
  selectedNightTarget: number | string | null;
  lastKeymasterLockedRoom: HotelRoomNumber | null;
  myDayVote: DayVoteChoice | null;
  secretChat: SecretChatMessage[];
  secretPing: SecretTargetPing | null;
  clueLogs: PrivateClueLog[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  isSystem: boolean;
  isBot: boolean;
  text: string;
  phase: GamePhase;
  day: number;
  timestamp: number;
  kind?: 'CHAT' | 'ALERT' | 'VOTE' | 'DEATH';
}

export interface MorningReport {
  day: number;
  victimId: string | null;
  victimName: string | null;
  victimRole: RoleId | null; // ALWAYS null during gameplay (no role reveal on death!)
  crimeRoom: HotelRoomNumber | null;
  crimeFloor: HotelFloorNumber | null;
  lockSaved: boolean;
  headline: string;
  subtext: string;
}

export interface VoteResolution {
  day: number;
  winnerKind: DayVoteKind;
  lynchedRoom: HotelRoomNumber | null;
  lockedFloor: HotelFloorNumber | null;
  lockedColumn: HotelColumnNumber | null;
  affectedRooms: HotelRoomNumber[];
  eliminatedPlayers: Array<{
    id: string;
    name: string;
    room: HotelRoomNumber;
  }>;
  wasEmpty: boolean;
  isTie: boolean;
  skipWon: boolean;
  tally: Array<{ voteKey: string; label: string; count: number; voters: string[] }>;
  summaryText: string;
}

export interface BotPostGameThought {
  botId: string;
  botName: string;
  role: RoleId;
  alive: boolean;
  thought: string;
  provider?: 'groq' | 'gemini';
}

export type NightStage = 'ACTION' | 'REVIEW';

export interface RoomStatePayload {
  roomCode: string;
  phase: GamePhase;
  nightStage: NightStage;
  day: number;
  maxDays: number;
  maxPlayers: number;
  totalFloors: number;
  phaseEndsAt: number | null;
  revealedRooms: RevealedRoomInfo[];
  lockedFloors: HotelFloorNumber[];
  lockedColumns: HotelColumnNumber[];
  players: PublicPlayer[];
  chat: ChatMessage[];
  morningReport: MorningReport | null;
  voteResolution: VoteResolution | null;
  winner: Faction | null;
  winnerPlayerName: string | null;
  winReason: string | null;
  aiThoughts: BotPostGameThought[];
  aiThoughtsLoading: boolean;
  readyCount: number;
  aliveCount: number;
  votedCount: number;
  nightActionsSubmittedCount: number;
  nightActionsRequiredCount: number;
  nightAckCount: number;
  nightAckRequiredCount: number;
}

export type SceneAnimationType =
  | 'KILLED'
  | 'SAVED_BY_LOCKSMITH'
  | 'CLUE_DISCOVERED'
  | 'ROOM_LYNCHED';

export interface SceneAnimationPayload {
  id: string;
  type: SceneAnimationType;
  title: string;
  subtitle: string;
  detail?: string;
  room?: HotelRoomNumber | null;
  floor?: HotelFloorNumber | null;
  column?: HotelColumnNumber | null;
  lockdownMode?: 'ROOM' | 'FLOOR' | 'COLUMN';
  day: number;
  isVictimMe?: boolean;
}
