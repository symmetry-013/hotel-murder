import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  Bot,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Ghost,
  IdCard,
  MessageSquare,
  Moon,
  Search,
  Send,
  Shield,
  Skull,
  Sun,
  Users,
  Vote,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  DayVoteChoice,
  HotelColumnNumber,
  HotelFloorNumber,
  HotelRoomNumber,
  PrivatePlayerIntel,
  RoomStatePayload,
  SceneAnimationPayload,
  SecretChatMessage,
  SecretTargetPing,
} from './shared/gameTypes';
import {
  formatDayVoteLabel,
  ROLE_DEFINITIONS,
  serializeDayVote,
} from './shared/gameTypes';
import { soundEngine } from './utils/soundEngine';
import { TitleLogo } from './components/TitleLogo';
import { LobbyView } from './components/LobbyView';
import { HotelFloorplan } from './components/HotelFloorplan';
import {
  InvestigationLogBox,
  RoleCardContent,
  RoleCardModal,
  SecretRoleBar,
} from './components/RoleCardModal';
import { SceneAnimationOverlay } from './components/SceneAnimationOverlay';
import { SecretKillerComms } from './components/SecretKillerComms';
import { GameOverScreen } from './components/GameOverScreen';

const CORRIDOR_ART = '/src/assets/images/hotel_corridor_night_1795239505593.jpg';

type MobileTab = 'MAP' | 'CHAT' | 'ROLE';

function readInitialInviteCode(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('room')?.trim().toUpperCase();
  return raw && raw.length >= 4 ? raw : null;
}

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const prevPhaseRef = useRef<string | null>(null);

  const [roomState, setRoomState] = useState<RoomStatePayload | null>(null);
  const [intel, setIntel] = useState<PrivatePlayerIntel | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  const [inviteRoomCode, setInviteRoomCode] = useState<string | null>(() => readInitialInviteCode());
  const [inviteRoomExists, setInviteRoomExists] = useState<boolean | null>(null);
  const [savedNickname, setSavedNickname] = useState<string>(() => {
    try {
      return localStorage.getItem('hotel_murder_nickname') || '';
    } catch {
      return '';
    }
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [hiddenRole, setHiddenRole] = useState(false);
  const [sceneQueue, setSceneQueue] = useState<SceneAnimationPayload[]>([]);

  const [chatInput, setChatInput] = useState('');
  const [typingIndicator, setTypingIndicator] = useState<{
    botId: string;
    botName: string;
    text: string;
  } | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [accomplicePingMode, setAccomplicePingMode] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [mobileTab, setMobileTab] = useState<MobileTab>('MAP');
  const mobileTabRef = useRef<MobileTab>(mobileTab);
  mobileTabRef.current = mobileTab;

  // Establish Socket.io connection
  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      const urlCode = readInitialInviteCode();
      if (urlCode) {
        socket.emit('room:check', { roomCode: urlCode }, (res: { exists: boolean }) => {
          setInviteRoomExists(Boolean(res?.exists));
        });
      }
    });

    socket.on('room:state', (state: RoomStatePayload) => {
      setRoomState(state);
    });

    socket.on('player:intel', (data: PrivatePlayerIntel) => {
      setIntel(data);
    });

    socket.on('chat:message', (msg) => {
      setRoomState((prev) => {
        if (!prev) return prev;
        if (prev.chat.some((c) => c.id === msg.id)) return prev;
        return { ...prev, chat: [...prev.chat.slice(-90), msg] };
      });
      if (mobileTabRef.current !== 'CHAT') {
        setUnreadChatCount((n) => Math.min(99, n + 1));
      }
    });

    socket.on(
      'chat:typing',
      (payload: { botId: string; botName: string; text: string } | null) => {
        setTypingIndicator(payload);
      }
    );

    socket.on('secretChat:message', (smsg: SecretChatMessage) => {
      setIntel((prev) => {
        if (!prev) return prev;
        if (prev.secretChat.some((c) => c.id === smsg.id)) return prev;
        return { ...prev, secretChat: [...prev.secretChat.slice(-45), smsg] };
      });
    });

    socket.on('night:pingUpdate', (ping: SecretTargetPing) => {
      soundEngine.playSecretPing();
      setIntel((prev) => (prev ? { ...prev, secretPing: ping } : prev));
    });

    socket.on('scene:trigger', (payload: SceneAnimationPayload) => {
      setSceneQueue((prev) => {
        if (prev.some((s) => s.id === payload.id)) return prev;
        return [...prev, payload];
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Countdown clock
  useEffect(() => {
    if (!roomState?.phaseEndsAt) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [roomState?.phaseEndsAt]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomState?.chat.length, mobileTab]);

  // Clear unread badge when entering chat tab
  useEffect(() => {
    if (mobileTab === 'CHAT') {
      setUnreadChatCount(0);
    }
  }, [mobileTab]);

  // Phase transition SFX & responsive tab guidance
  useEffect(() => {
    const phase = roomState?.phase ?? null;
    if (!phase || phase === prevPhaseRef.current) return;
    const previous = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    if (phase === 'SETUP') {
      setRoleModalOpen(true);
      setTypingIndicator(null);
      soundEngine.playReadyChime();
    } else if (phase === 'DAY') {
      setAccomplicePingMode(false);
      setTypingIndicator(null);
      if (previous === 'SETUP') {
        setRoleModalOpen(false);
      } else if (previous === 'NIGHT') {
        soundEngine.playMorningChime(Boolean(roomState?.morningReport?.victimId));
      }
    } else if (phase === 'VOTE') {
      setAccomplicePingMode(false);
      soundEngine.playVoteGavel();
      setMobileTab('MAP');
    } else if (phase === 'VOTE_RESULT') {
      soundEngine.playVoteGavel();
    } else if (phase === 'NIGHT') {
      setAccomplicePingMode(false);
      soundEngine.playNightBell();
      setMobileTab('MAP');
    } else if (phase === 'GAME_OVER' && roomState?.winner) {
      soundEngine.playVictoryFanfare(roomState.winner);
    }
  }, [roomState?.phase, roomState?.morningReport?.victimId, roomState?.winner]);

  const me = useMemo(
    () => roomState?.players.find((p) => p.id === myPlayerId) ?? null,
    [roomState?.players, myPlayerId]
  );

  const secondsLeft = useMemo(() => {
    if (!roomState?.phaseEndsAt) return null;
    return Math.max(0, Math.ceil((roomState.phaseEndsAt - nowMs) / 1000));
  }, [roomState?.phaseEndsAt, nowMs]);

  const activeScene = sceneQueue[0] ?? null;

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  const persistNickname = (name: string) => {
    setSavedNickname(name);
    try {
      localStorage.setItem('hotel_murder_nickname', name);
    } catch {
      // ignore storage failure
    }
  };

  const handleCreateRoom = (nickname: string, maxPlayers: number) => {
    const socket = socketRef.current;
    if (!socket) return;
    setBusy(true);
    setErrorMessage(null);
    persistNickname(nickname);
    soundEngine.playClick();

    socket.emit(
      'room:create',
      { name: nickname, maxPlayers },
      (res: { ok: boolean; roomCode?: string; playerId?: string; error?: string }) => {
        setBusy(false);
        if (!res?.ok || !res.playerId || !res.roomCode) {
          setErrorMessage(res?.error ?? 'ไม่สามารถสร้างห้องได้');
          return;
        }
        setMyPlayerId(res.playerId);
        window.history.replaceState({}, '', `${window.location.pathname}?room=${res.roomCode}`);
      }
    );
  };

  const handleJoinRoom = (roomCode: string, nickname: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    setBusy(true);
    setErrorMessage(null);
    persistNickname(nickname);
    soundEngine.playClick();

    socket.emit(
      'room:join',
      { roomCode, name: nickname },
      (res: { ok: boolean; roomCode?: string; playerId?: string; error?: string }) => {
        setBusy(false);
        if (!res?.ok || !res.playerId || !res.roomCode) {
          setErrorMessage(res?.error ?? 'ไม่สามารถเข้าห้องได้');
          return;
        }
        setMyPlayerId(res.playerId);
        setInviteRoomCode(null);
        window.history.replaceState({}, '', `${window.location.pathname}?room=${res.roomCode}`);
      }
    );
  };

  const handleLeaveRoom = () => {
    soundEngine.playClick();
    socketRef.current?.emit('room:leave');
    setRoomState(null);
    setIntel(null);
    setMyPlayerId(null);
    setInviteRoomCode(null);
    setSceneQueue([]);
    setTypingIndicator(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  const handleToggleReady = () => {
    soundEngine.playReadyChime();
    socketRef.current?.emit('player:toggleReady');
  };

  const handleDayVote = (choice: DayVoteChoice) => {
    soundEngine.playVoteGavel();
    socketRef.current?.emit('vote:castRoom', choice);
  };

  const handleNightAction = (
    target: HotelRoomNumber | HotelFloorNumber | HotelColumnNumber | string
  ) => {
    soundEngine.playClick();
    socketRef.current?.emit('night:action', { target });
  };

  const handleAcknowledgeNight = () => {
    soundEngine.playReadyChime();
    socketRef.current?.emit('night:acknowledge');
  };

  const handleSendChat = (e: FormEvent) => {
    e.preventDefault();
    const clean = chatInput.trim();
    if (!clean || !me?.alive) return;
    socketRef.current?.emit('chat:send', { text: clean });
    setChatInput('');
  };

  const handleSendSecretChat = (text: string) => {
    socketRef.current?.emit('secretChat:send', { text });
  };

  const handleAccomplicePingRoom = (room: HotelRoomNumber) => {
    soundEngine.playSecretPing();
    socketRef.current?.emit('night:pingTarget', { kind: 'ROOM', room });
    setAccomplicePingMode(false);
  };

  const handleAccomplicePingFloor = (floor: HotelFloorNumber) => {
    soundEngine.playSecretPing();
    socketRef.current?.emit('night:pingTarget', { kind: 'FLOOR', floor });
  };

  const handleAccomplicePingPlayer = (playerId: string) => {
    soundEngine.playSecretPing();
    socketRef.current?.emit('night:pingTarget', { kind: 'PLAYER', playerId });
  };

  // Pre-game / Lobby View
  if (!roomState || roomState.phase === 'LOBBY') {
    return (
      <LobbyView
        roomState={roomState}
        myPlayerId={myPlayerId}
        inviteRoomCode={inviteRoomCode}
        inviteRoomExists={inviteRoomExists}
        initialNickname={savedNickname}
        errorMessage={errorMessage}
        busy={busy}
        muted={muted}
        onToggleMute={handleToggleMute}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onClearInvite={() => {
          setInviteRoomCode(null);
          window.history.replaceState({}, '', window.location.pathname);
        }}
        onUpdateMaxPlayers={(count) => {
          soundEngine.playClick();
          socketRef.current?.emit('room:updateConfig', { maxPlayers: count });
        }}
        onStartGame={() => {
          soundEngine.playClick();
          socketRef.current?.emit('game:start');
        }}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  // Post-Game Summary & AI Thoughts Screen
  if (roomState.phase === 'GAME_OVER') {
    return (
      <>
        {activeScene && (
          <SceneAnimationOverlay
            scene={activeScene}
            onComplete={() => setSceneQueue((q) => q.slice(1))}
          />
        )}
        <GameOverScreen
          roomState={roomState}
          myPlayerId={myPlayerId}
          onPlayAgain={() => {
            soundEngine.playClick();
            socketRef.current?.emit('game:playAgain');
          }}
        />
      </>
    );
  }

  const isNight = roomState.phase === 'NIGHT';
  const isDay = roomState.phase === 'DAY';
  const isVote = roomState.phase === 'VOTE';
  const isVoteResult = roomState.phase === 'VOTE_RESULT';
  const isSetup = roomState.phase === 'SETUP';

  const isAlive = Boolean(me?.alive);
  const canChat = isAlive && (isDay || isVote);
  const myRole = intel?.role ?? null;
  const myRoleDef = myRole ? ROLE_DEFINITIONS[myRole] : null;
  const isEvil = intel?.faction === 'EVIL';

  const isNightReview = isNight && roomState.nightStage === 'REVIEW';
  const totalFloors = roomState.totalFloors;

  const phaseLabel = isSetup
    ? 'กำลังสุ่มห้องพักและบทบาท'
    : isDay
      ? `กลางวัน · วันที่ ${roomState.day}/${roomState.maxDays}`
      : isVote
        ? roomState.day >= 3
          ? `โหวต 3 รูปแบบ · วันที่ ${roomState.day}/${roomState.maxDays}`
          : roomState.day === 2
            ? `โหวตห้อง / ปิดชั้น · วันที่ ${roomState.day}/${roomState.maxDays}`
            : `โหวตเปิดห้อง · วันที่ ${roomState.day}/${roomState.maxDays}`
        : isVoteResult
          ? `ผลโหวต · วันที่ ${roomState.day}/${roomState.maxDays}`
          : isNightReview
            ? `สรุปผลสกิลกลางคืน · คืนที่ ${roomState.day}/${roomState.maxDays}`
            : `กลางคืน · คืนที่ ${roomState.day}/${roomState.maxDays}`;

  const alivePlayers = roomState.players.filter((p) => p.alive);
  const myDayVote = intel?.myDayVote ?? null;
  const needsPlayerPickerAtNight =
    isNight && !isNightReview && isAlive && (myRole === 'DETECTIVE' || myRole === 'ACCOMPLICE');

  // Always-visible Evil Team Partner Banner (Murderer & Accomplice see each other from Game Start!)
  const evilPartnerBanner =
    isEvil && intel && intel.evilPartners.length > 0 ? (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#7A1E28] bg-[#241015]/95 px-4 py-2.5 text-xs sm:text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Skull className="h-4 w-4 text-[#F87171] shrink-0" />
          <span className="text-[#E5A3AB]">คู่หูฝ่ายฆาตกรของคุณ:</span>
          <strong className="truncate text-[#FFF1F2]">
            {intel.evilPartners
              .map((partner) => `${partner.name} (${ROLE_DEFINITIONS[partner.role].nameTh})`)
              .join(', ')}
          </strong>
        </div>
        <span className="text-[11px] text-[#FCA5A5]">
          {myRole === 'MURDERER'
            ? `กลางคืนเลือกฆ่าได้อย่างอิสระทั้ง ${totalFloors} ชั้น`
            : 'กลางคืนสืบชั้นเหยื่อทันทีแล้วส่งซิกในแชทลับ'}
        </span>
      </div>
    ) : null;

  // Night Action & Night Result Acknowledge Panel (shared between Desktop center & Mobile Tab 3)
  const nightActionBlock = isNight ? (
    <section className="rounded-xl border border-[#5B212A] bg-[#1A1015]/95 p-4 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Moon className="h-5 w-5 text-[#F87171] shrink-0" />
          <div>
            <h2 className="font-display text-base font-semibold text-[#F8F3EE]">
              {isNightReview
                ? `สรุปผลสกิลคืนที่ ${roomState.day} — ${myRoleDef?.nameTh ?? 'แขก'}`
                : `ปฏิบัติการกลางคืน — ${myRoleDef?.nameTh ?? 'แขก'}`}
            </h2>
            <p className="text-xs text-[#CFC8BF]">
              {!isAlive
                ? 'วิญญาณกำลังเฝ้ามองความมืดในโรงแรม...'
                : isNightReview
                  ? 'อ่านผลลัพธ์สกิลคืนนี้ให้เรียบร้อย แล้วกดปุ่ม "รับทราบข้อมูล" เพื่อเข้าสู่ช่วงเช้า'
                  : myRole === 'MURDERER'
                    ? `เลือกฆ่าได้อิสระทุกห้องที่ยังไม่ปิดทั่วทั้ง ${totalFloors} ชั้น (ห้ามเลือกห้องตัวเอง) — จะเชื่อซิกผู้ช่วยหรือเลือกเองก็ได้!`
                    : myRole === 'KEYMASTER'
                      ? intel?.lastKeymasterLockedRoom
                        ? `กดเลือก 1 ห้องบนแผนผังเพื่อล็อกป้องกันคืนนี้ (ห้ามล็อกห้อง ${intel.lastKeymasterLockedRoom} ซ้ำ!)`
                        : 'กดเลือก 1 ห้องบนแผนผังเพื่อล็อกป้องกันการฆ่าคืนนี้'
                      : myRole === 'HOUSEKEEPER'
                        ? `กดปุ่ม "ตรวจชั้น" ด้านซ้ายของแผนผัง (ชั้น 1–${totalFloors}) เพื่อนับคนรอดในชั้นนั้น`
                        : myRole === 'GLAZIER'
                          ? 'กดปุ่ม "ตรวจแถว" ด้านบนของแผนผัง (แถว 1–3) เพื่อนับคนรอดทั้งแถวแนวตั้ง'
                          : myRole === 'WITNESS'
                            ? `กดปุ่ม "เฝ้าชั้น" ด้านซ้ายของแผนผัง (ชั้น 1–${totalFloors}) — หากฆาตกรลงมือฆ่าคนในชั้นที่คุณเฝ้า คุณจะรู้ทิศทางชั้นของฆาตกร`
                            : myRole === 'DETECTIVE'
                              ? 'เลือกชื่อผู้เล่นที่ยังมีชีวิต 1 คนด้านล่างเพื่อสืบว่าพักอยู่ชั้นไหน (ไม่เปิดเผยฝ่ายหรือบทบาท)'
                              : myRole === 'ACCOMPLICE'
                                ? 'เลือกสืบชื่อผู้เล่น 1 คนด้านล่างเพื่อรู้ชั้นพักทันที! แล้วส่งซิกชี้เป้าชั้น/ห้องให้ฆาตกรในแชทลับ'
                                : 'คุณคือคนเมา — พักผ่อนคืนนี้ แล้วเตรียมปั่นให้ทุกคนโหวตห้อง/ชั้น/แถวคุณพรุ่งนี้!'}
            </p>
          </div>
        </div>

        <span className="font-mono-tabular text-xs text-[#C8A25A]">
          {isNightReview
            ? `รับทราบแล้ว ${roomState.nightAckCount}/${roomState.nightAckRequiredCount}`
            : `ใช้สกิล ${roomState.nightActionsSubmittedCount}/${roomState.nightActionsRequiredCount}`}
        </span>
      </div>

      {/* Mandatory Night Skill Result Review Card + Acknowledge Button */}
      {isAlive && intel?.latestNightResult && (
        <div
          className={`rounded-xl border p-4 space-y-3 ${
            intel.latestNightResult.tone === 'DANGER'
              ? 'border-[#8B2330] bg-[#281117]'
              : intel.latestNightResult.tone === 'SAFE'
                ? 'border-[#256D52] bg-[#10261E]'
                : 'border-[#6E5630] bg-[#221B12]'
          }`}
        >
          <div className="space-y-1">
            <p className="font-mono-tabular text-[11px] font-semibold uppercase tracking-wide text-[#E8C984]">
              ผลลัพธ์สกิลคืนที่ {intel.latestNightResult.night} · {intel.latestNightResult.title}
            </p>
            <p className="text-sm sm:text-base font-semibold leading-relaxed text-[#FFF9F2]">
              {intel.latestNightResult.detail}
            </p>
            <p className="text-[11px] text-[#BFB6AC]">
              ข้อมูลนี้ถูกบันทึกไว้ในสมุดบันทึกเบาะแสส่วนตัว (My Investigation Log) แล้ว
            </p>
          </div>

          <button
            type="button"
            disabled={intel.nightAcknowledged}
            onClick={handleAcknowledgeNight}
            className={`w-full min-h-[46px] flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${
              intel.nightAcknowledged
                ? 'border border-[#2A6F56] bg-[#122921] text-[#6EE7B7] cursor-default'
                : 'bg-[#C8A25A] text-[#120E09] hover:bg-[#DAB873] cursor-pointer'
            }`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              {intel.nightAcknowledged
                ? 'รับทราบข้อมูลแล้ว — กำลังรอผู้เล่นอื่นเข้าสู่ช่วงเช้า...'
                : 'รับทราบข้อมูล (Acknowledge)'}
            </span>
          </button>
        </div>
      )}

      {/* Detective & Accomplice Living-Player Picker (Reveals Player's Floor Only) */}
      {needsPlayerPickerAtNight && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#E8C984]">
            {myRole === 'ACCOMPLICE'
              ? 'สกิลผู้ช่วยฆาตกร — เลือกชื่อผู้เล่น 1 คนเพื่อสืบชั้นพักทันที:'
              : 'สกิลนักสืบ — เลือกชื่อผู้เล่น 1 คนเพื่อสืบชั้นพัก:'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {alivePlayers
              .filter(
                (p) =>
                  p.id !== myPlayerId &&
                  !(
                    myRole === 'ACCOMPLICE' &&
                    intel?.evilPartners.some((partner) => partner.id === p.id)
                  )
              )
              .map((target) => {
                const isPicked = intel?.selectedNightTarget === target.id;
                const locked = Boolean(intel?.nightActionSubmitted);
                return (
                  <button
                    key={target.id}
                    type="button"
                    disabled={locked}
                    onClick={() => handleNightAction(target.id)}
                    className={`min-h-[46px] flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      isPicked
                        ? 'border-[#C8A25A] bg-[#292014] text-[#F3DC9F]'
                        : 'border-[#352A30] bg-[#141016] text-[#EAE4DC] hover:border-[#C8A25A]/70'
                    } ${locked ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                  >
                    <span className="truncate font-semibold">{target.name}</span>
                    <Search className="h-4 w-4 shrink-0 text-[#C8A25A]" />
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {isAlive && !isNightReview && intel?.nightActionSubmitted && !intel?.latestNightResult && (
        <p className="text-xs font-semibold text-[#34D399]">
          ✓ ส่งคำสั่งกลางคืนเรียบร้อยแล้ว — กำลังรอผู้เล่นบทบาทอื่นสรุปผลสกิลคืนนี้...
        </p>
      )}
    </section>
  ) : null;

  const secretKillerCommsBlock =
    isNight && isAlive && isEvil && intel && myPlayerId ? (
      <SecretKillerComms
        intel={intel}
        myPlayerId={myPlayerId}
        alivePlayers={alivePlayers}
        totalFloors={totalFloors}
        pingModeActive={accomplicePingMode}
        onTogglePingMode={() => {
          const next = !accomplicePingMode;
          setAccomplicePingMode(next);
          if (next) setMobileTab('MAP');
        }}
        onSendSecretChat={handleSendSecretChat}
        onPingFloor={handleAccomplicePingFloor}
        onPingPlayer={handleAccomplicePingPlayer}
      />
    ) : null;

  // Progressive Day Vote Banner (Day 1: Room, Day 2: Room + Floor, Day 3+: Room + Floor + Column)
  const roomVoteBannerBlock = isVote ? (
    <section className="rounded-xl border border-[#7F1D1D] bg-[#241015]/95 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Vote className="h-5 w-5 text-[#F87171] shrink-0" />
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-[#F8F3EE]">
              {roomState.day >= 3
                ? 'โหวต 3 รูปแบบ: เปิด 1 ห้อง / ปิดตายทั้งชั้น / ปิดตายทั้งแถวแนวตั้ง'
                : roomState.day === 2
                  ? 'โหวตวันที่ 2: เปิด 1 ห้อง หรือ ปิดตายทั้งชั้นแนวนอน'
                  : 'โหวตวันที่ 1: เลือกเปิด 1 ห้อง (Room Vote)'}
            </h2>
            <p className="text-xs text-[#E5C6C9]">
              {roomState.day >= 3
                ? `ปลดล็อกครบทั้ง 3 รูปแบบแล้ว (เสียงสูงสุดชนะ) — การปิดตายชั้นหรือแถวจะกำจัดทุกคนในแนวนั้นทันที!${
                    roomState.day === roomState.maxDays ? ' (วันสุดท้ายแล้ว!)' : ''
                  }`
                : roomState.day === 2
                  ? 'ปลดล็อกโหวตปิดตายทั้งชั้นแนวนอนแล้ว! (โหวตปิดตายทั้งแถวแนวตั้งจะปลดล็อกในวันที่ 3)'
                  : 'วันที่ 1 โหวตเปิดได้เฉพาะรายห้อง — ปิดตายทั้งชั้นปลดล็อกวันที่ 2 และปิดตายทั้งแถวแนวตั้งปลดล็อกวันที่ 3'}
            </p>
          </div>
        </div>

        <span className="font-mono-tabular text-xs font-semibold text-[#F3DC9F]">
          โหวตแล้ว {roomState.votedCount}/{roomState.aliveCount} คน
        </span>
      </div>

      {isAlive && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#4B1920] pt-3">
          <p className="font-mono-tabular text-xs text-[#F5EFE6]">
            คะแนนของคุณตอนนี้:{' '}
            <strong className="text-[#FDE047]">
              {myDayVote ? formatDayVoteLabel(serializeDayVote(myDayVote)) : 'ยังไม่ได้เลือก'}
            </strong>
          </p>

          <button
            type="button"
            onClick={() => handleDayVote({ kind: 'SKIP' })}
            className={`min-h-[40px] rounded-lg border px-3.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              myDayVote?.kind === 'SKIP'
                ? 'border-[#C8A25A] bg-[#282015] text-[#F3DC9F]'
                : 'border-[#522028] bg-[#190D11] text-[#D6CFC7] hover:border-[#C8A25A]'
            }`}
          >
            {myDayVote?.kind === 'SKIP' ? '✓ งดออกเสียง (Skip)' : 'งดออกเสียง (Skip)'}
          </button>
        </div>
      )}
    </section>
  ) : null;

  // Player Roster Block (STRICT FOG OF WAR: never leaks living players' room numbers; Evil sees partner identity!)
  const rosterBlock = (
    <section className="rounded-xl border border-[#2C2429] bg-[#141116]/92 p-4 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#251F24] pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[#C8A25A]" />
          <h2 className="font-display text-base font-semibold text-[#F5EFE6]">
            รายชื่อแขกผู้เข้าพัก & สถานะ
          </h2>
        </div>

        <div className="font-mono-tabular text-xs text-[#9D948A]">
          {isDay && (
            <span>
              พร้อมโหวต{' '}
              <strong className="text-[#34D399]">
                {roomState.readyCount}/{roomState.aliveCount}
              </strong>{' '}
              คน
            </span>
          )}
          {isVote && (
            <span>
              โหวตแล้ว{' '}
              <strong className="text-[#E8C984]">
                {roomState.votedCount}/{roomState.aliveCount}
              </strong>{' '}
              คน
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {roomState.players.map((p) => {
          const isMe = p.id === myPlayerId;
          const evilPartnerMatch = isEvil
            ? intel?.evilPartners.find((partner) => partner.id === p.id) ?? null
            : null;

          return (
            <div
              key={p.id}
              className={`flex items-center justify-between gap-2.5 rounded-lg border px-3 py-2.5 ${
                !p.alive
                  ? 'border-[#221C20] bg-[#100D11] opacity-60'
                  : evilPartnerMatch
                    ? 'border-[#7A1E28] bg-[#241116]'
                    : 'border-[#2A2228] bg-[#1A151D]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                  style={{ backgroundColor: p.alive ? p.avatarColor : '#322B30' }}
                >
                  {p.alive ? p.name.slice(0, 1).toUpperCase() : <Skull className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`truncate text-sm font-semibold ${
                        !p.alive ? 'line-through text-[#8E857D]' : 'text-[#F5EFE6]'
                      }`}
                    >
                      {p.name}
                      {isMe ? ' (คุณ)' : ''}
                    </span>
                    {p.isBot && <Bot className="h-3 w-3 shrink-0 text-[#8D847C]" />}
                  </div>
                  <p className="font-mono-tabular text-[11px] text-[#9D948A]">
                    {p.alive ? (
                      isMe && intel?.myRoom ? (
                        `ห้องของคุณ: ${intel.myRoom}`
                      ) : evilPartnerMatch ? (
                        <span className="text-[#FCA5A5] font-semibold">
                          คู่หูฝ่ายฆาตกร · {ROLE_DEFINITIONS[evilPartnerMatch.role].nameTh}
                        </span>
                      ) : (
                        'ห้องพัก: ??? (ความลับ)'
                      )
                    ) : (
                      `เสียชีวิตแล้ว (DEAD) · ห้อง ${p.deathRoom ?? '?'} (ไม่เปิดเผยบทบาท)`
                    )}
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                {isDay && p.alive && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold ${
                      p.readyToVote ? 'text-[#34D399]' : 'text-[#736B65]'
                    }`}
                  >
                    {p.readyToVote ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>พร้อม</span>
                      </>
                    ) : (
                      <span>รอ...</span>
                    )}
                  </span>
                )}

                {isVote && p.alive && (
                  <span
                    className={`text-xs font-semibold ${
                      p.hasVotedRoom ? 'text-[#34D399]' : 'text-[#736B65]'
                    }`}
                  >
                    {p.hasVotedRoom ? '✓ โหวตแล้ว' : 'กำลังคิด...'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  // 100% Ready Check Footer during DAY -> transitions into VOTE phase
  const readyFooterBlock = isDay ? (
    <div className="border-t border-[#2E252A] bg-[#171219] p-3.5 space-y-2.5 shrink-0">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#CFC8BF]">
          {roomState.day >= 3
            ? 'กดพร้อมครบ 100% เพื่อเข้าช่วงโหวต 3 รูปแบบ (ห้อง/ชั้น/แถว)'
            : roomState.day === 2
              ? 'กดพร้อมครบ 100% เพื่อเข้าช่วงโหวตห้อง หรือ ปิดตายทั้งชั้น (วันที่ 2)'
              : 'กดพร้อมครบ 100% เพื่อเข้าช่วงโหวตเปิดห้อง (วันที่ 1)'}
        </span>
        <span className="font-mono-tabular font-semibold text-[#34D399]">
          พร้อมโหวต {roomState.readyCount}/{roomState.aliveCount} คน
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#262026]">
        <div
          className="h-full bg-[#34D399] transition-all duration-200"
          style={{
            width: `${
              roomState.aliveCount > 0
                ? Math.round((roomState.readyCount / roomState.aliveCount) * 100)
                : 0
            }%`,
          }}
        />
      </div>

      {isAlive ? (
        <button
          type="button"
          onClick={handleToggleReady}
          className={`w-full min-h-[48px] flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
            me?.readyToVote
              ? 'border border-[#2A6F56] bg-[#122921] text-[#6EE7B7] hover:bg-[#17362B]'
              : 'bg-[#C8A25A] text-[#120E09] hover:bg-[#DAB873]'
          }`}
        >
          {me?.readyToVote ? (
            <>
              <Check className="h-4 w-4" />
              <span>พร้อมโหวตแล้ว! (คลิกเพื่อยกเลิก)</span>
            </>
          ) : (
            <>
              <Vote className="h-4 w-4" />
              <span>พร้อมโหวต (Ready to Vote)</span>
            </>
          )}
        </button>
      ) : (
        <p className="text-center text-xs text-[#9D948A]">รอผู้รอดชีวิตทุกคนกดพร้อมโหวต...</p>
      )}
    </div>
  ) : null;

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-[#0B0A0C] text-[#EAE4DC]">
      {/* Subtle corridor backdrop */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <img
          src={CORRIDOR_ART}
          alt=""
          referrerPolicy="no-referrer"
          className={`h-full w-full object-cover transition-opacity duration-500 ${
            isNight ? 'opacity-30' : 'opacity-12'
          }`}
        />
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            background: isNight
              ? 'radial-gradient(circle at 50% 25%, rgba(120,16,24,0.22) 0%, rgba(10,8,12,0.92) 72%)'
              : 'linear-gradient(180deg, rgba(11,10,12,0.88) 0%, rgba(11,10,12,0.96) 100%)',
          }}
        />
      </div>

      {/* Contextual Full-Screen Animations */}
      {activeScene && (
        <SceneAnimationOverlay
          scene={activeScene}
          onComplete={() => setSceneQueue((q) => q.slice(1))}
        />
      )}

      {/* Secret Role Inspection Modal */}
      {intel && (
        <RoleCardModal
          intel={intel}
          open={roleModalOpen}
          onClose={() => setRoleModalOpen(false)}
        />
      )}

      {/* Compact Top Game HUD Header */}
      <header className="relative z-10 flex items-center justify-between gap-2 border-b border-[#272025] bg-[#110E13]/95 px-3.5 py-2 sm:px-6 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <TitleLogo compact />
          <span className="hidden md:inline text-[#3F363B]" aria-hidden="true">
            |
          </span>
          <div className="flex items-center gap-1.5 min-w-0 text-xs sm:text-sm">
            {isNight ? (
              <Moon className="h-4 w-4 text-[#F87171] shrink-0" />
            ) : isVote ? (
              <Vote className="h-4 w-4 text-[#F87171] shrink-0" />
            ) : (
              <Sun className="h-4 w-4 text-[#C8A25A] shrink-0" />
            )}
            <span className="truncate font-semibold text-[#F5EFE6] font-mono-tabular">
              {phaseLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
          {isDay && (
            <span className="font-mono-tabular text-xs text-[#34D399] font-semibold">
              ✓ {roomState.readyCount}/{roomState.aliveCount}
            </span>
          )}
          {isVote && (
            <span className="font-mono-tabular text-xs text-[#F3DC9F] font-semibold">
              โหวต {roomState.votedCount}/{roomState.aliveCount}
            </span>
          )}

          {secondsLeft !== null && (
            <div
              className={`flex items-center gap-1 font-mono-tabular text-xs sm:text-sm font-semibold ${
                secondsLeft <= 8 ? 'text-[#F87171]' : 'text-[#E8C984]'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>{secondsLeft}s</span>
            </div>
          )}

          <span className="hidden sm:inline font-mono-tabular text-xs text-[#9D948A]">
            รอด {roomState.aliveCount}/{roomState.players.length}
          </span>

          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#30272C] bg-[#18141A] text-[#CFC8BF] hover:border-[#C8A25A] transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* MAIN RESPONSIVE WORKSPACE */}
      <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col lg:grid lg:grid-cols-12 gap-4 p-3 sm:p-5 overflow-hidden">
        {/* DESKTOP LEFT/CENTER + MOBILE TAB 1 ('MAP') */}
        <div
          className={`lg:col-span-7 xl:col-span-8 flex-col gap-4 overflow-y-auto pr-0.5 ${
            mobileTab === 'MAP' ? 'flex flex-1 min-h-0' : 'hidden lg:flex lg:min-h-0'
          }`}
        >
          {!isAlive && (
            <div className="flex items-center gap-3 rounded-xl border border-[#47333B] bg-[#1B1318] px-4 py-3 text-sm text-[#D6CFC7]">
              <Ghost className="h-5 w-5 shrink-0 text-[#9D948A]" />
              <div>
                <p className="font-semibold text-[#EAE4DC]">สถานะวิญญาณผู้ชม (Spectator)</p>
                <p className="text-xs text-[#9D948A]">
                  คุณเสียชีวิตแล้ว สามารถดูเกมต่อจนจบและรอดูความคิด AI ได้
                </p>
              </div>
            </div>
          )}

          {/* Desktop compact role bar */}
          <div className="hidden lg:block">
            <SecretRoleBar
              intel={intel}
              hiddenRole={hiddenRole}
              onToggleHide={() => setHiddenRole((h) => !h)}
              onOpenModal={() => setRoleModalOpen(true)}
            />
          </div>

          {/* Always-visible Murderer & Accomplice Teammate Banner from Day 1 */}
          {evilPartnerBanner}

          {/* Morning Incident Report Banner */}
          {(isDay || isVote) && roomState.morningReport && (
            <section
              className={`rounded-xl border p-4 ${
                roomState.morningReport.victimId
                  ? 'border-[#7F1D1D] bg-[#241015]'
                  : 'border-[#574528] bg-[#1D1812]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-mono-tabular text-xs text-[#C8A25A]">
                    ข่าวด่วนประจำเช้าวันที่ {roomState.morningReport.day}
                  </p>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-[#F8F3EE]">
                    {roomState.morningReport.headline}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#D6CFC7]">
                    {roomState.morningReport.subtext}
                  </p>
                </div>
                {roomState.morningReport.victimId ? (
                  <Skull className="h-6 w-6 shrink-0 text-[#F87171]" />
                ) : (
                  <Shield className="h-6 w-6 shrink-0 text-[#C8A25A]" />
                )}
              </div>
            </section>
          )}

          {/* Vote Result Banner (Room Breach / Floor Lockdown / Column Lockdown) */}
          {isVoteResult && roomState.voteResolution && (
            <section className="rounded-xl border border-[#6E572C] bg-[#1E1812] p-4 space-y-2.5 animate-settle">
              <p className="text-xs text-[#C8A25A] font-semibold">
                สรุปผลโหวตประจำวัน · วันที่ {roomState.voteResolution.day}
              </p>
              <h2 className="font-display text-lg font-bold text-[#F8F3EE]">
                {roomState.voteResolution.summaryText}
              </h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#CFC8BF] pt-1">
                {roomState.voteResolution.tally.map((row) => (
                  <span key={row.voteKey} className="font-mono-tabular">
                    {row.label}: <strong className="text-[#F3DC9F]">{row.count}</strong> (
                    {row.voters.join(', ')})
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* 3-Mode Vote Banner (VOTE phase) */}
          {roomVoteBannerBlock}

          {/* Killer & Accomplice Secret Comms */}
          <div className="hidden lg:block">{secretKillerCommsBlock}</div>

          {/* Night Action Guidance / Detective & Accomplice Player Picker */}
          {nightActionBlock}

          {/* Dynamic Floor × 3-Column Interactive Hotel Map */}
          <HotelFloorplan
            phase={roomState.phase}
            day={roomState.day}
            totalFloors={totalFloors}
            revealedRooms={roomState.revealedRooms}
            lockedFloors={roomState.lockedFloors}
            lockedColumns={roomState.lockedColumns}
            me={me}
            intel={intel}
            accomplicePingMode={accomplicePingMode}
            onVoteRoom={(room) => handleDayVote({ kind: 'ROOM', room })}
            onVoteFloor={(floor) => handleDayVote({ kind: 'FLOOR', floor })}
            onVoteColumn={(column) => handleDayVote({ kind: 'COLUMN', column })}
            onNightSelectRoom={(room) => handleNightAction(room)}
            onNightSelectFloor={(floor) => handleNightAction(floor)}
            onNightSelectColumn={(col) => handleNightAction(col)}
            onAccomplicePingRoom={handleAccomplicePingRoom}
          />

          {/* Desktop Inline Personal Skill Log (My Investigation Log) */}
          {intel && (
            <div className="hidden lg:block">
              <InvestigationLogBox intel={intel} collapsible />
            </div>
          )}

          {/* Mobile quick Ready button on Map tab during Day */}
          <div className="lg:hidden rounded-xl overflow-hidden border border-[#2E252A]">
            {readyFooterBlock}
          </div>

          {/* Desktop Player Roster */}
          <div className="hidden lg:block">{rosterBlock}</div>
        </div>

        {/* MOBILE TAB 3 ('ROLE'): Dedicated Secret Role Card, Clue Log, Secret Comms, Roster */}
        <div
          className={`lg:hidden flex-col gap-4 overflow-y-auto pr-0.5 ${
            mobileTab === 'ROLE' ? 'flex flex-1 min-h-0' : 'hidden'
          }`}
        >
          {evilPartnerBanner}
          {secretKillerCommsBlock}
          {nightActionBlock}
          {roomVoteBannerBlock}
          {intel && (
            <section className="rounded-xl border border-[#2F262C] bg-[#141116]/95 p-4">
              <RoleCardContent intel={intel} compact />
            </section>
          )}
          {rosterBlock}
        </div>

        {/* DESKTOP RIGHT COLUMN + MOBILE TAB 2 ('CHAT'): Hallway Chat & 100% Ready Check */}
        <aside
          className={`lg:col-span-5 xl:col-span-4 flex-col rounded-xl border border-[#2C2429] bg-[#141116]/95 overflow-hidden ${
            mobileTab === 'CHAT' ? 'flex flex-1 min-h-0' : 'hidden lg:flex lg:min-h-0'
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#251F24] px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#C8A25A]" />
              <h2 className="font-display text-sm sm:text-base font-semibold text-[#F5EFE6]">
                แชทโถงกลางโรงแรม
              </h2>
            </div>
            <span className="font-mono-tabular text-xs text-[#9D948A]">
              ห้อง {roomState.roomCode}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5 min-h-0">
            {roomState.chat.map((msg) => {
              if (msg.isSystem) {
                const sysTone =
                  msg.kind === 'DEATH'
                    ? 'border-[#6E1F27] bg-[#231015] text-[#FCA5A5]'
                    : msg.kind === 'VOTE'
                      ? 'border-[#6E5428] bg-[#221A10] text-[#F3DC9F]'
                      : 'border-[#3A3022] bg-[#1B1712] text-[#E6CFA0]';
                return (
                  <div
                    key={msg.id}
                    className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${sysTone}`}
                  >
                    <span className="font-semibold mr-1.5">{msg.senderName}:</span>
                    <span>{msg.text}</span>
                  </div>
                );
              }

              const mine = msg.senderId === myPlayerId;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-[#9D948A] mb-0.5 px-1">
                    <span
                      className={
                        mine ? 'text-[#E8C984] font-semibold' : 'text-[#D6CFC7] font-semibold'
                      }
                    >
                      {msg.senderName}
                    </span>
                    {msg.isBot && <span>· AI</span>}
                  </div>
                  <div
                    className={`max-w-[88%] rounded-xl px-3.5 py-2 text-sm leading-relaxed ${
                      mine
                        ? 'bg-[#2C2318] border border-[#6E5630] text-[#FAF3E6]'
                        : 'bg-[#1D1821] border border-[#2D2530] text-[#EAE4DC]'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {typingIndicator && (isDay || isVote) && (
            <div className="flex items-center gap-2 border-t border-[#221C21] bg-[#130F15] px-4 py-1.5 text-xs text-[#C8A25A] shrink-0">
              <span className="inline-flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C8A25A] animate-bounce [animation-delay:-0.25s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#C8A25A] animate-bounce [animation-delay:-0.12s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#C8A25A] animate-bounce" />
              </span>
              <span className="truncate font-medium">{typingIndicator.text}</span>
            </div>
          )}

          <form
            onSubmit={handleSendChat}
            className="border-t border-[#251F24] bg-[#110E13] p-3 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              maxLength={220}
              disabled={!canChat}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={
                !isAlive
                  ? 'วิญญาณไม่สามารถพิมพ์แชทได้'
                  : isNight
                    ? 'ช่วงกลางคืน — งดคุยแชทสาธารณะ'
                    : isVoteResult
                      ? 'กำลังประกาศผลโหวต...'
                      : 'พิมพ์เสนอเปิดห้อง ปิดชั้น หรือปิดแถวแนวตั้ง...'
              }
              className="flex-1 min-h-[44px] rounded-lg border border-[#32292E] bg-[#0C0A0E] px-3.5 text-sm text-[#F5EFE6] placeholder:text-[#6B635D] focus:border-[#C8A25A] focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!canChat || !chatInput.trim()}
              aria-label="ส่งข้อความแชท"
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-lg bg-[#C8A25A] text-[#120E09] hover:bg-[#DAB873] disabled:opacity-40 cursor-pointer"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          {readyFooterBlock}
        </aside>
      </main>

      {/* MOBILE-FIRST 3-TAB BOTTOM NAVIGATION BAR */}
      <nav
        aria-label="แถบนำทางหลักบนมือถือ"
        className="relative z-20 grid grid-cols-3 border-t border-[#2C2429] bg-[#110E13]/98 lg:hidden shrink-0"
      >
        <button
          type="button"
          onClick={() => setMobileTab('MAP')}
          className={`min-h-[56px] flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer ${
            mobileTab === 'MAP'
              ? 'text-[#F3DC9F] border-t-2 border-[#C8A25A] bg-[#1A151C]'
              : 'text-[#9D948A]'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>แผนผัง {totalFloors} ชั้น</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('CHAT')}
          className={`relative min-h-[56px] flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer ${
            mobileTab === 'CHAT'
              ? 'text-[#F3DC9F] border-t-2 border-[#C8A25A] bg-[#1A151C]'
              : 'text-[#9D948A]'
          }`}
        >
          <div className="relative">
            <MessageSquare className="h-4 w-4" />
            {unreadChatCount > 0 && mobileTab !== 'CHAT' && (
              <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#DC2626] px-1 font-mono-tabular text-[10px] font-bold text-white">
                {unreadChatCount}
              </span>
            )}
          </div>
          <span>ห้องแชท</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('ROLE')}
          className={`relative min-h-[56px] flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer ${
            mobileTab === 'ROLE'
              ? 'text-[#F3DC9F] border-t-2 border-[#C8A25A] bg-[#1A151C]'
              : 'text-[#9D948A]'
          }`}
        >
          <div className="relative">
            <IdCard className="h-4 w-4" />
            {isNight && intel?.latestNightResult && !intel?.nightAcknowledged && (
              <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-[#F87171]" />
            )}
          </div>
          <span>บทบาท / เบาะแส</span>
        </button>
      </nav>
    </div>
  );
}
