'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import HeaderSummary from '@/components/HeaderSummary';
import QuickAutoReservationBar from '@/components/QuickAutoReservationBar';
import StaffLocationController from '@/components/StaffLocationController';
import BedMapCalendar from '@/components/BedMapCalendar';
import ReservationModal from '@/components/ReservationModal';
import {
  createReservations,
  deleteReservation,
  fetchGuesthouseData,
  formatBedCode,
  INITIAL_BEDS,
  updateReservation,
  updateStaffLocation,
  updateStaffProfile,
} from '@/lib/supabase';
import {
  Bed,
  CreateReservationsPayload,
  Reservation,
  Staff,
  StaffLocationNote,
  UpdateReservationPayload,
  UpdateStaffProfilePayload,
} from '@/types/guesthouse';

const FALLBACK_DATE = new Date(2026, 9, 27);

export default function PufferfishDashboardPage() {
  const [todayDate, setTodayDate] = useState<Date>(FALLBACK_DATE);
  const todayStr = useMemo(() => format(todayDate, 'yyyy-MM-dd'), [todayDate]);

  const [startDate, setStartDate] = useState<Date>(FALLBACK_DATE);
  const [beds, setBeds] = useState<Bed[]>(INITIAL_BEDS);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingStaffId, setUpdatingStaffId] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalInitialBedId, setModalInitialBedId] = useState<number | null>(1);
  const [modalInitialCheckIn, setModalInitialCheckIn] =
    useState<string>(todayStr);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await fetchGuesthouseData();
    setBeds(data.beds);
    setReservations(data.reservations);
    setStaff(data.staff);
    setLoading(false);
  }, []);

  useEffect(() => {
    const now = new Date();
    setTodayDate(now);
    setStartDate(now);
    loadData();
  }, [loadData]);

  // 14-day window date strings
  const dateStrings = useMemo(() => {
    return Array.from({ length: 14 }, (_, idx) =>
      format(addDays(startDate, idx), 'yyyy-MM-dd')
    );
  }, [startDate]);

  // Count total conflict cell-days in the visible 14-day window
  const totalConflictCount = useMemo(() => {
    let count = 0;
    for (const dStr of dateStrings) {
      for (const s of staff) {
        if (s.current_bed_id === null) continue;
        const staffActive = s.check_in <= dStr && dStr < s.check_out;
        if (!staffActive) continue;

        const hasGuest = reservations.some(
          (r) =>
            r.bed_id === s.current_bed_id &&
            r.check_in <= dStr &&
            dStr < r.check_out
        );
        if (hasGuest) count++;
      }
    }
    return count;
  }, [dateStrings, staff, reservations]);

  const handleOpenNewReservation = () => {
    setModalInitialBedId(null);
    setModalInitialCheckIn(todayStr);
    setIsModalOpen(true);
  };

  const handleClickEmptyCell = (bedId: number, dateStr: string) => {
    setModalInitialBedId(bedId);
    setModalInitialCheckIn(dateStr);
    setIsModalOpen(true);
  };

  const handleCreateReservations = async (
    payload: CreateReservationsPayload
  ) => {
    const { created, groupCode } = await createReservations(payload);
    setReservations((prev) => [...prev, ...created]);
    if (groupCode) {
      showToast(
        `✅ ${created.length}명 일행 예약이 등록되었습니다! (그룹코드: ${groupCode})`
      );
    } else {
      showToast(`✅ '${created[0]?.guest_name}' 게스트 예약이 등록되었습니다.`);
    }
  };

  const handleUpdateReservation = async (
    payload: UpdateReservationPayload
  ) => {
    const updatedList = await updateReservation(payload);
    setReservations(updatedList);
    const bedObj = beds.find((b) => b.id === Number(payload.bed_id));
    const bedLabel = bedObj ? formatBedCode(bedObj) : `#${payload.bed_id}`;
    showToast(
      `✏️ '${payload.guest_name}' 예약이 수정되었습니다. (${bedLabel} · ${payload.check_in}~${payload.check_out})`
    );
  };

  const handleDeleteReservation = async (reservationId: string) => {
    const target = reservations.find((r) => r.id === reservationId);
    await deleteReservation(reservationId);
    setReservations((prev) => prev.filter((r) => r.id !== reservationId));
    if (target) {
      showToast(`🗑️ '${target.guest_name}' 예약이 삭제되었습니다.`);
    }
  };

  const handleChangeStaffLocation = async (
    staffId: string,
    bedId: number | null,
    locationNote: StaffLocationNote
  ) => {
    setUpdatingStaffId(staffId);
    try {
      const updated = await updateStaffLocation(staffId, bedId, locationNote);
      if (updated) {
        setStaff((prev) =>
          prev.map((s) => (s.id === staffId ? updated : s))
        );
        const bedObj =
          bedId !== null ? beds.find((b) => b.id === bedId) : null;
        const label = bedObj
          ? `${formatBedCode(bedObj)} 침대`
          : locationNote;
        showToast(`🛏️ ${updated.name} 취침 위치가 '${label}'(으)로 변경되었습니다.`);
      }
    } finally {
      setUpdatingStaffId(null);
    }
  };

  const handleUpdateStaffProfile = async (
    payload: UpdateStaffProfilePayload
  ) => {
    const updated = await updateStaffProfile(payload);
    if (updated) {
      setStaff((prev) =>
        prev.map((s) => (s.id === payload.id ? updated : s))
      );
      showToast(
        `👤 스태프 프로필이 '${updated.name} (${updated.gender === 'M' ? '남' : '여'})'(으)로 변경되었습니다.`
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 text-xs sm:text-sm font-bold animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* 1. Header & Today's Summary Widget */}
      <HeaderSummary
        todayStr={todayStr}
        beds={beds}
        reservations={reservations}
        staff={staff}
        totalConflictCount={totalConflictCount}
        onOpenNewReservation={handleOpenNewReservation}
      />

      {/* Main Content */}
      <main className="flex-1">
        {loading ? (
          <div className="max-w-[1600px] mx-auto px-6 py-16 text-center">
            <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-600">
              Pufferfish Manager 데이터를 불러오는 중입니다...
            </p>
          </div>
        ) : (
          <>
            {/* 1. 맨 위: 원클릭 손님 추가 (QuickAutoReservationBar) */}
            <QuickAutoReservationBar
              todayStr={todayStr}
              beds={beds}
              reservations={reservations}
              staff={staff}
              onSubmitAutoReservation={handleCreateReservations}
            />

            {/* 2. 그 밑에: 베드맵 캘린더 (BedMapCalendar) */}
            <BedMapCalendar
              beds={beds}
              reservations={reservations}
              staff={staff}
              todayStr={todayStr}
              startDate={startDate}
              onChangeStartDate={setStartDate}
              onClickEmptyCell={handleClickEmptyCell}
              onUpdateReservation={handleUpdateReservation}
              onDeleteReservation={handleDeleteReservation}
            />

            {/* 3. 그 밑에: 스태프 자리 배정 (StaffLocationController) */}
            <StaffLocationController
              staff={staff}
              beds={beds}
              reservations={reservations}
              todayStr={todayStr}
              dateStrings={dateStrings}
              updatingStaffId={updatingStaffId}
              onChangeStaffLocation={handleChangeStaffLocation}
              onUpdateStaffProfile={handleUpdateStaffProfile}
            />
          </>
        )}
      </main>

      {/* 4. Reservation Modal (with [+ 일행 추가] Group Add) */}
      <ReservationModal
        isOpen={isModalOpen}
        initialBedId={modalInitialBedId}
        initialCheckIn={modalInitialCheckIn}
        beds={beds}
        reservations={reservations}
        staff={staff}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateReservations}
      />
    </div>
  );
}
