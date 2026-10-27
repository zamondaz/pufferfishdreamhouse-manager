'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import {
  AlertCircle,
  CalendarPlus,
  Check,
  Trash2,
  UserPlus,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import {
  autoAssignEmptyBeds,
  formatBedCode,
  getBedMaxCapacity,
} from '@/lib/supabase';
import {
  Bed,
  CreateReservationsPayload,
  Gender,
  NewReservationGuestInput,
  Reservation,
  Staff,
} from '@/types/guesthouse';

interface ReservationModalProps {
  isOpen: boolean;
  initialBedId: number | null;
  initialCheckIn: string;
  beds: Bed[];
  reservations: Reservation[];
  staff: Staff[];
  onClose: () => void;
  onSubmit: (payload: CreateReservationsPayload) => Promise<void>;
}

export default function ReservationModal({
  isOpen,
  initialBedId,
  initialCheckIn,
  beds,
  reservations,
  staff,
  onClose,
  onSubmit,
}: ReservationModalProps) {
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(
    format(addDays(parseISO(initialCheckIn), 1), 'yyyy-MM-dd')
  );
  const [guests, setGuests] = useState<NewReservationGuestInput[]>([
    {
      guest_name: '',
      gender: 'M',
      bed_id: initialBedId || beds[0]?.id || 1,
    },
  ]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Sync initial values when modal opens
  useEffect(() => {
    if (isOpen) {
      const nextDay = format(
        addDays(parseISO(initialCheckIn), 1),
        'yyyy-MM-dd'
      );
      setCheckIn(initialCheckIn);
      setCheckOut(nextDay);

      let startingBedId = initialBedId;
      if (!startingBedId) {
        const auto = autoAssignEmptyBeds({
          checkIn: initialCheckIn,
          checkOut: nextDay,
          guestCount: 1,
          beds,
          reservations,
          staff,
        });
        startingBedId = auto.assignedBedIds[0] || beds[0]?.id || 1;
      }

      setGuests([
        {
          guest_name: '',
          gender: 'M',
          bed_id: startingBedId,
        },
      ]);
      setErrorMsg(null);
    }
  }, [isOpen, initialBedId, initialCheckIn, beds, reservations, staff]);

  // Determine which beds already have guest reservations overlapping [checkIn, checkOut)
  const occupiedBedsByGuestMap = useMemo(() => {
    const map = new Map<number, string[]>();
    if (!checkIn || !checkOut || checkOut <= checkIn) return map;

    reservations.forEach((r) => {
      if (r.check_in < checkOut && r.check_out > checkIn) {
        const list = map.get(r.bed_id) || [];
        list.push(r.guest_name);
        map.set(r.bed_id, list);
      }
    });
    return map;
  }, [reservations, checkIn, checkOut]);

  // Determine which beds are currently assigned to a staff member overlapping [checkIn, checkOut)
  const occupiedBedsByStaffMap = useMemo(() => {
    const map = new Map<number, string>();
    if (!checkIn || !checkOut || checkOut <= checkIn) return map;

    staff.forEach((s) => {
      if (
        s.current_bed_id !== null &&
        s.check_in < checkOut &&
        s.check_out > checkIn
      ) {
        map.set(s.current_bed_id, s.name);
      }
    });
    return map;
  }, [staff, checkIn, checkOut]);

  if (!isOpen) return null;

  const handleAutoAssignAllBeds = (targetGuestCount = guests.length) => {
    setErrorMsg(null);
    const auto = autoAssignEmptyBeds({
      checkIn,
      checkOut,
      guestCount: targetGuestCount,
      beds,
      reservations,
      staff,
    });
    if (auto.assignedBedIds.length < targetGuestCount) {
      setErrorMsg(
        `해당 기간(${checkIn}~${checkOut})에 빈 침대가 부족합니다. (잔여 ${auto.totalAvailableCount}베드)`
      );
      return;
    }
    setGuests((prev) =>
      prev.map((g, idx) => ({
        ...g,
        bed_id: auto.assignedBedIds[idx] ?? g.bed_id,
      }))
    );
  };

  const handleAddCompanion = () => {
    setErrorMsg(null);
    const nextCount = guests.length + 1;
    const auto = autoAssignEmptyBeds({
      checkIn,
      checkOut,
      guestCount: nextCount,
      beds,
      reservations,
      staff,
    });

    if (auto.assignedBedIds.length >= nextCount) {
      // Automatically group all companions into the best matching empty room/beds
      setGuests((prev) => [
        ...prev.map((g, idx) => ({
          ...g,
          bed_id: auto.assignedBedIds[idx],
        })),
        {
          guest_name: '',
          gender: 'M',
          bed_id: auto.assignedBedIds[nextCount - 1],
        },
      ]);
      return;
    }

    const chosenBedIds = new Set(guests.map((g) => Number(g.bed_id)));
    const freeBedNoStaff = beds.find(
      (b) =>
        !occupiedBedsByGuestMap.has(b.id) &&
        !occupiedBedsByStaffMap.has(b.id) &&
        !chosenBedIds.has(b.id)
    );
    const freeBedAny = beds.find(
      (b) => !occupiedBedsByGuestMap.has(b.id) && !chosenBedIds.has(b.id)
    );
    const nextBedId =
      freeBedNoStaff?.id || freeBedAny?.id || beds[0]?.id || 1;

    setGuests((prev) => [
      ...prev,
      {
        guest_name: '',
        gender: 'M',
        bed_id: nextBedId,
      },
    ]);
  };

  const handleRemoveGuestRow = (idx: number) => {
    if (guests.length <= 1) return;
    setGuests((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateGuest = (
    idx: number,
    patch: Partial<NewReservationGuestInput>
  ) => {
    setErrorMsg(null);
    setGuests((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    // Check bed capacity within the batch + existing reservations (1인실 1-1 allows up to 2 guests)
    const batchCountByBed = new Map<number, number>();
    for (const g of guests) {
      const bId = Number(g.bed_id);
      const bedObj = beds.find((x) => x.id === bId);
      const maxCap = bedObj ? getBedMaxCapacity(bedObj) : 1;
      const existingNames = occupiedBedsByGuestMap.get(bId) || [];
      const nextBatchCount = (batchCountByBed.get(bId) || 0) + 1;
      batchCountByBed.set(bId, nextBatchCount);

      if (existingNames.length + nextBatchCount > maxCap) {
        const bedCode = bedObj ? formatBedCode(bedObj) : `#${bId}`;
        if (existingNames.length >= maxCap) {
          setErrorMsg(
            `${bedCode} 침대는 해당 일정에 이미 예약(${existingNames.join(', ')})이 차 있습니다.`
          );
        } else {
          setErrorMsg(
            `${bedCode} 침대는 최대 ${maxCap}명까지만 배정할 수 있습니다. (1인실 1-1만 2인 동반 가능)`
          );
        }
        return;
      }
    }

    try {
      setSubmitting(true);
      await onSubmit({
        check_in: checkIn,
        check_out: checkOut,
        guests,
      });
      onClose();
    } catch {
      setErrorMsg('예약 저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <CalendarPlus className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-base font-extrabold">
                신규 게스트 예약 등록 (개인 / 일행 통합)
              </h3>
              <p className="text-xs text-slate-300">
                [+ 일행 추가] 버튼으로 여러 명을 등록하면 동일한 group_code로 자동 묶입니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Stay Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                체크인 날짜 (Check-In)
              </label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => {
                  const val = e.target.value;
                  setCheckIn(val);
                  if (val && checkOut <= val) {
                    setCheckOut(format(addDays(parseISO(val), 1), 'yyyy-MM-dd'));
                  }
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                체크아웃 날짜 (Check-Out)
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
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          {/* Group Indicator Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-slate-900">
                투숙객 및 침대 배정 ({guests.length}명)
              </span>
              {guests.length > 1 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-300 text-xs font-bold">
                  <Users className="w-3.5 h-3.5" />
                  일행 파티 ({guests.length}명 공통 group_code 자동 부여)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                  1인 개인 투숙 (group_code: null)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAutoAssignAllBeds(guests.length)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                빈방 자동 배정
              </button>
              <button
                type="button"
                onClick={handleAddCompanion}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                [+ 일행 추가]
              </button>
            </div>
          </div>

          {/* Guests List */}
          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {guests.map((guest, index) => {
              const staffOnSelectedBed = occupiedBedsByStaffMap.get(
                Number(guest.bed_id)
              );

              return (
                <div
                  key={index}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    {/* Guest Name */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        투숙객 {index + 1} 성함
                      </label>
                      <input
                        type="text"
                        placeholder="예: 홍길동"
                        value={guest.guest_name}
                        onChange={(e) =>
                          handleUpdateGuest(index, {
                            guest_name: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>

                    {/* Gender ('M' | 'F') */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        성별
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(['M', 'F'] as Gender[]).map((gKey) => {
                          const active = guest.gender === gKey;
                          return (
                            <button
                              key={gKey}
                              type="button"
                              onClick={() =>
                                handleUpdateGuest(index, { gender: gKey })
                              }
                              className={`py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                active
                                  ? gKey === 'M'
                                    ? 'bg-sky-600 text-white border-sky-600'
                                    : 'bg-rose-600 text-white border-rose-600'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {gKey === 'M' ? '남 (M)' : '여 (F)'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bed Select */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        배정 침대 (혼숙 도미토리/객실)
                      </label>
                      <select
                        value={guest.bed_id}
                        onChange={(e) =>
                          handleUpdateGuest(index, {
                            bed_id: Number(e.target.value),
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {beds.map((b) => {
                          const maxCap = getBedMaxCapacity(b);
                          const guestOccupyingList =
                            occupiedBedsByGuestMap.get(b.id) || [];
                          const staffOccupying = occupiedBedsByStaffMap.get(b.id);
                          const chosenByOtherRowCount = guests.filter(
                            (other, oIdx) =>
                              oIdx !== index && Number(other.bed_id) === b.id
                          ).length;

                          const isFullByExisting =
                            guestOccupyingList.length >= maxCap;

                          let statusSuffix = ' (예약 가능)';
                          if (isFullByExisting) {
                            statusSuffix = ` (❌ ${guestOccupyingList.join(', ')} 예약됨)`;
                          } else if (guestOccupyingList.length > 0) {
                            statusSuffix = ` (👫 ${guestOccupyingList.join(', ')} 외 1인 추가 가능)`;
                          } else if (chosenByOtherRowCount > 0) {
                            statusSuffix =
                              maxCap > 1
                                ? ' (👫 일행 2인 함께 선택 가능)'
                                : ' (일행 선택 중)';
                          } else if (staffOccupying) {
                            statusSuffix = ` (⚠️ ${staffOccupying} 배정 침대)`;
                          }

                          return (
                            <option
                              key={b.id}
                              value={b.id}
                              disabled={isFullByExisting}
                            >
                              {formatBedCode(b)} ({b.room_name}
                              {maxCap > 1 ? '·2인가능' : ''})
                              {statusSuffix}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Remove Button */}
                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        disabled={guests.length <= 1}
                        onClick={() => handleRemoveGuestRow(index)}
                        title="일행 삭제"
                        className={`p-2 rounded-lg border transition-colors ${
                          guests.length <= 1
                            ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                            : 'border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {staffOnSelectedBed && (
                    <div className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        현재 <strong>{staffOnSelectedBed}</strong>의 침대입니다. 예약 등록 시 대시보드에 ⚠️ 충돌 경고가 표시되며 스태프 위치를 다른 침대나 거실/사장님방으로 옮길 수 있습니다.
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleAddCompanion}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />+ 일행 한 명 더 추가하기
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {submitting
                  ? '저장 중...'
                  : guests.length > 1
                  ? `${guests.length}명 일행 예약 일괄 등록`
                  : '1명 개인 예약 등록'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
