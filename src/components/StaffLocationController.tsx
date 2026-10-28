'use client';

import React, { useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  AlertTriangle,
  Bed as BedIcon,
  Calendar,
  Check,
  CheckCircle2,
  DoorOpen,
  Home,
  Pencil,
  RotateCcw,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  formatBedCode,
  getStaffAssignmentForDate,
  isStaffSleepingInside,
} from '@/lib/supabase';
import {
  Bed,
  CreateStaffPayload,
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
  onChangeStaffDateLocation: (
    staffMember: Staff,
    dates: string[],
    bedId: number | null,
    locationNote: StaffLocationNote | null
  ) => Promise<void>;
  onUpdateStaffProfile: (payload: UpdateStaffProfilePayload) => Promise<void>;
  onCreateStaff: (payload: CreateStaffPayload) => Promise<void>;
  onDeleteStaff: (staffId: string) => Promise<void>;
}

const NON_BED_LOCATIONS: {
  note: StaffLocationNote;
  label: string;
  desc: string;
}[] = [
  { note: '샤바나', label: '⛺ 샤바나', desc: '베드맵 샤바나 칸 배정' },
  { note: '거실', label: '🛋️ 거실', desc: '내부 취침 (인원 포함)' },
  { note: '사장님방', label: '🏠 사장님방', desc: '내부 취침 (인원 포함)' },
  { note: '외박', label: '🚫 숙박 안 함 (외박)', desc: '숙박 제외 (인원 제외)' },
];

export default function StaffLocationController({
  staff,
  beds,
  reservations,
  todayStr,
  dateStrings,
  updatingStaffId,
  onChangeStaffLocation,
  onChangeStaffDateLocation,
  onUpdateStaffProfile,
  onCreateStaff,
  onDeleteStaff,
}: StaffLocationControllerProps) {
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editGender, setEditGender] = useState<Gender>('M');
  const [editCheckIn, setEditCheckIn] = useState<string>('');
  const [editCheckOut, setEditCheckOut] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);

  // Selected dates per staff for batch per-date assignment: Record<staffId, string[]>
  const [selectedDatesByStaff, setSelectedDatesByStaff] = useState<
    Record<string, string[]>
  >({});

  // Add new staff inline state
  const [isAddingStaff, setIsAddingStaff] = useState<boolean>(false);
  const [newStaffName, setNewStaffName] = useState<string>('');
  const [newStaffGender, setNewStaffGender] = useState<Gender>('M');
  const [newStaffCheckIn, setNewStaffCheckIn] = useState<string>(todayStr);
  const [newStaffCheckOut, setNewStaffCheckOut] = useState<string>(() =>
    format(addDays(parseISO(todayStr), 30), 'yyyy-MM-dd')
  );
  const [newStaffLocation, setNewStaffLocation] =
    useState<StaffLocationNote>('샤바나');
  const [creatingStaff, setCreatingStaff] = useState<boolean>(false);

  const regularBeds = beds.filter((b) => b.room_name !== '샤바나');
  const shabanaBed = beds.find((b) => b.room_name === '샤바나');

  const toggleDateSelection = (staffId: string, dStr: string) => {
    setSelectedDatesByStaff((prev) => {
      const current = prev[staffId] || [];
      const next = current.includes(dStr)
        ? current.filter((x) => x !== dStr)
        : [...current, dStr];
      return { ...prev, [staffId]: next };
    });
  };

  const clearDateSelection = (staffId: string) => {
    setSelectedDatesByStaff((prev) => ({ ...prev, [staffId]: [] }));
  };

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

  const handleCreateNewStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    setCreatingStaff(true);
    try {
      await onCreateStaff({
        name: newStaffName.trim(),
        gender: newStaffGender,
        check_in: newStaffCheckIn,
        check_out: newStaffCheckOut,
        current_bed_id:
          newStaffLocation === '샤바나' && shabanaBed ? shabanaBed.id : null,
        location_note: newStaffLocation,
      });
      setNewStaffName('');
      setIsAddingStaff(false);
    } finally {
      setCreatingStaff(false);
    }
  };

  const formatBedLabel = (bedId: number | null) => {
    if (bedId === null) return null;
    const found = beds.find((b) => b.id === bedId);
    return found ? formatBedCode(found) : `침대 #${bedId}`;
  };

  // Helper: check if a staff member has a conflict on any regular bed within the visible 14-day window
  const getStaffConflicts = (staffMember: Staff) => {
    const conflicts: { dateStr: string; guestName: string; bedLabel: string }[] =
      [];

    for (const dStr of dateStrings) {
      const assign = getStaffAssignmentForDate(staffMember, dStr);
      if (assign.bed_id === null || assign.location_note !== '침대') continue;
      const bedObj = beds.find((b) => b.id === assign.bed_id);
      if (bedObj?.room_name === '샤바나') continue;

      const overlappingGuest = reservations.find(
        (r) =>
          r.bed_id === assign.bed_id &&
          r.check_in <= dStr &&
          dStr < r.check_out
      );
      if (overlappingGuest) {
        conflicts.push({
          dateStr: dStr,
          guestName: overlappingGuest.guest_name,
          bedLabel: bedObj ? formatBedCode(bedObj) : `#${assign.bed_id}`,
        });
      }
    }
    return conflicts;
  };

  // Helper: check if a regular bed has any guest reservation in the target dates for this staff member
  const getBedStatusForStaff = (
    bed: Bed,
    currentStaff: Staff,
    targetDates: string[]
  ) => {
    const checkDates = targetDates.length > 0 ? targetDates : dateStrings;

    const occupiedByOtherStaff = staff.some(
      (s) =>
        s.id !== currentStaff.id &&
        checkDates.some((dStr) => {
          const a = getStaffAssignmentForDate(s, dStr);
          return a.location_note === '침대' && a.bed_id === bed.id;
        })
    );

    const hasConflictInWindow = checkDates.some((dStr) => {
      return reservations.some(
        (r) => r.bed_id === bed.id && r.check_in <= dStr && dStr < r.check_out
      );
    });

    return {
      occupiedByOtherStaff,
      hasConflictInWindow,
    };
  };

  return (
    <section className="max-w-[1600px] mx-auto px-4 sm:px-6 mt-5 pb-12">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                <span>
                  상주 스태프 자리 배정 &amp; 날짜별 숙박 스케줄러 ({staff.length}명)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                  날짜별 개별 숙박 지정 · 숙박 안 함(외박) · 샤바나 배정 지원
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                아래 14일 날짜별 스케줄 표에서 날짜마다{' '}
                <strong className="text-slate-700">
                  침대 / 샤바나 / 거실 / 사장님방 / 숙박 안 함(외박)
                </strong>
                을 각각 지정하거나 여러 날짜를 선택해 일괄 변경할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setNewStaffCheckIn(todayStr);
                setNewStaffCheckOut(
                  format(addDays(parseISO(todayStr), 30), 'yyyy-MM-dd')
                );
                setIsAddingStaff((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />+ 스태프 추가
            </button>
          </div>
        </div>

        {/* Inline Add Staff Form */}
        {isAddingStaff && (
          <form
            onSubmit={handleCreateNewStaff}
            className="mt-4 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-emerald-700" />
                신규 상주 스태프 등록
              </span>
              <button
                type="button"
                onClick={() => setIsAddingStaff(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  스태프 이름
                </label>
                <input
                  type="text"
                  placeholder="예: 민지"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  성별
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {(['M', 'F'] as Gender[]).map((gKey) => (
                    <button
                      key={gKey}
                      type="button"
                      onClick={() => setNewStaffGender(gKey)}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        newStaffGender === gKey
                          ? gKey === 'M'
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      {gKey === 'M' ? '남' : '여'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  시작일
                </label>
                <input
                  type="date"
                  value={newStaffCheckIn}
                  onChange={(e) => setNewStaffCheckIn(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  종료일
                </label>
                <input
                  type="date"
                  value={newStaffCheckOut}
                  onChange={(e) => setNewStaffCheckOut(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  기본 취침 상태
                </label>
                <select
                  value={newStaffLocation}
                  onChange={(e) =>
                    setNewStaffLocation(e.target.value as StaffLocationNote)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
                >
                  <option value="샤바나">⛺ 샤바나 (내부)</option>
                  <option value="거실">🛋️ 거실 (내부)</option>
                  <option value="사장님방">🏠 사장님방 (내부)</option>
                  <option value="외박">🚫 숙박 안 함 (외박)</option>
                </select>
              </div>

              <div className="sm:col-span-1">
                <button
                  type="submit"
                  disabled={creatingStaff}
                  className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer"
                >
                  {creatingStaff ? '...' : '등록'}
                </button>
              </div>
            </div>
          </form>
        )}

        {staff.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm">
            현재 등록된 상주 스태프가 없습니다. 우측 상단의{' '}
            <strong className="text-emerald-700">[+ 스태프 추가]</strong> 버튼을 눌러 스태프를 등록하세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 pt-4">
            {staff.map((member) => {
              const conflicts = getStaffConflicts(member);
              const hasConflict = conflicts.length > 0;
              const currentBedLabel = formatBedLabel(member.current_bed_id);
              const isUpdating = updatingStaffId === member.id;
              const isEditing = editingStaffId === member.id;
              const selectedDates = selectedDatesByStaff[member.id] || [];
              const customDatesCount = Object.keys(
                member.daily_assignments || {}
              ).length;

              // Calculate how many nights this staff is staying inside in the 14-day window
              const stayingWindowCount = dateStrings.filter((dStr) => {
                const a = getStaffAssignmentForDate(member, dStr);
                return isStaffSleepingInside(a.location_note);
              }).length;
              const offWindowCount = dateStrings.length - stayingWindowCount;

              // Find first conflict-free regular bed
              const recommendedBed = regularBeds.find((b) => {
                const st = getBedStatusForStaff(b, member, selectedDates);
                return !st.hasConflictInWindow && !st.occupiedByOtherStaff;
              });

              const applyLocationOrDateBatch = async (
                bedId: number | null,
                locationNote: StaffLocationNote
              ) => {
                if (selectedDates.length > 0) {
                  await onChangeStaffDateLocation(
                    member,
                    selectedDates,
                    bedId,
                    locationNote
                  );
                  clearDateSelection(member.id);
                } else {
                  onChangeStaffLocation(member.id, bedId, locationNote);
                }
              };

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
                            ✏️ 스태프 이름 · 성별 · 기본 상주 기간 설정
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
                              기본 근무 시작일
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
                              기본 근무 종료일
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
                              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-extrabold">
                                14일 중 {stayingWindowCount}박 숙박 ·{' '}
                                {offWindowCount}일 숙박안함
                              </span>
                              <button
                                type="button"
                                onClick={() => startEditingStaff(member)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                                이름/기간 설정
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteStaff(member.id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                삭제
                              </button>
                            </div>

                            {/* Conflict or Clean Status line */}
                            {hasConflict ? (
                              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 mt-0.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>
                                  ⚠️ {conflicts[0].bedLabel} 침대에 게스트 예약 중복 (
                                  {conflicts.length}박: {conflicts[0].guestName} 외) — 해당 날짜만 다른 위치/샤바나/숙박안함으로 바꾸거나 기본 침대를 변경해 주세요!
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-xs text-emerald-700 font-medium mt-0.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>
                                  14일 일정 내 게스트 침대 충돌 없음 (기본값:{' '}
                                  {member.current_bed_id !== null &&
                                  member.location_note === '침대'
                                    ? `${currentBedLabel} 침대`
                                    : member.location_note === '외박'
                                    ? '숙박 안 함 (외박)'
                                    : member.location_note}
                                  )
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Current Default Location Badge & Quick Fix Button */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {hasConflict && recommendedBed && (
                            <button
                              type="button"
                              onClick={() =>
                                onChangeStaffLocation(
                                  member.id,
                                  recommendedBed.id,
                                  '침대'
                                )
                              }
                              disabled={isUpdating}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs transition-colors cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              빈 침대({formatBedCode(recommendedBed)})로 자동 이동
                            </button>
                          )}
                          {customDatesCount > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                onChangeStaffDateLocation(
                                  member,
                                  Object.keys(member.daily_assignments || {}),
                                  null,
                                  null
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 cursor-pointer"
                              title="날짜별로 개별 지정한 내역을 모두 초기화하고 기본값으로 통일합니다"
                            >
                              <RotateCcw className="w-3 h-3" />
                              개별 날짜 지정 초기화 ({customDatesCount}일)
                            </button>
                          )}
                          <div className="px-3 py-1 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-800 shadow-2xs">
                            기본 배정:{' '}
                            <span className="text-indigo-700">
                              {member.current_bed_id !== null &&
                              member.location_note === '침대'
                                ? `${currentBedLabel} (침대)`
                                : member.location_note === '외박'
                                ? '숙박 안 함 (외박)'
                                : member.location_note}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 14-Day Per-Date Accommodation Schedule Strip */}
                  <div className="mt-3 bg-white rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          📅 날짜별 숙박 지정 (14일 스케줄) — 각 날짜별로 드롭다운을 바꾸거나 날짜를 클릭해 선택 후 아래 버튼으로 일괄 지정하세요
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {selectedDates.length > 0 ? (
                          <>
                            <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[11px] font-extrabold">
                              {selectedDates.length}개 날짜 선택됨 (아래 버튼 클릭 시 선택 날짜에만 적용)
                            </span>
                            <button
                              type="button"
                              onClick={() => clearDateSelection(member.id)}
                              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                            >
                              선택 해제
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedDatesByStaff((prev) => ({
                                ...prev,
                                [member.id]: [...dateStrings],
                              }))
                            }
                            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                          >
                            14일 전체 선택
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-7 lg:grid-cols-14 gap-1.5">
                      {dateStrings.map((dStr) => {
                        const dObj = parseISO(dStr);
                        const assign = getStaffAssignmentForDate(member, dStr);
                        const isSelectedDate = selectedDates.includes(dStr);
                        const isToday = dStr === todayStr;

                        // Check conflict on this date
                        const hasDateConflict =
                          assign.location_note === '침대' &&
                          assign.bed_id !== null &&
                          reservations.some(
                            (r) =>
                              r.bed_id === assign.bed_id &&
                              r.check_in <= dStr &&
                              dStr < r.check_out
                          );

                        const selectValue =
                          assign.location_note === '침대' &&
                          assign.bed_id !== null
                            ? `BED:${assign.bed_id}`
                            : `LOC:${assign.location_note}`;

                        return (
                          <div
                            key={dStr}
                            className={`rounded-lg border p-1.5 flex flex-col justify-between gap-1 transition-all ${
                              isSelectedDate
                                ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-400'
                                : hasDateConflict
                                ? 'border-amber-400 bg-amber-50'
                                : assign.location_note === '외박'
                                ? 'border-slate-200 bg-slate-100/70 opacity-75'
                                : assign.location_note === '샤바나'
                                ? 'border-purple-300 bg-purple-50/60'
                                : 'border-emerald-200 bg-emerald-50/40'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleDateSelection(member.id, dStr)}
                              className="flex items-center justify-between text-left w-full cursor-pointer"
                              title="클릭하여 날짜 선택/해제"
                            >
                              <span
                                className={`text-[10px] font-extrabold ${
                                  isToday ? 'text-indigo-700' : 'text-slate-700'
                                }`}
                              >
                                {format(dObj, 'M/d(EEE)', { locale: ko })}
                              </span>
                              {assign.isCustomDate && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-indigo-600"
                                  title="개별 날짜 지정됨"
                                />
                              )}
                            </button>

                            <select
                              value={selectValue}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val.startsWith('BED:')) {
                                  const bId = Number(val.replace('BED:', ''));
                                  onChangeStaffDateLocation(
                                    member,
                                    [dStr],
                                    bId,
                                    '침대'
                                  );
                                } else {
                                  const loc = val.replace(
                                    'LOC:',
                                    ''
                                  ) as StaffLocationNote;
                                  onChangeStaffDateLocation(
                                    member,
                                    [dStr],
                                    loc === '샤바나' && shabanaBed
                                      ? shabanaBed.id
                                      : null,
                                    loc
                                  );
                                }
                              }}
                              className={`w-full rounded border px-1 py-0.5 text-[10px] font-extrabold focus:outline-none cursor-pointer ${
                                hasDateConflict
                                  ? 'bg-amber-500 text-white border-amber-600'
                                  : assign.location_note === '외박'
                                  ? 'bg-slate-200 text-slate-700 border-slate-300'
                                  : assign.location_note === '샤바나'
                                  ? 'bg-purple-600 text-white border-purple-700'
                                  : assign.location_note === '침대'
                                  ? 'bg-emerald-600 text-white border-emerald-700'
                                  : 'bg-indigo-600 text-white border-indigo-700'
                              }`}
                            >
                              <option
                                value="LOC:외박"
                                className="bg-white text-rose-700 font-bold"
                              >
                                🚫 숙박안함
                              </option>
                              <option
                                value="LOC:샤바나"
                                className="bg-white text-purple-800 font-bold"
                              >
                                ⛺ 샤바나
                              </option>
                              <option
                                value="LOC:거실"
                                className="bg-white text-slate-900 font-bold"
                              >
                                🛋️ 거실
                              </option>
                              <option
                                value="LOC:사장님방"
                                className="bg-white text-slate-900 font-bold"
                              >
                                🏠 사장님방
                              </option>
                              <optgroup
                                label="객실 침대"
                                className="bg-white text-slate-900"
                              >
                                {regularBeds.map((b) => (
                                  <option
                                    key={b.id}
                                    value={`BED:${b.id}`}
                                    className="bg-white text-slate-900 font-bold"
                                  >
                                    🛏️ {formatBedCode(b)}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 1-Click Special Non-Bed Locations ('샤바나' | '거실' | '사장님방' | '외박') */}
                  <div className="mt-3">
                    <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                      <Home className="w-3 h-3" />
                      {selectedDates.length > 0 ? (
                        <span className="text-indigo-700 font-extrabold">
                          📌 선택한 {selectedDates.length}개 날짜를 아래 위치로 일괄 지정:
                        </span>
                      ) : (
                        <span>
                          기본 취침 위치를 침대 외 상태로 1-Click 전환 (샤바나 · 거실 · 사장님방: 숙박 포함 / 숙박 안 함: 인원 제외):
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {NON_BED_LOCATIONS.map((loc) => {
                        const isSelected =
                          selectedDates.length === 0 &&
                          (member.current_bed_id === null ||
                            loc.note === '샤바나') &&
                          member.location_note === loc.note;

                        return (
                          <button
                            key={loc.note}
                            type="button"
                            disabled={isUpdating}
                            onClick={() =>
                              applyLocationOrDateBatch(
                                loc.note === '샤바나' && shabanaBed
                                  ? shabanaBed.id
                                  : null,
                                loc.note
                              )
                            }
                            className={`flex flex-col items-center justify-center py-2 px-2 rounded-lg border text-xs transition-all cursor-pointer ${
                              isSelected
                                ? loc.note === '외박'
                                  ? 'bg-slate-800 text-white border-slate-800 font-bold shadow-xs'
                                  : loc.note === '샤바나'
                                  ? 'bg-purple-600 text-white border-purple-600 font-bold shadow-xs'
                                  : 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 font-semibold'
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              <DoorOpen className="w-3.5 h-3.5" />
                              <span>{loc.label}</span>
                            </div>
                            <span
                              className={`text-[10px] mt-0.5 ${
                                isSelected ? 'text-white/80' : 'text-slate-400'
                              }`}
                            >
                              {loc.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 1-Click Bed Switcher (All 12 Regular Beds) */}
                  <div className="mt-3">
                    <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                      <BedIcon className="w-3 h-3" />
                      {selectedDates.length > 0 ? (
                        <span className="text-indigo-700 font-extrabold">
                          📌 선택한 {selectedDates.length}개 날짜를 특정 객실 침대로 일괄 배정:
                        </span>
                      ) : (
                        <span>객실 침대로 기본 위치 1-Click 배정 (총 12베드):</span>
                      )}
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
                      {regularBeds.map((bed) => {
                        const isCurrentBed =
                          selectedDates.length === 0 &&
                          member.current_bed_id === bed.id &&
                          member.location_note === '침대';
                        const { occupiedByOtherStaff, hasConflictInWindow } =
                          getBedStatusForStaff(bed, member, selectedDates);

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
                              applyLocationOrDateBatch(bed.id, '침대')
                            }
                            title={
                              hasConflictInWindow
                                ? `${formatBedCode(bed)} (${bed.room_name}): 일정 중 게스트 예약이 있습니다`
                                : `${formatBedCode(bed)} (${bed.room_name}): 비어있음`
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
        )}
      </div>
    </section>
  );
}
