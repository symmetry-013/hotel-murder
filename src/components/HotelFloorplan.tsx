import {
  Ban,
  Columns3,
  Crosshair,
  DoorClosed,
  EyeOff,
  KeyRound,
  Layers,
  Lock,
  ScanEye,
  Skull,
  Vote,
} from 'lucide-react';
import type {
  GamePhase,
  HotelColumnNumber,
  HotelFloorNumber,
  HotelRoomNumber,
  PrivatePlayerIntel,
  PublicPlayer,
  RevealedRoomInfo,
} from '../shared/gameTypes';
import {
  formatDayVoteLabel,
  getFloorsForCount,
  getRoomsInColumn,
  getRoomsOnFloor,
  HOTEL_COLUMNS,
  serializeDayVote,
} from '../shared/gameTypes';

interface HotelFloorplanProps {
  phase: GamePhase;
  day: number;
  totalFloors: number;
  revealedRooms: RevealedRoomInfo[];
  lockedFloors: HotelFloorNumber[];
  lockedColumns: HotelColumnNumber[];
  me: PublicPlayer | null;
  intel: PrivatePlayerIntel | null;
  accomplicePingMode: boolean;
  onVoteRoom: (room: HotelRoomNumber) => void;
  onVoteFloor: (floor: HotelFloorNumber) => void;
  onVoteColumn: (column: HotelColumnNumber) => void;
  onNightSelectRoom: (room: HotelRoomNumber) => void;
  onNightSelectFloor: (floor: HotelFloorNumber) => void;
  onNightSelectColumn: (column: HotelColumnNumber) => void;
  onAccomplicePingRoom: (room: HotelRoomNumber) => void;
}

export function HotelFloorplan({
  phase,
  day,
  totalFloors,
  revealedRooms,
  lockedFloors,
  lockedColumns,
  me,
  intel,
  accomplicePingMode,
  onVoteRoom,
  onVoteFloor,
  onVoteColumn,
  onNightSelectRoom,
  onNightSelectFloor,
  onNightSelectColumn,
  onAccomplicePingRoom,
}: HotelFloorplanProps) {
  const isAlive = Boolean(me?.alive);
  const myRoom = intel?.myRoom ?? null;
  const myRole = intel?.role ?? null;
  const isNight = phase === 'NIGHT';
  const isVote = phase === 'VOTE';
  const nightSubmitted = Boolean(intel?.nightActionSubmitted);

  const activeFloors = getFloorsForCount(totalFloors);
  const totalRooms = activeFloors.length * 3;

  // Map revealed rooms by room number for O(1) lookup
  const revealedMap = new Map<number, RevealedRoomInfo>();
  for (const r of revealedRooms) {
    revealedMap.set(r.room, r);
  }

  // Night role interaction flags
  const canMurdererPickRoom = isNight && isAlive && myRole === 'MURDERER' && !nightSubmitted;
  const canKeymasterPickRoom = isNight && isAlive && myRole === 'KEYMASTER' && !nightSubmitted;
  const canHousekeeperPickFloor = isNight && isAlive && myRole === 'HOUSEKEEPER' && !nightSubmitted;
  const canWitnessPickFloor = isNight && isAlive && myRole === 'WITNESS' && !nightSubmitted;
  const canGlazierPickColumn = isNight && isAlive && myRole === 'GLAZIER' && !nightSubmitted;
  const canAccomplicePing = isNight && isAlive && myRole === 'ACCOMPLICE' && accomplicePingMode;

  // Progressive Voting Unlock:
  // Day 1: ROOM only
  // Day 2: ROOM + Horizontal FLOOR
  // Day 3-4: ROOM + Horizontal FLOOR + Vertical COLUMN
  const canVote = isVote && isAlive;
  const canFloorLockdownVote = canVote && day >= 2;
  const canColumnLockdownVote = canVote && day >= 3;
  const canClickRoom =
    canVote || canMurdererPickRoom || canKeymasterPickRoom || canAccomplicePing;

  const myDayVote = intel?.myDayVote ?? null;
  const pingedRoom = intel?.secretPing?.kind === 'ROOM' ? intel.secretPing.room : null;
  const pingedFloor = intel?.secretPing?.kind === 'FLOOR' ? intel.secretPing.floor : null;
  const lastLockedRoom = intel?.lastKeymasterLockedRoom ?? null;

  const actionGuide = (() => {
    if (!isAlive) return 'สถานะวิญญาณผู้ชม — ห้องที่ยังไม่เปิดถูกปิดบังเป็นความลับทั้งหมด';
    if (isVote) {
      if (myDayVote) {
        return `คุณลงคะแนนแล้ว: ${formatDayVoteLabel(serializeDayVote(myDayVote))} — เปลี่ยนเป้าหมายได้ก่อนหมดเวลา`;
      }
      if (day >= 3) {
        return 'วันที่ 3+ ปลดล็อกครบ 3 แบบ! เลือกจิ้ม [รายห้อง], กด [ปิดชั้น X] ด้านซ้าย หรือ [ปิดแถว Y] ด้านบน!';
      }
      if (day === 2) {
        return 'วันที่ 2: โหวตได้ทั้ง [รายห้อง] และ [ปิดชั้น X] แนวนอน (ปิดแถวแนวตั้งปลดล็อกวันที่ 3)';
      }
      return 'วันที่ 1: โหวตได้เฉพาะ [รายห้อง (1 ห้อง)] เท่านั้น (ปิดชั้นปลดวันที่ 2 · ปิดแถวปลดวันที่ 3)';
    }
    if (canAccomplicePing) {
      return 'โหมดส่งซิกชี้เป้า: กดเลือกห้องที่ยังไม่เปิดบนแผนผังเพื่อส่งซิกให้ฆาตกร';
    }
    if (canMurdererPickRoom) {
      return `ฆาตกร: มีอิสระเลือกฆ่าได้ทุกห้องที่ยังไม่ปิดทั่วทั้ง ${activeFloors.length} ชั้น (ห้ามเลือกห้องตัวเอง)`;
    }
    if (canKeymasterPickRoom) {
      return lastLockedRoom
        ? `ช่างกุญแจ: กดเลือก 1 ห้องเพื่อล็อกป้องกันคืนนี้ (ห้ามล็อกห้อง ${lastLockedRoom} ซ้ำ!)`
        : 'ช่างกุญแจ: กดเลือก 1 ห้องที่ยังไม่เปิดเพื่อล็อกป้องกันการฆ่าคืนนี้';
    }
    if (canHousekeeperPickFloor) {
      return `แม่บ้าน: กดปุ่ม "ตรวจชั้น" ทางซ้ายของชั้น 1–${activeFloors.length} เพื่อนับจำนวนคนรอดชีวิตในชั้นนั้น`;
    }
    if (canWitnessPickFloor) {
      return `พยาน: กดปุ่ม "เฝ้าชั้น" ทางซ้ายของชั้น 1–${activeFloors.length} หากมีการฆ่าชั้นนั้นจะได้เบาะแสตำแหน่งฆาตกร`;
    }
    if (canGlazierPickColumn) {
      return 'ช่างเช็ดกระจก: กดปุ่ม "ตรวจแถว" ด้านบนแถว 1, 2 หรือ 3 เพื่อนับคนรอดชีวิตทั้งแถวแนวตั้ง';
    }
    if (isNight && nightSubmitted) {
      return 'ส่งคำสั่งกลางคืนแล้ว — อ่านผลสกิลในแผงด้านบนแล้วกดปุ่ม "รับทราบข้อมูล (Acknowledge)"';
    }
    if (isNight && (myRole === 'DETECTIVE' || myRole === 'ACCOMPLICE')) {
      return 'เลือกชื่อผู้เล่นที่ยังมีชีวิตในแผงปฏิบัติการกลางคืนเพื่อสืบชั้นพัก';
    }
    if (isNight && myRole === 'DRUNK') {
      return 'คนเมาไม่มีสกิลกลางคืน — พักผ่อนและรอปั่นแชทให้ทุกคนโหวตห้อง/ชั้น/แถวคุณพรุ่งนี้!';
    }
    return 'ห้ามย้ายห้องตลอดเกม — ห้องของคุณแสดงกรอบทอง ส่วนห้องคนอื่นปิดบังเป็น ??? ทั้งหมด';
  })();

  return (
    <section
      aria-label={`แผนผังโรงแรม ${activeFloors.length} ชั้น 3 แถวตั้ง`}
      className="rounded-xl border border-[#2F262C] bg-[#141116]/95 p-3.5 sm:p-5 space-y-3"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#251F24] pb-3">
        <div>
          <h2 className="font-display text-base sm:text-lg font-semibold text-[#F5EFE6]">
            แผนผังโรงแรม {activeFloors.length} ชั้น · 3 แถวตั้ง ({totalRooms} ห้อง)
          </h2>
          <p className="text-xs text-[#CFC8BF] mt-0.5">{actionGuide}</p>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono-tabular text-[#9D948A]">
          <span className="inline-flex items-center gap-1 text-[#E8C984]">
            <KeyRound className="h-3 w-3" />
            <span>ห้องคุณ: {myRoom ?? '—'}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[#9D948A]">
            <EyeOff className="h-3 w-3" />
            <span>
              เปิด/ปิดแล้ว {revealedRooms.length}/{totalRooms}
            </span>
          </span>
        </div>
      </div>

      {/* 3 Vertical Column Headers (Interactive for Day 3+ VOTE Column Lockdown & NIGHT Glazier) */}
      <div className="grid grid-cols-[78px_1fr] sm:grid-cols-[118px_1fr] gap-2 sm:gap-2.5 items-center">
        <div className="text-[10px] sm:text-[11px] font-mono-tabular text-[#7D746D] text-center leading-tight">
          {canVote
            ? day >= 3
              ? 'ปิดชั้น / แถว'
              : day === 2
                ? 'ปิดชั้น (วัน 2)'
                : 'โหวตรายห้อง'
            : 'ชั้น / แถวตั้ง'}
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
          {HOTEL_COLUMNS.map((col) => {
            const isLockedCol = lockedColumns.includes(col);
            const hasUnrevealedInCol = getRoomsInColumn(col, totalFloors).some(
              (r) => !revealedMap.has(r)
            );
            const isVotedThisCol =
              isVote && myDayVote?.kind === 'COLUMN' && myDayVote.column === col;
            const isPickedGlazierCol =
              isNight && myRole === 'GLAZIER' && intel?.selectedNightTarget === col;

            // NIGHT: Glazier column check
            if (canGlazierPickColumn || isPickedGlazierCol) {
              return (
                <button
                  key={col}
                  type="button"
                  disabled={!canGlazierPickColumn}
                  onClick={() => onNightSelectColumn(col)}
                  className={`min-h-[42px] flex items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors ${
                    isPickedGlazierCol
                      ? 'border-[#C8A25A] bg-[#2D2416] text-[#F3DC9F]'
                      : 'border-[#C8A25A]/75 bg-[#241D13] text-[#F3DC9F] hover:bg-[#352A1A] cursor-pointer'
                  }`}
                >
                  <Columns3 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate font-mono-tabular">
                    {isPickedGlazierCol ? `✓ แถว ${col}` : `ตรวจแถว ${col}`}
                  </span>
                </button>
              );
            }

            // VOTE: Day 3+ Vertical Column Lockdown (active) vs Day 1-2 (visibly locked)
            if (canVote) {
              if (!canColumnLockdownVote) {
                return (
                  <button
                    key={col}
                    type="button"
                    disabled
                    title="โหวตปิดตายแถวแนวตั้งจะปลดล็อกในวันที่ 3"
                    className="min-h-[42px] flex items-center justify-center gap-1 rounded-lg border border-dashed border-[#342B30] bg-[#110E13] px-1.5 text-[10px] sm:text-[11px] font-mono-tabular text-[#7A716A] cursor-not-allowed"
                  >
                    <Lock className="h-3 w-3 shrink-0 opacity-70" />
                    <span className="truncate">แถว {col} (ปลดวัน 3)</span>
                  </button>
                );
              }

              const disabledCol = isLockedCol || !hasUnrevealedInCol;
              return (
                <button
                  key={col}
                  type="button"
                  disabled={disabledCol}
                  onClick={() => onVoteColumn(col)}
                  className={`min-h-[44px] flex items-center justify-center gap-1 rounded-lg border px-1.5 text-[11px] sm:text-xs font-semibold transition-colors ${
                    disabledCol
                      ? 'border-[#2A1D21] bg-[#0F0B0D] text-[#6B585C] line-through cursor-not-allowed'
                      : isVotedThisCol
                        ? 'border-[#EF4444] bg-[#7F1D1D] text-white shadow-[0_0_16px_rgba(220,38,38,0.45)] cursor-pointer'
                        : 'border-[#6B242B] bg-[#231015] text-[#FCA5A5] hover:border-[#EF4444] hover:bg-[#36131A] cursor-pointer'
                  }`}
                >
                  <Lock className="h-3 w-3 shrink-0" />
                  <span className="truncate font-mono-tabular">
                    {disabledCol
                      ? `แถว ${col} ปิดแล้ว`
                      : isVotedThisCol
                        ? `✓ ปิดแถว ${col}`
                        : `ปิดแถว ${col}`}
                  </span>
                </button>
              );
            }

            return (
              <div
                key={col}
                className={`flex items-center justify-center gap-1 rounded-md border py-1.5 text-[11px] font-mono-tabular ${
                  isLockedCol
                    ? 'border-[#4A1C22] bg-[#1A0D10] text-[#F87171]'
                    : 'border-[#241E23] bg-[#100D12] text-[#A59C94]'
                }`}
              >
                {isLockedCol && <Lock className="h-3 w-3 shrink-0" />}
                <span>แถว {col}</span>
                <span className="hidden sm:inline opacity-70">
                  {isLockedCol ? '(ปิดตาย)' : `(x0${col})`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic Floor Matrix (totalPlayers - 1 floors) */}
      <div className="space-y-1.5 sm:space-y-2">
        {activeFloors.map((floor) => {
          const rooms = getRoomsOnFloor(floor);
          const isLockedFloor = lockedFloors.includes(floor);
          const hasUnrevealedOnFloor = rooms.some((r) => !revealedMap.has(r));
          const isVotedThisFloor =
            isVote && myDayVote?.kind === 'FLOOR' && myDayVote.floor === floor;
          const isPickedNightFloor =
            isNight &&
            (myRole === 'HOUSEKEEPER' || myRole === 'WITNESS') &&
            intel?.selectedNightTarget === floor;
          const isFloorPinged = isNight && pingedFloor === floor;

          return (
            <div
              key={floor}
              className={`grid grid-cols-[78px_1fr] sm:grid-cols-[118px_1fr] gap-2 sm:gap-2.5 items-stretch rounded-lg transition-colors ${
                isFloorPinged ? 'ring-1 ring-[#FDE047]/70 bg-[#2C1116]/40 p-0.5 -m-0.5' : ''
              }`}
            >
              {/* Left Floor Column: Night Housekeeper/Witness | Day 2+ Floor Lockdown | Day 1 Locked | Static */}
              <div className="flex flex-col justify-center">
                {canHousekeeperPickFloor || canWitnessPickFloor || isPickedNightFloor ? (
                  <button
                    type="button"
                    disabled={!(canHousekeeperPickFloor || canWitnessPickFloor)}
                    onClick={() => onNightSelectFloor(floor)}
                    className={`min-h-[58px] flex flex-col items-center justify-center gap-1 rounded-lg border px-1.5 text-[11px] font-semibold transition-colors ${
                      isPickedNightFloor
                        ? 'border-[#C8A25A] bg-[#2C2316] text-[#F3DC9F]'
                        : 'border-[#C8A25A]/75 bg-[#231C13] text-[#F3DC9F] hover:bg-[#33291A] cursor-pointer'
                    }`}
                  >
                    {myRole === 'WITNESS' ? (
                      <ScanEye className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Layers className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="font-mono-tabular">
                      {isPickedNightFloor
                        ? `✓ ชั้น ${floor}`
                        : myRole === 'WITNESS'
                          ? `เฝ้าชั้น ${floor}`
                          : `ตรวจชั้น ${floor}`}
                    </span>
                  </button>
                ) : canVote && !canFloorLockdownVote ? (
                  <button
                    type="button"
                    disabled
                    title="โหวตปิดตายทั้งชั้นแนวนอนจะปลดล็อกในวันที่ 2"
                    className="min-h-[58px] flex flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-[#342B30] bg-[#110E13] px-1 text-center text-[#7A716A] cursor-not-allowed"
                  >
                    <span className="font-mono-tabular text-xs font-semibold text-[#9D948A]">
                      ชั้น {floor}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[10px]">
                      <Lock className="h-2.5 w-2.5 shrink-0" />
                      <span>ปลดวัน 2</span>
                    </span>
                  </button>
                ) : canFloorLockdownVote ? (
                  <button
                    type="button"
                    disabled={isLockedFloor || !hasUnrevealedOnFloor}
                    onClick={() => onVoteFloor(floor)}
                    className={`min-h-[58px] flex flex-col items-center justify-center gap-1 rounded-lg border px-1.5 text-[11px] font-semibold transition-colors ${
                      isLockedFloor || !hasUnrevealedOnFloor
                        ? 'border-[#2A1D21] bg-[#0F0B0D] text-[#6B585C] line-through cursor-not-allowed'
                        : isVotedThisFloor
                          ? 'border-[#EF4444] bg-[#7F1D1D] text-white shadow-[0_0_16px_rgba(220,38,38,0.45)] cursor-pointer'
                          : 'border-[#6B242B] bg-[#231015] text-[#FCA5A5] hover:border-[#EF4444] hover:bg-[#36131A] cursor-pointer'
                    }`}
                  >
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-mono-tabular text-center leading-tight">
                      {isLockedFloor || !hasUnrevealedOnFloor
                        ? `ชั้น ${floor} ปิด`
                        : isVotedThisFloor
                          ? `✓ ปิดชั้น ${floor}`
                          : `ปิดชั้น ${floor}`}
                    </span>
                  </button>
                ) : (
                  <div
                    className={`flex h-full min-h-[58px] flex-col items-center justify-center rounded-lg border px-1 ${
                      isLockedFloor
                        ? 'border-[#4A1C22] bg-[#1A0D10]'
                        : isFloorPinged
                          ? 'border-[#FDE047] bg-[#351319]'
                          : 'border-[#241E23] bg-[#100D12]'
                    }`}
                  >
                    <span
                      className={`font-mono-tabular text-xs font-semibold ${
                        isLockedFloor
                          ? 'text-[#F87171]'
                          : isFloorPinged
                            ? 'text-[#FDE047]'
                            : 'text-[#C8A25A]'
                      }`}
                    >
                      ชั้น {floor}
                    </span>
                    {isLockedFloor && (
                      <span className="text-[10px] text-[#FCA5A5] font-semibold">ปิดตาย</span>
                    )}
                    {!isLockedFloor && isFloorPinged && (
                      <span className="text-[10px] text-[#FDE047] font-semibold">ซิกชั้นนี้</span>
                    )}
                  </div>
                )}
              </div>

              {/* 3 Room Tiles per Floor */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                {rooms.map((roomNum, colIdx) => {
                  const colNum = (colIdx + 1) as HotelColumnNumber;
                  const revealed = revealedMap.get(roomNum) ?? null;
                  const isMyRoom = myRoom === roomNum;
                  const isSelectedNight =
                    isNight &&
                    (myRole === 'MURDERER' || myRole === 'KEYMASTER') &&
                    intel?.selectedNightTarget === roomNum;
                  const isMyVotedRoom =
                    isVote && myDayVote?.kind === 'ROOM' && myDayVote.room === roomNum;
                  const isInMyVotedArea =
                    isVote &&
                    !revealed &&
                    ((myDayVote?.kind === 'FLOOR' && myDayVote.floor === floor) ||
                      (myDayVote?.kind === 'COLUMN' && myDayVote.column === colNum));
                  const isPinged = isNight && pingedRoom === roomNum;

                  const isRepeatLockBanned =
                    canKeymasterPickRoom && lastLockedRoom === roomNum;
                  const isMurdererSelfBanned = canMurdererPickRoom && isMyRoom;

                  const isDisabledTile =
                    Boolean(revealed) ||
                    !canClickRoom ||
                    isRepeatLockBanned ||
                    isMurdererSelfBanned;

                  const handleClick = () => {
                    if (isDisabledTile) return;
                    if (canVote) {
                      onVoteRoom(roomNum);
                    } else if (canAccomplicePing) {
                      onAccomplicePingRoom(roomNum);
                    } else if (canMurdererPickRoom || canKeymasterPickRoom) {
                      onNightSelectRoom(roomNum);
                    }
                  };

                  const isLockedTile =
                    revealed?.kind === 'LOCKED_EMPTY' || revealed?.kind === 'LOCKED_PLAYER';

                  // Visual tone per tile state
                  let tileStyle = 'border-[#2B2429] bg-[#18141B] text-[#CFC8BF]';

                  if (revealed) {
                    if (revealed.kind === 'LOCKED_EMPTY') {
                      tileStyle =
                        'border-[#4E232A] bg-[#140C0F] text-[#9A7A7F] opacity-80 cursor-default';
                    } else if (revealed.kind === 'LOCKED_PLAYER') {
                      tileStyle =
                        'border-[#991B1B] bg-[#2D1016] text-[#FECACA] cursor-default';
                    } else if (revealed.kind === 'INITIAL_CRIME') {
                      tileStyle =
                        'border-[#5B212A] bg-[#211015]/90 text-[#FCA5A5] cursor-default';
                    } else if (revealed.kind === 'EMPTY_LYNCHED') {
                      tileStyle =
                        'border-[#2B252A] bg-[#110E13] text-[#7A716A] opacity-75 cursor-default';
                    } else {
                      tileStyle =
                        'border-[#7F1D1D] bg-[#261116] text-[#FECACA] cursor-default';
                    }
                  } else if (isRepeatLockBanned) {
                    tileStyle =
                      'border-[#5C4426] bg-[#181410] text-[#9E8561] opacity-70 cursor-not-allowed';
                  } else if (isMyVotedRoom) {
                    tileStyle =
                      'border-[#EF4444] bg-[#3E131B] text-[#FFF1F2] ring-1 ring-[#EF4444]/70 cursor-pointer';
                  } else if (isInMyVotedArea) {
                    tileStyle =
                      'border-[#DC2626]/80 bg-[#2E1117] text-[#FEE2E2] cursor-pointer';
                  } else if (isSelectedNight) {
                    tileStyle =
                      myRole === 'MURDERER'
                        ? 'border-[#DC2626] bg-[#361116] text-[#FECACA]'
                        : 'border-[#34D399] bg-[#122921] text-[#A7F3D0]';
                  } else if (isPinged) {
                    tileStyle =
                      'border-[#EF4444] bg-[#321016] text-[#FEE2E2] animate-signal-ring cursor-pointer';
                  } else if (isMyRoom) {
                    tileStyle =
                      'border-[#C8A25A] bg-[#241D13] text-[#F8E7C0]' +
                      (isDisabledTile ? ' cursor-default' : ' cursor-pointer hover:bg-[#2F2518]');
                  } else if (!isDisabledTile) {
                    tileStyle = isVote
                      ? 'border-[#3D262B] bg-[#1B1419] text-[#EAE4DC] hover:border-[#DC2626] hover:bg-[#2A1318] cursor-pointer'
                      : 'border-[#332B30] bg-[#19151C] text-[#EAE4DC] hover:border-[#C8A25A] hover:bg-[#241E18] cursor-pointer';
                  } else {
                    tileStyle = 'border-[#251F24] bg-[#151218] text-[#8E857D] cursor-default';
                  }

                  return (
                    <button
                      key={roomNum}
                      type="button"
                      disabled={isDisabledTile}
                      onClick={handleClick}
                      className={`relative min-h-[58px] sm:min-h-[64px] flex flex-col justify-between rounded-lg border p-2 text-left transition-colors ${tileStyle}`}
                      style={
                        isLockedTile
                          ? {
                              backgroundImage:
                                'repeating-linear-gradient(-45deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 6px, transparent 6px, transparent 12px)',
                            }
                          : undefined
                      }
                    >
                      {/* Top row: Room Number + Status Icon */}
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`font-mono-tabular text-xs sm:text-sm font-bold ${
                            revealed?.kind === 'EMPTY_LYNCHED' || revealed?.kind === 'LOCKED_EMPTY'
                              ? 'line-through'
                              : ''
                          }`}
                        >
                          {roomNum}
                        </span>

                        {isLockedTile && (
                          <Lock className="h-3.5 w-3.5 text-[#F87171] shrink-0" />
                        )}
                        {revealed?.kind === 'INITIAL_CRIME' && (
                          <Skull className="h-3.5 w-3.5 text-[#F87171] shrink-0" />
                        )}
                        {revealed?.kind === 'EMPTY_LYNCHED' && (
                          <Ban className="h-3.5 w-3.5 text-[#7A716A] shrink-0" />
                        )}
                        {(revealed?.kind === 'LYNCHED_PLAYER' ||
                          revealed?.kind === 'MURDERED_PLAYER') && (
                          <Skull className="h-3.5 w-3.5 text-[#EF4444] shrink-0" />
                        )}
                        {!revealed && isRepeatLockBanned && (
                          <Ban className="h-3.5 w-3.5 text-[#C8A25A] shrink-0" />
                        )}
                        {!revealed && (isMyVotedRoom || isInMyVotedArea) && (
                          <Vote className="h-3.5 w-3.5 text-[#F87171] shrink-0" />
                        )}
                        {!revealed && isSelectedNight && myRole === 'KEYMASTER' && (
                          <Lock className="h-3.5 w-3.5 text-[#34D399] shrink-0" />
                        )}
                        {!revealed && isSelectedNight && myRole === 'MURDERER' && (
                          <Crosshair className="h-3.5 w-3.5 text-[#F87171] shrink-0" />
                        )}
                        {!revealed && !isSelectedNight && isPinged && (
                          <Crosshair className="h-3.5 w-3.5 text-[#FDE047] shrink-0" />
                        )}
                        {!revealed &&
                          !isMyVotedRoom &&
                          !isInMyVotedArea &&
                          !isSelectedNight &&
                          !isPinged &&
                          !isRepeatLockBanned &&
                          isMyRoom && <KeyRound className="h-3.5 w-3.5 text-[#C8A25A] shrink-0" />}
                        {!revealed &&
                          !isMyVotedRoom &&
                          !isInMyVotedArea &&
                          !isSelectedNight &&
                          !isPinged &&
                          !isRepeatLockBanned &&
                          !isMyRoom && (
                            <DoorClosed className="h-3.5 w-3.5 text-[#585057] shrink-0" />
                          )}
                      </div>

                      {/* Bottom row: Strict Fog of War & NO ROLE REVEAL ON DEATH */}
                      <div className="truncate text-[10px] sm:text-[11px] leading-tight">
                        {revealed ? (
                          revealed.kind === 'LOCKED_EMPTY' ? (
                            <span className="font-semibold text-[#C99A9F]">ปิดตาย (ว่าง)</span>
                          ) : revealed.kind === 'LOCKED_PLAYER' ? (
                            <span className="font-semibold text-[#FECACA]">
                              ปิดตาย · {revealed.occupantName ?? 'ผู้ตาย'} (DEAD)
                            </span>
                          ) : revealed.kind === 'INITIAL_CRIME' ? (
                            <span className="font-semibold text-[#FCA5A5]">ศพตั้งต้น (ว่าง)</span>
                          ) : revealed.kind === 'EMPTY_LYNCHED' ? (
                            <span>ห้องว่าง (เปิดแล้ว)</span>
                          ) : (
                            <span className="font-semibold text-[#FECACA]">
                              {revealed.occupantName ?? 'ผู้ตาย'} · DEAD
                            </span>
                          )
                        ) : isRepeatLockBanned ? (
                          <span className="font-semibold text-[#D6B16A]">ห้ามล็อกซ้ำ</span>
                        ) : isMyVotedRoom ? (
                          <span className="font-semibold text-[#FECACA]">
                            {isMyRoom ? 'ห้องคุณ · โหวตนี้' : '✓ โหวตเปิดห้องนี้'}
                          </span>
                        ) : isInMyVotedArea ? (
                          <span className="font-semibold text-[#FCA5A5]">
                            {isMyRoom ? 'ห้องคุณ · ปิดตาย!' : 'อยู่ในแนวปิดตาย'}
                          </span>
                        ) : isSelectedNight ? (
                          <span className="font-semibold">
                            {myRole === 'MURDERER' ? 'เป้าสังหารคืนนี้' : 'ล็อกป้องกันแล้ว'}
                          </span>
                        ) : isPinged ? (
                          <span className="font-semibold text-[#FDE047]">ซิกชี้เป้า!</span>
                        ) : isMyRoom ? (
                          <span className="font-semibold text-[#F3DC9F]">ห้องของคุณ</span>
                        ) : (
                          <span className="font-mono-tabular text-[#746C66]">???</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Compact Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#251F24] pt-2.5 text-[11px] text-[#9D948A]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-[#C8A25A] bg-[#241D13]" />
          <span>ห้องของคุณ</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-[#991B1B] bg-[#2D1016]" />
          <span>เสียชีวิต (DEAD) / ปิดตาย (ไม่เปิดบทบาท)</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-[#2B252A] bg-[#110E13]" />
          <span>ห้องว่าง (เปิดแล้ว)</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-[#2B2429] bg-[#18141B]" />
          <span>ยังไม่เปิด (???)</span>
        </span>
      </div>
    </section>
  );
}
