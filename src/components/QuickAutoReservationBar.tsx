'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import {
  AlertCircle,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Wand2,
} from 'lucide-react';
import { autoAssignEmptyBeds, formatBedCode } from '@/lib/supabase';
import {
  Bed,
  CreateReservationsPayload,
  Gender,
  Reservation,
  Staff,
} from '@/types/guesthouse';

interface QuickAutoReservationBarProps {
  todayStr: string;
  beds: Bed[];
  reservations: Reservation[];
  staff: Staff[];
  onSubmitAutoReservation: (payload: CreateReservationsPayload) => Promise<void>;
}

interface QuickGuestInput {
  guest_name: string;
  gender: Gender;
}

export default function QuickAutoReservationBar({
  todayStr,
  beds,
  reservations,
  staff,
  onSubmitAutoReservation,
}: QuickAutoReservationBarProps) {
  const [checkIn, setCheckIn] = useState<string>(todayStr);
  const [checkOut, setCheckOut] = useState<string>(() =>
    format(addDays(parseISO(todayStr), 1), 'yyyy-MM-dd')
  );
  const [preferredRoom, setPreferredRoom] = useState<string>('AUTO');
  const [guests, setGuests] = useState<QuickGuestInput[]>([
    { guest_name: '', gender: 'M' },
  ]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Sync initial todayStr when mounted
  useEffect(() => {
    setCheckIn(todayStr);
    setCheckOut(format(addDays(parseISO(todayStr), 1), 'yyyy-MM-dd'));
  }, [todayStr]);

  const nightsCount = useMemo(() => {
    try {
      return Math.max(
        0,
        differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn))
      );
    } catch {
      return 0;
    }
  }, [checkIn, checkOut]);

  // Real-time auto-assigned bed preview
  const autoAllocation = useMemo(() => {
    return autoAssignEmptyBeds({
      checkIn,
      checkOut,
      guestCount: guests.length,
      beds,
      reservations,
      staff,
      preferredRoom,
    });
  }, [checkIn, checkOut, guests.length, beds, reservations, staff, preferredRoom]);

  const assignedBedObjects = useMemo(() => {
    return autoAllocation.assignedBedIds
      .map((id) => beds.find((b) => b.id === id))
      .filter((b): b is Bed => Boolean(b));
  }, [autoAllocation.assignedBedIds, beds]);

  const handleSetNights = (nights: number) => {
    if (!checkIn) return;
    setCheckOut(format(addDays(parseISO(checkIn), nights), 'yyyy-MM-dd'));
    setErrorMsg(null);
  };

  const handleAddCompanion = () => {
    setErrorMsg(null);
    setGuests((prev) => [...prev, { guest_name: '', gender: 'M' }]);
  };

  const handleRemoveCompanion = (idx: number) => {
    if (guests.length <= 1) return;
    setErrorMsg(null);
    setGuests((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateGuest = (idx: number, patch: Partial<QuickGuestInput>) => {
    setErrorMsg(null);
    setGuests((prev) =>
      prev.map((g, i) => (i === idx ? { ...g, ...patch } : g))
    );
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setErrorMsg('체크아웃 날짜는 체크인 날짜보다 이후여야 합니다.');
      return;
    }

    for (let i = 0; i < guests.length; i++) {
      if (!guests[i].guest_name.trim()) {
        setErrorMsg(`${i + 1}번째 투숙객 이름을 입력해 주세요.`);
        return;
      }
    }

    if (autoAllocation.assignedBedIds.length < guests.length) {
      setErrorMsg(
        `선택한 일정(${checkIn}~${checkOut})에 빈 침대가 부족합니다. (남은 빈 침대: ${autoAllocation.totalAvailableCount}개 / 요청 인원: ${guests.length}명)`
      );
      return;
    }

    try {
      setSubmitting(true);
      await onSubmitAutoReservation({
        check_in: checkIn,
        check_out: checkOut,
        guests: guests.map((g, idx) => ({
          guest_name: g.guest_name.trim(),
          gender: g.gender,
          bed_id: autoAllocation.assignedBedIds[idx],
        })),
      });
      // Reset guest inputs for immediate next entry
      setGuests([{ guest_name: '', gender: 'M' }]);
    } catch {
      setErrorMsg('자동 배정 예약 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const notEnoughBeds = autoAllocation.assignedBedIds.length < guests.length;

  return (
    <section className="max-w-[1600px] mx-auto px-4 sm:px-6 mt-5">
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white rounded-2xl border border-indigo-800/60 shadow-sm p-4 sm:p-5">
        {/* Header Row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 pb-3.5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/25 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold tracking-tight text-white">
                  ⚡ 원클릭 빈방 자동 배정 예약
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  체크인·체크아웃·이름만 입력하면 빈 침대 자동 배정
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                일행 추가 시 같은 객실의 빈 침대를 최우선으로 묶어서 배정하며, 공통 그룹 색상으로 자동 연결됩니다.
              </p>
            </div>
          </div>

          {/* Live Auto-Assigned Beds Preview */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-indigo-200">
              자동 배정 예정 침대:
            </span>
            {notEnoughBeds ? (
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs font-bold">
                ❌ 해당 기간 잔여 침대 부족 ({autoAllocation.totalAvailableCount}자리 남음)
              </span>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                {assignedBedObjects.map((b, i) => (
                  <span
                    key={`${b.id}-${i}`}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-extrabold flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-300" />
                    {guests[i]?.guest_name
                      ? `${guests[i].guest_name} → `
                      : `인원${i + 1} → `}
                    {formatBedCode(b)}
                  </span>
                ))}
                {autoAllocation.usesStaffBed && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/25 border border-amber-400/40 text-amber-200 text-[11px] font-bold">
                    ⚠️ 스태프 침대 포함 (등록 후 스태프 이동 가능)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleQuickSubmit} className="pt-4 space-y-3.5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
            {/* 1. Check-In & Check-Out + Quick Nights */}
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-white/5 p-3 rounded-xl border border-white/10">
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-bold text-indigo-200 mb-1">
                  체크인 (Check-In)
                </label>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCheckIn(val);
                    if (val && checkOut <= val) {
                      setCheckOut(
                        format(addDays(parseISO(val), 1), 'yyyy-MM-dd')
                      );
                    }
                  }}
                  className="w-full rounded-lg bg-slate-800 border border-slate-600 px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  required
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-[11px] font-bold text-indigo-200 mb-1">
                  체크아웃 ({nightsCount}박)
                </label>
                <input
                  type="date"
                  value={checkOut}
                  min={
                    checkIn
                      ? format(addDays(parseISO(checkIn), 1), 'yyyy-MM-dd')
                      : undefined
                  }
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full rounded-lg bg-slate-800 border border-slate-600 px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  required
                />
              </div>

              <div className="sm:col-span-2 flex sm:flex-col justify-end gap-1">
                <span className="text-[10px] font-semibold text-slate-400 hidden sm:block">
                  박수 선택
                </span>
                <div className="flex sm:grid sm:grid-cols-3 gap-1 w-full">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleSetNights(n)}
                      className={`px-1.5 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                        nightsCount === n
                          ? 'bg-indigo-500 text-white border-indigo-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {n}박
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Preferred Room Filter */}
            <div className="lg:col-span-2 bg-white/5 p-3 rounded-xl border border-white/10">
              <label className="block text-[11px] font-bold text-indigo-200 mb-1">
                희망 객실 우선순위
              </label>
              <select
                value={preferredRoom}
                onChange={(e) => setPreferredRoom(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-600 px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="AUTO">✨ 자동 맞춤 (같은 방 우선)</option>
                <option value="5인실">5인실 우선 (5-1 ~ 5-5)</option>
                <option value="4인실">4인실 우선 (4-1 ~ 4-4)</option>
                <option value="2인실">2인실 우선 (2-1 ~ 2-2)</option>
                <option value="1인실">1인실 우선 (1-1 · 2인 함께 사용 가능)</option>
              </select>
            </div>

            {/* 3. Guests & One-Click Submit */}
            <div className="lg:col-span-5 bg-white/5 p-3 rounded-xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-200 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  투숙객 정보 ({guests.length}명
                  {guests.length > 1 ? ' · 일행 같은 색상 그룹 묶음' : ' · 개인'})
                </span>
                <button
                  type="button"
                  onClick={handleAddCompanion}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/30 hover:bg-indigo-500/50 border border-indigo-400/40 text-[11px] font-bold text-indigo-100 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3 h-3" />+ 일행 추가
                </button>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {guests.map((g, idx) => {
                  const targetBed = assignedBedObjects[idx];
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        placeholder={
                          guests.length > 1
                            ? `일행 ${idx + 1} 이름`
                            : '투숙객 이름 (예: 김복어)'
                        }
                        value={g.guest_name}
                        onChange={(e) =>
                          handleUpdateGuest(idx, { guest_name: e.target.value })
                        }
                        className="flex-1 min-w-0 rounded-lg bg-slate-800 border border-slate-600 px-2.5 py-1.5 text-xs font-semibold text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        required
                      />

                      <div className="inline-flex rounded-lg overflow-hidden border border-slate-600 shrink-0">
                        {(['M', 'F'] as Gender[]).map((genderKey) => (
                          <button
                            key={genderKey}
                            type="button"
                            onClick={() =>
                              handleUpdateGuest(idx, { gender: genderKey })
                            }
                            className={`px-2 py-1.5 text-xs font-extrabold transition-colors cursor-pointer ${
                              g.gender === genderKey
                                ? genderKey === 'M'
                                  ? 'bg-sky-600 text-white'
                                  : 'bg-rose-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            {genderKey === 'M' ? '남' : '여'}
                          </button>
                        ))}
                      </div>

                      <span className="px-2 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-[11px] font-bold text-emerald-300 shrink-0">
                        {targetBed ? formatBedCode(targetBed) : '만실'}
                      </span>

                      {guests.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCompanion(idx)}
                          className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                          title="인원 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="submit"
                disabled={submitting || notEnoughBeds}
                className="w-full py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Wand2 className="w-4 h-4" />
                {submitting
                  ? '자동 배정 중...'
                  : guests.length > 1
                  ? `⚡ ${guests.length}명 일행 빈방 자동 배정 & 원클릭 등록`
                  : '⚡ 빈방 자동 배정 & 원클릭 예약 등록'}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
