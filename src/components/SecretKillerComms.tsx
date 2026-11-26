import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Crosshair, Layers, Radio, Send, Skull } from 'lucide-react';
import type {
  HotelColumnNumber,
  HotelFloorNumber,
  PrivatePlayerIntel,
  PublicPlayer,
  RoleId,
} from '../shared/gameTypes';
import { getFloorsForCount, HOTEL_COLUMNS, ROLE_DEFINITIONS } from '../shared/gameTypes';

interface SecretKillerCommsProps {
  intel: PrivatePlayerIntel;
  myPlayerId: string;
  totalFloors: number;
  alivePlayers: PublicPlayer[];
  pingModeActive: boolean;
  onTogglePingMode: () => void;
  onSendSecretChat: (text: string) => void;
  onPingFloor: (floor: HotelFloorNumber) => void;
  onPingPlayer: (playerId: string) => void;
  onInspectPlayer?: (playerId: string) => void;
  onPingJam?: (kind: 'FLOOR' | 'COLUMN', value: number) => void;
  onShadowJamAction?: (target: string) => void;
}

function getEvilRoleBadge(role?: RoleId): string {
  if (role === 'MURDERER') return '[ฆาตกร]';
  if (role === 'ACCOMPLICE') return '[ผู้ช่วย]';
  if (role === 'SHADOW_ASSASSIN') return '[นักฆ่าเงา]';
  return '';
}

export function SecretKillerComms({
  intel,
  myPlayerId,
  totalFloors,
  alivePlayers,
  pingModeActive,
  onTogglePingMode,
  onSendSecretChat,
  onPingFloor,
  onPingPlayer,
  onInspectPlayer,
  onPingJam,
  onShadowJamAction,
}: SecretKillerCommsProps) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [intel.secretChat.length]);

  const isAccomplice = intel.role === 'ACCOMPLICE';
  const isShadow = intel.role === 'SHADOW_ASSASSIN';
  const jamPing = intel.jamPing;
  const partnerDesc =
    intel.evilPartners
      .map(
        (p) =>
          `${p.name} (${ROLE_DEFINITIONS[p.role].nameTh}${p.room ? ` · ห้อง ${p.room}` : ''})`
      )
      .join(', ') || 'ไม่มี';
  const ping = intel.secretPing;
  const latestAccompliceClue = isAccomplice
    ? [...intel.clueLogs].reverse().find((c) => c.category === 'ACCOMPLICE') ?? null
    : null;
  const activeFloorsAsc = [...getFloorsForCount(totalFloors)].reverse();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    onSendSecretChat(clean);
    setText('');
  };

  return (
    <section
      aria-label="แชทลับใต้ดินฝ่ายฆาตกร"
      className="rounded-xl border border-[#7A1E28] bg-[#1C0D12]/95 p-4 space-y-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#47171E] pb-2.5">
        <div className="flex items-center gap-2">
          <Skull className="h-4 w-4 text-[#F87171] shrink-0" />
          <div>
            <h3 className="font-display text-sm sm:text-base font-bold text-[#FECACA]">
              แชทลับใต้ดิน (Secret Killer Chat)
            </h3>
            <p className="text-[11px] text-[#E5A3AB]">
              คู่หูของคุณ: <strong className="text-[#FFF1F2]">{partnerDesc}</strong> ·
              คนอื่นมองไม่เห็น
            </p>
          </div>
        </div>
      </div>

      {/* Murderer Complete Targeting Freedom Note */}
      {intel.role === 'MURDERER' && (
        <p className="text-xs text-[#F5C6CB] rounded-lg border border-[#4D1A22] bg-[#150A0E] px-3 py-2">
          ฆาตกรมีอิสระเต็มที่ในการจิ้มฆ่า{' '}
          <strong className="text-[#FDE047]">ทุกห้องที่ยังไม่ปิดทั่วทั้ง {totalFloors} ชั้น</strong>{' '}
          — จะฆ่าตามซิกของผู้ช่วย หรือเลือกฆ่าห้องอื่นเองก็ได้ตามใจชอบ
        </p>
      )}

      {/* Instant Floor Intel Banner for Accomplice */}
      {isAccomplice && latestAccompliceClue && (
        <div className="rounded-lg border border-[#9E2A37] bg-[#2D1017] px-3 py-2.5 text-xs text-[#FFE4E6] space-y-1">
          <p className="font-semibold text-[#FDE047]">{latestAccompliceClue.title}</p>
          <p>{latestAccompliceClue.detail}</p>
        </div>
      )}

      {/* Live Purple Jamming Signal Banner (Shadow Assassin) */}
      {jamPing && (
        <div className="flex items-center gap-2.5 rounded-lg border border-[#A855F7] bg-[#241036] px-3.5 py-2.5 text-xs sm:text-sm text-[#F3E8FF] animate-jam-target-pulse">
          <Radio className="h-4 w-4 shrink-0 text-[#C084FC]" />
          <p className="font-semibold">
            {jamPing.senderName} [นักฆ่าเงา] ส่งซิกพื้นที่ก่อกวน:{' '}
            <span className="text-[#E9D5FF] font-mono-tabular">
              {jamPing.kind === 'FLOOR'
                ? `ชั้น ${jamPing.floor} (ข้อมูลแม่บ้านเพี้ยน ±1)`
                : `แถวแนวตั้ง ${jamPing.column} (ข้อมูลช่างกระจกเพี้ยน ±1)`}
            </span>
          </p>
        </div>
      )}

      {/* Shadow Assassin Jamming Skill & Purple Ping Controls */}
      {isShadow && (
        <div className="rounded-xl border border-[#7E22CE] bg-[#190D24] p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-bold text-[#E9D5FF]">
              สกิลนักฆ่าเงา · ก่อกวน & ส่งซิกพื้นที่ก่อกวน (สีม่วง)
            </span>
            <span className="rounded-full border border-[#A855F7]/60 bg-[#2E1065] px-2.5 py-0.5 font-mono-tabular text-[11px] font-semibold text-[#E9D5FF]">
              เหลือ {intel.shadowJamUsesRemaining}/2 ครั้ง
            </span>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] text-[#D8B4FE]">ก่อกวนชั้นแนวนอน (ปั่นข้อมูลแม่บ้าน ±1):</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {activeFloorsAsc.map((floor) => {
                const isJamActive = jamPing?.kind === 'FLOOR' && jamPing.floor === floor;
                return (
                  <button
                    key={floor}
                    type="button"
                    disabled={intel.nightActionSubmitted || intel.shadowJamUsesRemaining <= 0}
                    onClick={() => {
                      onPingJam?.('FLOOR', floor);
                      onShadowJamAction?.(`FLOOR:${floor}`);
                    }}
                    className={`min-h-[42px] rounded-lg border font-mono-tabular text-xs font-bold transition-all ${
                      isJamActive
                        ? 'border-[#C084FC] bg-[#581C87] text-white animate-jam-target-pulse'
                        : 'border-[#581C87] bg-[#231133] text-[#E9D5FF] hover:border-[#A855F7]'
                    } ${intel.nightActionSubmitted || intel.shadowJamUsesRemaining <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    ป่วนชั้น {floor}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] text-[#D8B4FE]">ก่อกวนแถวแนวตั้ง (ปั่นข้อมูลช่างเช็ดกระจก ±1):</p>
            <div className="grid grid-cols-3 gap-2">
              {HOTEL_COLUMNS.map((col: HotelColumnNumber) => {
                const isJamActive = jamPing?.kind === 'COLUMN' && jamPing.column === col;
                return (
                  <button
                    key={col}
                    type="button"
                    disabled={intel.nightActionSubmitted || intel.shadowJamUsesRemaining <= 0}
                    onClick={() => {
                      onPingJam?.('COLUMN', col);
                      onShadowJamAction?.(`COLUMN:${col}`);
                    }}
                    className={`min-h-[42px] rounded-lg border font-mono-tabular text-xs font-bold transition-all ${
                      isJamActive
                        ? 'border-[#C084FC] bg-[#581C87] text-white animate-jam-target-pulse'
                        : 'border-[#581C87] bg-[#231133] text-[#E9D5FF] hover:border-[#A855F7]'
                    } ${intel.nightActionSubmitted || intel.shadowJamUsesRemaining <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    ป่วนแถว {col} (x0{col})
                  </button>
                );
              })}
            </div>
          </div>

          {!intel.nightActionSubmitted && intel.shadowJamUsesRemaining > 0 && (
            <button
              type="button"
              onClick={() => onShadowJamAction?.('SKIP')}
              className="w-full min-h-[38px] rounded-lg border border-[#4C1D95] bg-[#140A1E] text-xs font-semibold text-[#C4B5FD] hover:border-[#A855F7] cursor-pointer"
            >
              ยังไม่ใช้คลื่นรบกวนคืนนี้ (เก็บสิทธิ์ไว้)
            </button>
          )}
        </div>
      )}

      {/* Live Target Signal / Ping Alert Banner */}
      {ping && (
        <div className="flex items-center gap-2.5 rounded-lg border border-[#EF4444] bg-[#361017] px-3.5 py-2.5 text-xs sm:text-sm text-[#FEE2E2] animate-signal-ring">
          <Radio className="h-4 w-4 shrink-0 text-[#F87171]" />
          <p className="font-semibold">
            {ping.senderName} ส่งซิกชี้เป้า:{' '}
            <span className="text-[#FDE047] font-mono-tabular">
              {ping.kind === 'ROOM'
                ? `ห้อง ${ping.room}`
                : ping.kind === 'FLOOR'
                  ? `ชั้น ${ping.floor} (ห้อง ${ping.floor}01–${ping.floor}03)`
                  : `เล็งตัว ${ping.playerName}`}
            </span>
          </p>
        </div>
      )}

      {/* Accomplice 2-Step Night Skill UI */}
      {isAccomplice && (
        <div className="space-y-3">
          {/* ขั้นตอนที่ 1: ส่องชั้นพักผู้เล่นเป็นการ์ดใหญ่กดง่าย */}
          <div className="rounded-xl border border-[#7A202B] bg-[#170A0E] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-bold text-[#FDE047]">
                ขั้นตอนที่ 1 · ส่องชั้นพักผู้เล่น (เลือก 1 คน)
              </span>
              {intel.nightActionSubmitted && (
                <span className="rounded-full bg-[#15362A] border border-[#34D399]/50 px-2 py-0.5 text-[10px] font-semibold text-[#6EE7B7]">
                  ✓ ส่องและบันทึกลงสมุดแล้ว
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {alivePlayers
                .filter(
                  (p) =>
                    p.id !== myPlayerId &&
                    !intel.evilPartners.some((partner) => partner.id === p.id)
                )
                .map((target) => {
                  const isPicked = intel.selectedNightTarget === target.id;
                  const locked = Boolean(intel.nightActionSubmitted);
                  return (
                    <button
                      key={target.id}
                      type="button"
                      disabled={locked || !onInspectPlayer}
                      onClick={() => onInspectPlayer?.(target.id)}
                      className={`min-h-[54px] rounded-xl border px-3 py-2.5 text-left transition-all ${
                        isPicked
                          ? 'border-[#FDE047] bg-[#3E131B] text-[#FEF08A] shadow-[0_0_14px_rgba(253,224,71,0.25)]'
                          : 'border-[#542028] bg-[#220F14] text-[#FFF1F2] hover:border-[#EF4444] hover:bg-[#31121A]'
                      } ${locked ? 'cursor-default opacity-80' : 'cursor-pointer active:scale-[0.98]'}`}
                    >
                      <div className="truncate text-sm font-bold">{target.name}</div>
                      <div className="text-[11px] text-[#E5A3AB]">
                        {isPicked ? '✓ ส่องชั้นแล้ว' : 'แตะเพื่อส่องชั้นพัก'}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* ขั้นตอนที่ 2: ปุ่มส่งซิกชี้เป้าทั้งชั้นให้ฆาตกร */}
          <div className="rounded-xl border border-[#7A202B] bg-[#170A0E] p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#FCA5A5]">
                <Layers className="h-4 w-4 text-[#F87171]" />
                <span>ขั้นตอนที่ 2 · ส่งซิกชี้เป้าไปที่ชั้นนี้ (ชั้น 1–{totalFloors})</span>
              </span>
              <button
                type="button"
                onClick={onTogglePingMode}
                className={`min-h-[34px] inline-flex items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                  pingModeActive
                    ? 'bg-[#DC2626] text-white'
                    : 'border border-[#6B242B] bg-[#241015] text-[#FECACA] hover:bg-[#36141C]'
                }`}
              >
                <Crosshair className="h-3.5 w-3.5" />
                <span>{pingModeActive ? 'ปิดโหมดจิ้มรายห้อง' : 'หรือจิ้มชี้รายห้อง'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {activeFloorsAsc.map((floor) => {
                const active = ping?.kind === 'FLOOR' && ping.floor === floor;
                return (
                  <button
                    key={floor}
                    type="button"
                    onClick={() => onPingFloor(floor)}
                    className={`min-h-[52px] flex flex-col items-center justify-center rounded-xl border font-mono-tabular transition-all cursor-pointer active:scale-[0.98] ${
                      active
                        ? 'border-[#EF4444] bg-[#7F1D1D] text-white shadow-[0_0_18px_rgba(239,68,68,0.65)] animate-floor-target-pulse'
                        : 'border-[#612029] bg-[#241015] text-[#FECACA] hover:border-[#EF4444] hover:bg-[#3A141D]'
                    }`}
                  >
                    <span className="text-sm font-bold">ชั้น {floor}</span>
                    <span className="text-[10px] opacity-90">
                      {active ? 'กำลังกระพริบชี้เป้า!' : 'ส่งซิกชี้เป้าชั้นนี้'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ชี้เป้าชื่อผู้เล่นเสริม */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {alivePlayers
                .filter(
                  (p) =>
                    p.id !== myPlayerId &&
                    !intel.evilPartners.some((partner) => partner.id === p.id)
                )
                .map((suspect) => (
                  <button
                    key={suspect.id}
                    type="button"
                    onClick={() => onPingPlayer(suspect.id)}
                    className="min-h-[34px] rounded-md border border-[#4D1E25] bg-[#221015] px-2.5 text-xs text-[#F5D0D5] hover:border-[#EF4444] hover:bg-[#33131A] transition-colors cursor-pointer"
                  >
                    ชี้เป้า {suspect.name}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Secret Chat Messages */}
      <div className="max-h-40 overflow-y-auto space-y-2 rounded-lg border border-[#3A161C] bg-[#11080B] p-2.5">
        {intel.secretChat.length === 0 ? (
          <p className="py-3 text-center text-xs text-[#9C6C73]">
            ส่งข้อความกระซิบวางแผนลอบสังหารกับคู่หูของคุณ...
          </p>
        ) : (
          intel.secretChat.map((m) => {
            const mine = m.senderId === myPlayerId;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-[#C88D95] px-1 mb-0.5">
                  {m.senderName}{' '}
                  {m.senderRole && (
                    <span className="font-bold text-[#FDE047]">{getEvilRoleBadge(m.senderRole)}</span>
                  )}
                </span>
                <div
                  className={`max-w-[88%] rounded-lg px-3 py-1.5 text-xs sm:text-sm ${
                    mine
                      ? 'bg-[#4A141D] text-[#FFF1F2]'
                      : 'bg-[#261117] border border-[#541C25] text-[#FDE8E8]'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Secret Chat Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          maxLength={200}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="กระซิบแผนในแชทลับใต้ดิน..."
          className="flex-1 min-h-[42px] rounded-lg border border-[#5A1E27] bg-[#10080B] px-3 text-sm text-[#FFF1F2] placeholder:text-[#8E5B63] focus:border-[#EF4444] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="ส่งแชทลับ"
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-[#DC2626] text-white hover:bg-[#EF4444] disabled:opacity-40 cursor-pointer"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}