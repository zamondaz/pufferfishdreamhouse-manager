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
  createStaff,
  deleteReservation,
  deleteStaff,
  fetchGuesthouseData,
  formatBedCode,
  getStaffAssignmentForDate,
  INITIAL_BEDS,
  updateReservation,
  updateStaffDateAssignments,
  updateStaffLocation,
  updateStaffProfile,
} from '@/lib/supabase';
import {
  Bed,
  CreateReservationsPayload,
  CreateStaffPayload,
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

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const data = await fetchGuesthouseData();
    setBeds(data.beds);
    setReservations(data.reservations);
    setStaff(data.staff);
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    const now = new Date();
    setTodayDate(now);
    setStartDate(now);
    loadData(false);

    const onFocus = () => loadData(true);
    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(() => loadData(true), 15000);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, [loadData]);

  // 14-day window date strings
  const dateStrings = useMemo(() => {
    return Array.from({ length: 14 }, (_, idx) =>
      format(addDays(startDate, idx), 'yyyy-MM-dd')
    );
  }, [startDate]);

  // Count total conflict cell-days in the visible 14-day window (per-date schedule aware; 샤바나 excluded)
  const totalConflictCount = useMemo(() => {
    let count = 0;
    for (const dStr of dateStrings) {
      for (const s of staff) {
        const assign = getStaffAssignmentForDate(s, dStr);
        if (assign.bed_id === null || assign.location_note !== '침대') continue;
        const bedObj = beds.find((b) => b.id === assign.bed_id);
        if (bedObj?.room_name === '샤바나') continue;

        const hasGuest = reservations.some(
          (r) =>
            r.bed_id === assign.bed_id &&
            r.check_in <= dStr &&
            dStr < r.check_out
        );
        if (hasGuest) count++;
      }
    }
    return count;
  }, [dateStrings, staff, reservations, beds]);

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
        const label =
          bedObj && locationNote === '침대'
            ? `${formatBedCode(bedObj)} 침대`
            : locationNote === '외박'
            ? '숙박 안 함(외박)'
            : locationNote;
        showToast(
          `🛏️ ${updated.name} 기본 취침 위치가 '${label}'(으)로 변경되었습니다.`
        );
      }
    } finally {
      setUpdatingStaffId(null);
    }
  };

  const handleChangeStaffDateLocation = async (
    staffMember: Staff,
    dates: string[],
    bedId: number | null,
    locationNote: StaffLocationNote | null
  ) => {
    setUpdatingStaffId(staffMember.id);
    try {
      const updated = await updateStaffDateAssignments(
        staffMember,
        dates,
        bedId,
        locationNote
      );
      setStaff((prev) =>
        prev.map((s) => (s.id === staffMember.id ? updated : s))
      );

      if (locationNote === null) {
        showToast(
          `🔄 ${staffMember.name}님의 날짜별 개별 숙박 지정이 기본값으로 초기화되었습니다.`
        );
      } else {
        const bedObj =
          bedId !== null ? beds.find((b) => b.id === bedId) : null;
        const label =
          bedObj && locationNote === '침대'
            ? `${formatBedCode(bedObj)} 침대`
            : locationNote === '외박'
            ? '숙박 안 함(외박)'
            : locationNote;
        const dateDesc =
          dates.length === 1 ? dates[0] : `${dates.length}개 날짜`;
        showToast(
          `📅 ${staffMember.name}님의 [${dateDesc}] 숙박이 '${label}'(으)로 지정되었습니다.`
        );
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

  const handleCreateStaff = async (payload: CreateStaffPayload) => {
    const created = await createStaff(payload);
    if (created) {
      setStaff((prev) => [...prev, created]);
      showToast(
        `➕ 새 스태프 '${created.name} (${created.gender === 'M' ? '남' : '여'})'님이 추가되었습니다.`
      );
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    const target = staff.find((s) => s.id === staffId);
    await deleteStaff(staffId);
    setStaff((prev) => prev.filter((s) => s.id !== staffId));
    if (target) {
      showToast(`🗑️ 스태프 '${target.name}'님이 삭제되었습니다.`);
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
              onChangeStaffDateLocation={handleChangeStaffDateLocation}
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
              onChangeStaffDateLocation={handleChangeStaffDateLocation}
              onUpdateStaffProfile={handleUpdateStaffProfile}
              onCreateStaff={handleCreateStaff}
              onDeleteStaff={handleDeleteStaff}
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
