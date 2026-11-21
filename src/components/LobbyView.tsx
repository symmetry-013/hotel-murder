import { useState, type FormEvent } from 'react';
import {
  Check,
  Copy,
  Crown,
  LogOut,
  Play,
  Users,
  Volume2,
  VolumeX,
  Bot,
  UserPlus,
} from 'lucide-react';
import type { RoomStatePayload, RoleId } from '../shared/gameTypes';
import {
  getMaxDaysForPlayerCount,
  getRoleDistribution,
  ROLE_DEFINITIONS,
} from '../shared/gameTypes';
import { TitleLogo } from './TitleLogo';

const HOTEL_EXTERIOR_ART = '/src/assets/images/hotel_noir_exterior_1795239507755.jpg';

interface LobbyViewProps {
  roomState: RoomStatePayload | null;
  myPlayerId: string | null;
  inviteRoomCode: string | null;
  inviteRoomExists: boolean | null;
  initialNickname: string;
  errorMessage: string | null;
  busy: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onCreateRoom: (nickname: string, maxPlayers: number) => void;
  onJoinRoom: (roomCode: string, nickname: string) => void;
  onClearInvite: () => void;
  onUpdateMaxPlayers: (count: number) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

export function LobbyView({
  roomState,
  myPlayerId,
  inviteRoomCode,
  inviteRoomExists,
  initialNickname,
  errorMessage,
  busy,
  muted,
  onToggleMute,
  onCreateRoom,
  onJoinRoom,
  onClearInvite,
  onUpdateMaxPlayers,
  onStartGame,
  onLeaveRoom,
}: LobbyViewProps) {
  const [nickname, setNickname] = useState(initialNickname);
  const [manualCode, setManualCode] = useState(inviteRoomCode ?? '');
  const [createMaxPlayers, setCreateMaxPlayers] = useState(8);
  const [mode, setMode] = useState<'CREATE' | 'JOIN'>(inviteRoomCode ? 'JOIN' : 'CREATE');
  const [copied, setCopied] = useState(false);

  const me = roomState?.players.find((p) => p.id === myPlayerId) ?? null;
  const isHost = Boolean(me?.isHost);

  const handleEntrySubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanName = nickname.trim();
    if (!cleanName || busy) return;

    if (inviteRoomCode || mode === 'JOIN') {
      const code = (inviteRoomCode ?? manualCode).trim().toUpperCase();
      if (!code) return;
      onJoinRoom(code, cleanName);
    } else {
      onCreateRoom(cleanName, createMaxPlayers);
    }
  };

  const handleCopyInvite = async () => {
    if (!roomState) return;
    const url = `${window.location.origin}/?room=${roomState.roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2400);
  };

  if (!roomState) {
    const activeTargetCode = inviteRoomCode ?? manualCode;
    const createMaxDays = getMaxDaysForPlayerCount(createMaxPlayers);

    return (
      <div className="relative min-h-screen w-full overflow-hidden bg-[#0B0A0C] flex flex-col justify-between">
        <div className="pointer-events-none absolute inset-0 bg-[#0D0B0E]">
          <img
            src={HOTEL_EXTERIOR_ART}
            alt="โรงแรมมรณะยามค่ำคืน"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover object-right opacity-80"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(95deg, rgba(9,8,11,0.96) 0%, rgba(11,10,13,0.88) 44%, rgba(11,10,13,0.45) 75%, rgba(11,10,13,0.68) 100%)',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0A0C] via-transparent to-[#0B0A0C]/60" />
        </div>

        <div className="relative z-10 flex items-center justify-end p-4 sm:p-6">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'เปิดเสียงเอฟเฟกต์' : 'ปิดเสียงเอฟเฟกต์'}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#342A2F] bg-[#141117]/80 text-[#D6CFC7] hover:border-[#C8A25A] hover:text-[#F3DC9F] transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        <main className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8 pb-10 pt-2">
          <div className="max-w-[500px] space-y-6">
            <TitleLogo />

            <p className="text-sm sm:text-base leading-relaxed text-[#CFC8BF] max-w-[470px]">
              กติกาต้นฉบับ 100% — สุ่มห้องพักตายตัวห้ามย้ายตลอดเกม เปิดห้องพบศพตั้งต้น 3 ห้อง
              สืบเบาะแสแนวตั้ง–แนวนอน แล้วโหวตรุมประชาทัณฑ์หมายเลขห้องภายในเวลาจำกัด
            </p>

            <form
              onSubmit={handleEntrySubmit}
              className="rounded-xl border border-[#32292E] bg-[#141117]/92 p-5 sm:p-6 space-y-4 shadow-2xl"
            >
              {inviteRoomCode ? (
                <div className="space-y-1 pb-2 border-b border-[#272025]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-[#C8A25A]">ได้รับลิงก์เชิญเข้าห้องพัก</p>
                    <button
                      type="button"
                      onClick={() => {
                        onClearInvite();
                        setManualCode('');
                        setMode('CREATE');
                      }}
                      className="text-xs text-[#9D948A] hover:text-[#EAE4DC] underline underline-offset-4 cursor-pointer"
                    >
                      สร้างห้องเองแทน
                    </button>
                  </div>
                  <p className="font-mono-tabular text-xl font-semibold tracking-[0.2em] text-[#F5EFE6]">
                    {inviteRoomCode}
                  </p>
                  {inviteRoomExists === false && (
                    <p className="text-xs text-[#F87171]">
                      ไม่พบห้องนี้ในระบบ หรือห้องอาจปิดไปแล้ว
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-[#0E0C10] p-1 border border-[#251F24]">
                  <button
                    type="button"
                    onClick={() => setMode('CREATE')}
                    className={`min-h-[42px] rounded-md px-3 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      mode === 'CREATE'
                        ? 'bg-[#261F24] text-[#F3DC9F]'
                        : 'text-[#9D948A] hover:text-[#EAE4DC]'
                    }`}
                  >
                    สร้างห้องใหม่
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('JOIN')}
                    className={`min-h-[42px] rounded-md px-3 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      mode === 'JOIN'
                        ? 'bg-[#261F24] text-[#F3DC9F]'
                        : 'text-[#9D948A] hover:text-[#EAE4DC]'
                    }`}
                  >
                    เข้าร่วมด้วยรหัสห้อง
                  </button>
                </div>
              )}

              <div>
                <label
                  htmlFor="nickname-input"
                  className="block text-xs font-medium text-[#BDB5AC] mb-1.5"
                >
                  ชื่อเล่นของคุณ (Nickname)
                </label>
                <input
                  id="nickname-input"
                  type="text"
                  maxLength={20}
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="เช่น โบ๊ท, แนน, พี่เอก..."
                  className="w-full min-h-[46px] rounded-lg border border-[#352C31] bg-[#0E0C10] px-3.5 text-sm text-[#F5EFE6] placeholder:text-[#665F59] focus:border-[#C8A25A] focus:outline-none"
                />
              </div>

              {!inviteRoomCode && mode === 'JOIN' && (
                <div>
                  <label
                    htmlFor="room-code-input"
                    className="block text-xs font-medium text-[#BDB5AC] mb-1.5"
                  >
                    รหัสห้อง (Room ID)
                  </label>
                  <input
                    id="room-code-input"
                    type="text"
                    maxLength={8}
                    required
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    placeholder="กรอกรหัส 6 ตัว เช่น AB34XZ"
                    className="w-full min-h-[46px] rounded-lg border border-[#352C31] bg-[#0E0C10] px-3.5 font-mono-tabular text-sm tracking-[0.2em] text-[#F5EFE6] uppercase placeholder:tracking-normal placeholder:text-[#665F59] focus:border-[#C8A25A] focus:outline-none"
                  />
                </div>
              )}

              {!inviteRoomCode && mode === 'CREATE' && (
                <div>
                  <div className="flex items-center justify-between text-xs text-[#BDB5AC] mb-1.5">
                    <span>จำนวนผู้เล่นทั้งหมด (เติมบอท AI อัตโนมัติ)</span>
                    <span className="font-mono-tabular text-[#C8A25A] font-semibold">
                      {createMaxPlayers} คน · จำกัด {createMaxDays} วัน
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 6, 7, 8].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCreateMaxPlayers(num)}
                        className={`min-h-[44px] rounded-lg border font-mono-tabular text-sm font-semibold transition-colors cursor-pointer ${
                          createMaxPlayers === num
                            ? 'border-[#C8A25A] bg-[#282018] text-[#F3DC9F]'
                            : 'border-[#2D252A] bg-[#0F0D11] text-[#9D948A] hover:text-[#EAE4DC]'
                        }`}
                      >
                        {num} คน
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {errorMessage && (
                <p className="text-xs text-[#FCA5A5] bg-[#2B1216] border border-[#6E1F27] rounded-lg px-3 py-2">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  busy ||
                  !nickname.trim() ||
                  ((Boolean(inviteRoomCode) || mode === 'JOIN') && !activeTargetCode.trim())
                }
                className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-lg bg-[#C8A25A] px-5 py-2.5 text-sm font-bold text-[#120E09] hover:bg-[#DAB873] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
              >
                {inviteRoomCode || mode === 'JOIN' ? (
                  <>
                    <UserPlus className="h-4 w-4 shrink-0" />
                    <span>{busy ? 'กำลังเข้าห้อง...' : 'เข้าห้องพักทันที'}</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 shrink-0" />
                    <span>{busy ? 'กำลังสร้างห้อง...' : 'สร้างห้องใหม่'}</span>
                  </>
                )}
              </button>
            </form>

            <p className="text-xs text-[#8E867D] tracking-wide">
              7 ชั้น × 3 แถวตั้ง · ห้ามย้ายห้องตลอดเกม · 8 บทบาท 3 ฝ่าย (คนดี / ฆาตกร / คนเมา)
            </p>
          </div>
        </main>

        <div className="h-2" />
      </div>
    );
  }

  // Inside Waiting Room Lobby
  const humanPlayers = roomState.players.filter((p) => !p.isBot);
  const botFillCount = Math.max(0, roomState.maxPlayers - humanPlayers.length);
  const rolesPreview = getRoleDistribution(roomState.maxPlayers);
  const maxDays = getMaxDaysForPlayerCount(roomState.maxPlayers);

  return (
    <div className="relative min-h-screen w-full bg-[#0B0A0C] text-[#EAE4DC]">
      <div className="pointer-events-none fixed inset-0">
        <img
          src={HOTEL_EXTERIOR_ART}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B0A0C]/90 via-[#0B0A0C]/85 to-[#0B0A0C]" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 py-5 sm:py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#262025] pb-4">
          <TitleLogo compact />
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#30272C] bg-[#161218] text-[#CFC8BF] hover:border-[#C8A25A] transition-colors cursor-pointer"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onLeaveRoom}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#352A2F] bg-[#161218] px-3.5 text-xs font-medium text-[#CFC8BF] hover:border-[#A81C26] hover:text-[#FCA5A5] transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>ออกจากห้อง</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#332A2F] bg-[#151117]/95 p-5">
          <div>
            <p className="text-xs text-[#9D948A]">รหัสห้องพักล็อบบี้ · แชร์ให้เพื่อนเข้ามาร่วมวง</p>
            <p className="mt-1 font-mono-tabular text-3xl font-bold tracking-[0.22em] text-[#F3DC9F]">
              {roomState.roomCode}
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyInvite}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg border border-[#C8A25A]/70 bg-[#261E14] px-4 py-2.5 text-sm font-semibold text-[#F3DC9F] hover:bg-[#33281A] transition-colors cursor-pointer whitespace-nowrap"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-[#34D399]" />
                <span>คัดลอกลิงก์เชิญเพื่อนแล้ว!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>คัดลอกลิงก์เชิญเพื่อน</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-7 rounded-xl border border-[#2B2328] bg-[#141116]/95 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#241E23] pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#C8A25A]" />
                <h2 className="font-display text-base font-semibold text-[#F5EFE6]">
                  รายชื่อผู้เข้าพัก
                </h2>
              </div>
              <p className="font-mono-tabular text-xs text-[#9D948A]">
                คนจริง {humanPlayers.length} · บอท AI {botFillCount} · รวม {roomState.maxPlayers} คน
              </p>
            </div>

            <div className="divide-y divide-[#221C21]">
              {humanPlayers.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold text-sm text-white"
                      style={{ backgroundColor: p.avatarColor }}
                    >
                      {p.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#F5EFE6]">
                        {p.name}
                        {p.id === myPlayerId ? ' (คุณ)' : ''}
                      </p>
                      <p className="text-xs text-[#9D948A]">
                        {p.isHost ? 'หัวหน้าห้อง' : 'ผู้เล่น'}
                      </p>
                    </div>
                  </div>
                  {p.isHost && <Crown className="h-4 w-4 text-[#C8A25A] shrink-0" />}
                </div>
              ))}

              {Array.from({ length: botFillCount }).map((_, idx) => (
                <div
                  key={`bot-slot-${idx}`}
                  className="flex items-center justify-between py-2.5 opacity-75"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-[#43393F] bg-[#1A161D] text-[#9D948A]">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-[#CFC8BF]">บอท AI เพื่อนซี้ #{idx + 1}</p>
                      <p className="text-xs text-[#7E766E]">เติมเข้าห้องอัตโนมัติเมื่อเริ่มเกม</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-5 rounded-xl border border-[#2B2328] bg-[#141116]/95 p-5 space-y-5">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-[#F5EFE6]">
                  ตั้งค่าจำนวนผู้เล่น (5–8 คน)
                </h2>
                <span className="font-mono-tabular text-xs font-semibold text-[#E8C984]">
                  จำกัด {maxDays} วัน
                </span>
              </div>
              <p className="mt-1 text-xs text-[#9D948A]">
                5–6 คน เล่นสูงสุด 3 วัน · 7–8 คน เล่นสูงสุด 4 วัน · เปิดห้องพบศพตั้งต้น 3 ห้อง
              </p>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {[5, 6, 7, 8].map((num) => {
                  const disabled = !isHost || num < humanPlayers.length;
                  const active = roomState.maxPlayers === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      disabled={disabled}
                      onClick={() => onUpdateMaxPlayers(num)}
                      className={`min-h-[44px] rounded-lg border font-mono-tabular text-sm font-semibold transition-colors ${
                        active
                          ? 'border-[#C8A25A] bg-[#282016] text-[#F3DC9F]'
                          : 'border-[#2D252A] bg-[#100D12] text-[#9D948A]'
                      } ${
                        disabled
                          ? 'opacity-45 cursor-not-allowed'
                          : 'hover:border-[#C8A25A]/70 cursor-pointer'
                      }`}
                    >
                      {num} คน
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-[#241E23] pt-4">
              <p className="text-xs font-semibold text-[#C8A25A] mb-2.5">
                บทบาทลับต้นฉบับ ({rolesPreview.length} ใบ · ไม่ซ้ำกัน)
              </p>
              <div className="space-y-1.5 text-xs">
                {rolesPreview.map((roleId: RoleId) => {
                  const def = ROLE_DEFINITIONS[roleId];
                  const isEvil = def.faction === 'EVIL';
                  const isSpecial = def.faction === 'SPECIAL';
                  return (
                    <div key={roleId} className="flex items-center justify-between gap-2">
                      <span
                        className={
                          isEvil
                            ? 'text-[#FCA5A5] font-medium'
                            : isSpecial
                              ? 'text-[#D8B4FE] font-medium'
                              : 'text-[#E0D9D0]'
                        }
                      >
                        {def.nameTh} ({def.nameEn})
                      </span>
                      <span className="text-[11px] text-[#8E857D] shrink-0">
                        {isEvil ? 'ฝ่ายฆาตกร' : isSpecial ? 'ฝ่ายพิเศษ' : 'ฝ่ายผู้บริสุทธิ์'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              {isHost ? (
                <button
                  type="button"
                  onClick={onStartGame}
                  className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-lg bg-[#C8A25A] px-5 py-3 text-sm font-bold text-[#120E09] hover:bg-[#DAB873] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Play className="h-4 w-4" />
                  <span>เริ่มเกมทันที ({roomState.maxPlayers} คน)</span>
                </button>
              ) : (
                <div className="rounded-lg border border-[#2C2429] bg-[#100D12] px-4 py-3 text-center text-xs text-[#9D948A]">
                  รอหัวหน้าห้องกดเริ่มเกม...
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
