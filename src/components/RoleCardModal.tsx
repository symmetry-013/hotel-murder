import {
  Columns3,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  ScanEye,
  Search,
  Skull,
  Wine,
  X,
} from 'lucide-react';
import type { PrivatePlayerIntel, RoleId } from '../shared/gameTypes';
import { ROLE_DEFINITIONS } from '../shared/gameTypes';

const KILLER_ART = '/src/assets/images/role_emblem_killer_1795239516968.jpg';
const DETECTIVE_ART = '/src/assets/images/role_emblem_detective_1795239505654.jpg';

interface RoleCardModalProps {
  intel: PrivatePlayerIntel;
  open: boolean;
  onClose: () => void;
}

export function RoleIcon({ role, className = 'h-4 w-4' }: { role: RoleId; className?: string }) {
  switch (role) {
    case 'MURDERER':
      return <Skull className={className} aria-hidden="true" />;
    case 'ACCOMPLICE':
      return <Eye className={className} aria-hidden="true" />;
    case 'KEYMASTER':
      return <KeyRound className={className} aria-hidden="true" />;
    case 'HOUSEKEEPER':
      return <Layers className={className} aria-hidden="true" />;
    case 'GLAZIER':
      return <Columns3 className={className} aria-hidden="true" />;
    case 'DETECTIVE':
      return <Search className={className} aria-hidden="true" />;
    case 'WITNESS':
      return <ScanEye className={className} aria-hidden="true" />;
    case 'DRUNK':
      return <Wine className={className} aria-hidden="true" />;
  }
}

export function RoleCardContent({
  intel,
  compact = false,
}: {
  intel: PrivatePlayerIntel;
  compact?: boolean;
}) {
  if (!intel.role) return null;
  const def = ROLE_DEFINITIONS[intel.role];
  const isEvil = def.faction === 'EVIL';
  const isSpecial = def.faction === 'SPECIAL';
  const artwork = isEvil ? KILLER_ART : DETECTIVE_ART;

  const factionHeaderText = isEvil
    ? 'ฝ่ายฆาตกร · ภารกิจลับ'
    : isSpecial
      ? 'ฝ่ายพิเศษ · จอมป่วน (ชนะเดี่ยว)'
      : 'ฝ่ายผู้บริสุทธิ์ · สืบสวนหาห้องฆาตกร';

  const factionAccentClass = isEvil
    ? 'text-[#F87171]'
    : isSpecial
      ? 'text-[#D8B4FE]'
      : 'text-[#C8A25A]';

  return (
    <div className="space-y-4">
      {/* Artwork Header */}
      <div
        className={`relative w-full overflow-hidden rounded-lg bg-[#1D161C] ${
          compact ? 'h-36' : 'h-44'
        }`}
      >
        <img
          src={artwork}
          alt={def.nameTh}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#151117] via-[#151117]/40 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <p className={`text-xs font-medium ${factionAccentClass}`}>{factionHeaderText}</p>
          <div className="mt-1 flex items-center gap-2">
            <RoleIcon role={intel.role} className={`h-5 w-5 ${factionAccentClass}`} />
            <h3 className="font-display text-xl sm:text-2xl font-bold text-[#F5EFE6]">
              {def.nameTh}
            </h3>
            <span className="text-xs text-[#9D948A]">({def.nameEn})</span>
          </div>
        </div>
      </div>

      {/* Permanent Fixed Room Coordinates */}
      {intel.myRoom && intel.myFloor && intel.myColumn && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#3B3024] bg-[#1C1712] px-3.5 py-2.5 text-xs">
          <span className="text-[#BDB5AC]">ห้องพักประจำตัว (ห้ามย้ายตลอดเกม)</span>
          <span className="font-mono-tabular font-bold text-[#F3DC9F]">
            ห้อง {intel.myRoom} · ชั้น {intel.myFloor} · แถวตั้ง {intel.myColumn}
          </span>
        </div>
      )}

      <p className="text-sm leading-relaxed text-[#DDD6CE]">{def.detailTh}</p>

      {/* Keymaster No-Repeat Lock Reminder */}
      {intel.role === 'KEYMASTER' && intel.lastKeymasterLockedRoom && (
        <div className="rounded-lg border border-[#6E542B] bg-[#211A11] px-3.5 py-2.5 text-xs text-[#F3DC9F] font-mono-tabular">
          คืนก่อนหน้าคุณล็อกห้อง {intel.lastKeymasterLockedRoom} ไปแล้ว — คืนถัดไปห้ามล็อกห้องนี้ซ้ำ
        </div>
      )}

      {/* Evil Team Partners */}
      {intel.evilPartners.length > 0 && (
        <div className="rounded-lg border border-[#5A1F26] bg-[#241015] p-3.5">
          <p className="text-xs font-semibold text-[#FCA5A5]">เพื่อนร่วมฝ่ายฆาตกรของคุณ</p>
          <div className="mt-1.5 space-y-1">
            {intel.evilPartners.map((partner) => (
              <div
                key={partner.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#F5EFE6]"
              >
                <span className="font-semibold">
                  {partner.name} · {ROLE_DEFINITIONS[partner.role].nameTh}
                </span>
                {partner.room && (
                  <span className="font-mono-tabular text-xs font-bold text-[#FCA5A5]">
                    ห้อง {partner.room}
                    {partner.floor ? ` (ชั้น ${partner.floor}` : ''}
                    {partner.column ? ` · แถว ${partner.column})` : partner.floor ? ')' : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unified Personal Investigation Log (My Investigation Log) */}
      <InvestigationLogBox intel={intel} />
    </div>
  );
}

export function InvestigationLogBox({
  intel,
  collapsible = false,
}: {
  intel: PrivatePlayerIntel;
  collapsible?: boolean;
}) {
  const logs = intel.clueLogs;
  return (
    <div className="rounded-lg border border-[#3B3027] bg-[#19141C] p-3.5 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[#E8C984]">
          สมุดบันทึกเบาะแสส่วนตัว (My Investigation Log · {logs.length})
        </p>
        <span className="text-[11px] text-[#8D857E]">
          {collapsible ? 'บันทึกผลสกิลทุกคืน · เห็นเฉพาะคุณ' : 'เห็นเฉพาะคุณคนเดียว'}
        </span>
      </div>

      {logs.length === 0 ? (
        <p className="text-xs text-[#8D857E]">
          ยังไม่มีบันทึก — ผลการใช้สกิลทุกคืน (เช่น ส่องชั้น, ตรวจแถว, เฝ้าชั้น, ล็อกห้อง) จะถูกเก็บไว้ที่นี่ไม่ให้ลืม
        </p>
      ) : (
        <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {[...logs].reverse().map((log) => (
            <li
              key={log.id}
              className={`rounded-md border px-3 py-2 text-xs leading-relaxed ${
                log.tone === 'DANGER'
                  ? 'border-[#6B1F27] bg-[#261116] text-[#FECACA]'
                  : log.tone === 'SAFE'
                    ? 'border-[#255442] bg-[#11241D] text-[#A7F3D0]'
                    : 'border-[#392F29] bg-[#201A16] text-[#E6DDD2]'
              }`}
            >
              <p className="font-semibold mb-0.5 font-mono-tabular">
                คืนที่ {log.night} · {log.title}
              </p>
              <p className="opacity-95">{log.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RoleCardModal({ intel, open, onClose }: RoleCardModalProps) {
  if (!open || !intel.role) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="การ์ดบทบาทลับของคุณ"
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-[#3B2E33] bg-[#151117] p-5 shadow-2xl animate-settle"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-[#C8A25A]">เอกสารลับประจำตัวแขก</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดการ์ดบทบาท"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-black/50 text-[#EAE4DC] hover:bg-black/80 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <RoleCardContent intel={intel} />

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full min-h-[44px] rounded-lg bg-[#C8A25A] px-4 py-2.5 text-sm font-semibold text-[#110D0A] hover:bg-[#D9B66F] transition-colors cursor-pointer whitespace-nowrap"
        >
          เก็บการ์ดบทบาทไว้เป็นความลับ
        </button>
      </div>
    </div>
  );
}

interface SecretRoleBarProps {
  intel: PrivatePlayerIntel | null;
  hiddenRole: boolean;
  onToggleHide: () => void;
  onOpenModal: () => void;
}

export function SecretRoleBar({
  intel,
  hiddenRole,
  onToggleHide,
  onOpenModal,
}: SecretRoleBarProps) {
  if (!intel?.role) return null;
  const def = ROLE_DEFINITIONS[intel.role];
  const isEvil = def.faction === 'EVIL';
  const isSpecial = def.faction === 'SPECIAL';

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#2F262C] bg-[#161218] px-3.5 py-2.5 sm:px-4 sm:py-3">
      <button
        type="button"
        onClick={onOpenModal}
        className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer group"
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
            hiddenRole
              ? 'border-[#332B30] bg-[#1F1A21] text-[#9D948A]'
              : isEvil
                ? 'border-[#7F1D1D] bg-[#2D1217] text-[#F87171]'
                : isSpecial
                  ? 'border-[#6B21A8] bg-[#241333] text-[#D8B4FE]'
                  : 'border-[#735A2D] bg-[#241E15] text-[#C8A25A]'
          }`}
        >
          {hiddenRole ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <RoleIcon role={intel.role} className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-[#9D948A] font-mono-tabular">
            การ์ดบทบาทลับ
            {intel.myRoom && intel.myFloor && intel.myColumn
              ? ` · ห้อง ${intel.myRoom} (ชั้น ${intel.myFloor} แถว ${intel.myColumn})`
              : ''}
            {` · เบาะแส ${intel.clueLogs.length}`}
          </p>
          <p className="truncate text-sm font-semibold text-[#F5EFE6] group-hover:text-[#E8C984] transition-colors">
            {hiddenRole
              ? 'ซ่อนบทบาทอยู่ (คลิกตาเพื่อเปิดดู)'
              : `${def.nameTh} — ${def.shortAbilityTh}`}
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={onToggleHide}
        aria-label={hiddenRole ? 'แสดงบทบาทลับ' : 'ซ่อนบทบาทลับ'}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#30272C] bg-[#1D1820] text-[#BFB6AC] hover:border-[#C8A25A]/60 hover:text-[#EAE4DC] transition-colors cursor-pointer"
      >
        {hiddenRole ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
    </div>
  );
}
