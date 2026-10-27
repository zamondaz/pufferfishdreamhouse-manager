'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Bed as BedIcon,
  Check,
  CheckCircle2,
  DoorOpen,
  Home,
  Pencil,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { formatBedCode } from '@/lib/supabase';
import {
  Bed,
  Gender,
  Reservation,
  Staff,
  StaffLocationNote,
  UpdateStaffProfilePayload,
} from '@/types/guesthouse';

interface StaffLocationControllerProps {
  staff: Staff[];
  beds: Bed[];
  reservations: Reservation[];
  todayStr: string;
  dateStrings: string[]; // 14-day window strings
  updatingStaffId: string | null;
  onChangeStaffLocation: (
    staffId: string,
    bedId: number | null,
    locationNote: StaffLocationNote
  ) => void;
  onUpdateStaffProfile: (payload: UpdateStaffProfilePayload) => Promise<void>;
}

const NON_BED_LOCATIONS: {
  note: StaffLocationNote;
  label: string;
  desc: string;
}[] = [
  { note: '거실', label: '거실', desc: '내부 취침 (인원 포함)' },
  { note: '사장님방', label: '사장님방', desc: '내부 취침 (인원 포함)' },
  { note: '샤바나', label: '샤바나', desc: '내부 취침 (인원 포함)' },
  { note: '외박', label: '외박', desc: '외부 취침 (인원 제외)' },
];

export default function StaffLocationController({
  staff,
  beds,
  reservations,
  todayStr,
  dateStrings,
  updatingStaffId,
  onChangeStaffLocation,
  onUpdateStaffProfile,
}: StaffLocationControllerProps) {
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editGender, setEditGender] = useState<Gender>('M');
  const [editCheckIn, setEditCheckIn] = useState<string>('');
  const [editCheckOut, setEditCheckOut] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);

  const startEditingStaff = (member: Staff) => {
    setEditingStaffId(member.id);
    setEditName(member.name);
    setEditGender(member.gender);
    setEditCheckIn(member.check_in);
    setEditCheckOut(member.check_out);
  };

  const handleSaveProfile = async (e: React.FormEvent, staffId: string) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setSavingProfile(true);
    try {
      await onUpdateStaffProfile({
        id: staffId,
        name: editName.trim(),
        gender: editGender,
        check_in: editCheckIn,
        check_out: editCheckOut,
      });
      setEditingStaffId(null);
    } finally {
      setSavingProfile(false);
    }
  };

  const formatBedLabel = (bedId: number | null) => {
    if (bedId === null) return null;
    const found = beds.find((b) => b.id === bedId);
    return found ? formatBedCode(found) : `침대 #${bedId}`;
  };

  // Helper: check if a staff member has a conflict on their current_bed_id within the visible 14-day window
  const getStaffConflicts = (staffMember: Staff) => {
    if (staffMember.current_bed_id === null) return [];
    const conflicts: { dateStr: string; guestName: string }[] = [];

    for (const dStr of dateStrings) {
      const staffActive =
        staffMember.check_in <= dStr && dStr < staffMember.check_out;
      if (!staffActive) continue;

      const overlappingGuest = reservations.find(
        (r) =>
          r.bed_id === staffMember.current_bed_id &&
          r.check_in <= dStr &&
          dStr < r.check_out
      );
      if (overlappingGuest) {
        conflicts.push({ dateStr: dStr, guestName: overlappingGuest.guest_name });
      }
    }
    return conflicts;
  };

  // Helper: check if a bed has any guest reservation today or in the 14-day window for this staff member
  const getBedStatusForStaff = (bed: Bed, currentStaff: Staff) => {
    const occupiedByOtherStaff = staff.some(
      (s) => s.id !== currentStaff.id && s.current_bed_id === bed.id
    );

    const occupiedTonightByGuest = reservations.some(
      (r) => r.bed_id === bed.id && r.check_in <= todayStr && todayStr < r.check_out
    );

    const hasConflictInWindow = dateStrings.some((dStr) => {
      const staffActive =
        currentStaff.check_in <= dStr && dStr < currentStaff.check_out;
      if (!staffActive) return false;
      return reservations.some(
        (r) => r.bed_id === bed.id && r.check_in <= dStr && dStr < r.check_out
      );
    });

    return {
      occupiedByOtherStaff,
      occupiedTonightByGuest,
      hasConflictInWindow,
    };
  };

  return (
    <section className="max-w-[1600px] mx-auto px-4 sm:px-6 mt-5 pb-12">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                상주 스태프 자리 배정 &amp; 프로필 설정
                <span className="text-xs font-medium text-slate-500">
                  (클릭 즉시 베드맵 반영)
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                스태프 이름·성별을 자유롭게 설정하고, 취침 위치를 침대 또는{' '}
                <strong className="text-slate-700">거실 · 사장님방 · 샤바나 · 외박</strong>으로 원클릭 전환하세요.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              14일간 비어있는 추천 침대
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
              일정 중 게스트 예약 있음
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4">
          {staff.map((member) => {
            const conflicts = getStaffConflicts(member);
            const hasConflict = conflicts.length > 0;
            const currentBedLabel = formatBedLabel(member.current_bed_id);
            const isUpdating = updatingStaffId === member.id;
            const isEditing = editingStaffId === member.id;

            // Find first completely conflict-free bed for a 1-click smart recommendation
            const recommendedBed = beds.find((b) => {
              const st = getBedStatusForStaff(b, member);
              return !st.hasConflictInWindow && !st.occupiedByOtherStaff;
            });

            return (
              <div
                key={member.id}
                className={`rounded-xl border p-4 transition-all ${
                  hasConflict
                    ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-200'
                    : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                {/* Staff Header & Profile Editor */}
                <div className="pb-3 border-b border-slate-200/70">
                  {isEditing ? (
                    <form
                      onSubmit={(e) => handleSaveProfile(e, member.id)}
                      className="bg-white p-3 rounded-xl border border-indigo-200 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-indigo-900">
                          ✏️ 스태프 이름 · 성별 · 상주 기간 설정
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingStaffId(null)}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                        <div className="sm:col-span-5">
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                            스태프 이름
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            required
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                            성별
                          </label>
                          <div className="grid grid-cols-2 gap-1">
                            {(['M', 'F'] as Gender[]).map((gKey) => (
                              <button
                                key={gKey}
                                type="button"
                                onClick={() => setEditGender(gKey)}
                                className={`py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                  editGender === gKey
                                    ? gKey === 'M'
                                      ? 'bg-sky-600 text-white border-sky-600'
                                      : 'bg-rose-600 text-white border-rose-600'
                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}
                              >
                                {gKey === 'M' ? '남' : '여'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="sm:col-span-3 flex justify-end gap-1">
                          <button
                            type="submit"
                            disabled={savingProfile}
                            className="w-full py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            저장
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                            근무 시작일
                          </label>
                          <input
                            type="date"
                            value={editCheckIn}
                            onChange={(e) => setEditCheckIn(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                            근무 종료일
                          </label>
                          <input
                            type="date"
                            value={editCheckOut}
                            onChange={(e) => setEditCheckOut(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-800"
                          />
                        </div>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-sm shadow-2xs">
                          {member.name.slice(-1)}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-base">
                              {member.name}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                member.gender === 'M'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {member.gender === 'M' ? '남' : '여'}
                            </span>
                            <button
                              type="button"
                              onClick={() => startEditingStaff(member)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                              title="스태프 이름 및 성별 수정"
                            >
                              <Pencil className="w-3 h-3" />
                              이름/성별 설정
                            </button>
                          </div>

                          {/* Conflict or Clean Status line */}
                          {hasConflict ? (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 mt-0.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>
                                ⚠️ {currentBedLabel} 침대에 게스트 예약 중복 ({conflicts.length}박:{' '}
                                {conflicts[0].guestName} 외) — 위치를 변경해 주세요!
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-emerald-700 font-medium mt-0.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>
                                현재 배정 위치 충돌 없음 (
                                {member.current_bed_id !== null
                                  ? `${currentBedLabel} 침대 사용 중`
                                  : `${member.location_note} (${
                                      member.location_note === '외박'
                                        ? '외부 취침'
                                        : '내부 취침'
                                    })`}
                                )
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Current Location Badge & Quick Fix Button */}
                      <div className="flex items-center gap-2">
                        {hasConflict && recommendedBed && (
                          <button
                            type="button"
                            onClick={() =>
                              onChangeStaffLocation(member.id, recommendedBed.id, '침대')
                            }
                            disabled={isUpdating}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs transition-colors cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            빈 침대({formatBedCode(recommendedBed)})로 자동 이동
                          </button>
                        )}
                        <div className="px-3 py-1 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-800 shadow-2xs">
                          현재:{' '}
                          <span className="text-indigo-700">
                            {member.current_bed_id !== null
                              ? `${currentBedLabel} (침대)`
                              : member.location_note}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 1-Click Special Non-Bed Locations ('거실' | '사장님방' | '샤바나' | '외박') */}
                <div className="mt-3">
                  <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                    <Home className="w-3 h-3" />
                    침대 외 상태로 1-Click 전환 (거실 · 사장님방 · 샤바나: 내부 취침 / 외박: 인원 제외):
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {NON_BED_LOCATIONS.map((loc) => {
                      const isSelected =
                        member.current_bed_id === null &&
                        member.location_note === loc.note;

                      return (
                        <button
                          key={loc.note}
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            onChangeStaffLocation(member.id, null, loc.note)
                          }
                          className={`flex flex-col items-center justify-center py-2 px-2 rounded-lg border text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 font-semibold'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <DoorOpen className="w-3.5 h-3.5" />
                            <span>{loc.label}</span>
                          </div>
                          <span
                            className={`text-[10px] mt-0.5 ${
                              isSelected ? 'text-indigo-100' : 'text-slate-400'
                            }`}
                          >
                            {loc.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 1-Click Bed Switcher (All 12 Beds) */}
                <div className="mt-3">
                  <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                    <BedIcon className="w-3 h-3" />
                    객실 침대로 1-Click 배정 (총 12베드):
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                    {beds.map((bed) => {
                      const isCurrentBed = member.current_bed_id === bed.id;
                      const { occupiedByOtherStaff, hasConflictInWindow } =
                        getBedStatusForStaff(bed, member);

                      let btnStyle =
                        'bg-white hover:bg-emerald-50 text-slate-700 border-emerald-200';
                      let statusDot = 'bg-emerald-500';

                      if (isCurrentBed) {
                        if (hasConflictInWindow) {
                          btnStyle =
                            'bg-amber-500 text-white border-amber-600 font-bold shadow-xs';
                          statusDot = 'bg-white';
                        } else {
                          btnStyle =
                            'bg-emerald-600 text-white border-emerald-700 font-bold shadow-xs';
                          statusDot = 'bg-white';
                        }
                      } else if (occupiedByOtherStaff) {
                        btnStyle =
                          'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200';
                        statusDot = 'bg-slate-400';
                      } else if (hasConflictInWindow) {
                        btnStyle =
                          'bg-amber-50/80 hover:bg-amber-100 text-amber-900 border-amber-200';
                        statusDot = 'bg-amber-400';
                      }

                      return (
                        <button
                          key={bed.id}
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            onChangeStaffLocation(member.id, bed.id, '침대')
                          }
                          title={
                            hasConflictInWindow
                              ? `${formatBedCode(bed)} (${bed.room_name}): 표시된 14일 중 게스트 예약이 있습니다`
                              : `${formatBedCode(bed)} (${bed.room_name}): 14일 내내 비어있음`
                          }
                          className={`px-2 py-1.5 rounded-lg border text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${btnStyle}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`}
                          />
                          <span className="truncate font-bold">
                            {formatBedCode(bed)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
