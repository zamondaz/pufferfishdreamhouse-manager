'use client';

import React from 'react';
import {
  AlertTriangle,
  BedDouble,
  CalendarPlus,
  Database,
  RotateCcw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Bed, Reservation, Staff } from '@/types/guesthouse';

interface HeaderSummaryProps {
  todayStr: string;
  beds: Bed[];
  reservations: Reservation[];
  staff: Staff[];
  usingMock: boolean;
  totalConflictCount: number;
  onOpenNewReservation: () => void;
  onResetMock: () => void;
}

export default function HeaderSummary({
  todayStr,
  beds,
  reservations,
  staff,
  usingMock,
  totalConflictCount,
  onOpenNewReservation,
  onResetMock,
}: HeaderSummaryProps) {
  // Guests sleeping tonight: check_in <= todayStr < check_out
  const tonightGuests = reservations.filter(
    (r) => r.check_in <= todayStr && todayStr < r.check_out
  );

  // Staff active today: check_in <= todayStr < check_out
  const activeStaffToday = staff.filter(
    (s) => s.check_in <= todayStr && todayStr < s.check_out
  );

  // Staff sleeping inside the guesthouse tonight (침대, 거실, 사장님방 — excluding '외부')
  const tonightStaffInside = activeStaffToday.filter((s) => s.location_note !== '외부');
  const tonightStaffOutside = activeStaffToday.filter((s) => s.location_note === '외부');

  const totalHeadcountTonight = tonightGuests.length + tonightStaffInside.length;

  const maleGuestsTonight = tonightGuests.filter((g) => g.gender === 'M').length;
  const femaleGuestsTonight = tonightGuests.filter((g) => g.gender === 'F').length;

  // Occupied beds tonight (unique beds used by guests or non-conflicted staff in bed)
  const occupiedBedIdsTonight = new Set<number>();
  tonightGuests.forEach((g) => occupiedBedIdsTonight.add(g.bed_id));
  tonightStaffInside.forEach((s) => {
    if (s.current_bed_id !== null) {
      occupiedBedIdsTonight.add(s.current_bed_id);
    }
  });

  return (
    <header className="bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
        {/* Top Row: Title & Action Buttons */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-2xl shadow-xs">
              🐡
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Pufferfish Manager 🐡
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    usingMock
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  {usingMock ? '로컬 데모 모드 (Mock Data)' : 'Supabase 실시간 연동'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                1인 사장님 맞춤형 게스트하우스 베드맵 &amp; 상주 스태프 침대 관리 시스템
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            {usingMock && (
              <button
                type="button"
                onClick={onResetMock}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                title="데모 데이터를 초기 상태로 되돌립니다"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                데모 초기화
              </button>
            )}
            <button
              type="button"
              onClick={onOpenNewReservation}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-xs transition-all cursor-pointer"
            >
              <CalendarPlus className="w-4 h-4" />
              + 예약 등록 (개인/일행)
            </button>
          </div>
        </div>

        {/* Bottom Row: Today's Summary Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          {/* 1. Primary Headcount Widget (Safety / Indoor Headcount) */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-indigo-100 text-xs font-semibold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                오늘 밤 총 숙박 인원 (안전 관리)
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold">{totalHeadcountTonight}명</span>
                <span className="text-xs text-indigo-100 font-medium">
                  (게스트 {tonightGuests.length} + 내부 스태프 {tonightStaffInside.length})
                </span>
              </div>
              <p className="text-[11px] text-indigo-200 mt-1">
                야간 건물 내 실제 취침 및 안전 점검 기준 인원
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* 2. Tonight's Guest Breakdown */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
                <Users className="w-3.5 h-3.5 text-slate-600" />
                오늘 투숙 게스트 성비
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {tonightGuests.length}명
                </span>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800">
                    남 {maleGuestsTonight}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">
                    여 {femaleGuestsTonight}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                기준일: {todayStr} 체크인 투숙 포함
              </p>
            </div>
          </div>

          {/* 3. Bed Occupancy & Staff Inside Status */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
                <BedDouble className="w-3.5 h-3.5 text-slate-600" />
                오늘 침대 가동률 &amp; 스태프 취침
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {occupiedBedIdsTonight.size} / {beds.length}베드
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  잔여 {Math.max(0, beds.length - occupiedBedIdsTonight.size)}자리
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                스태프 내부 취침 {tonightStaffInside.length}명
                {tonightStaffOutside.length > 0
                  ? ` · 외부 취침 ${tonightStaffOutside.length}명 (인원 제외)`
                  : ''}
              </p>
            </div>
          </div>

          {/* 4. Staff Bed Conflict Status */}
          <div
            className={`rounded-2xl p-4 border flex items-center justify-between ${
              totalConflictCount > 0
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            }`}
          >
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <AlertTriangle
                  className={`w-4 h-4 ${
                    totalConflictCount > 0 ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                />
                {totalConflictCount > 0
                  ? '스태프 침대 중복 경고 (⚠️)'
                  : '스태프 배정 충돌 없음'}
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold">
                  {totalConflictCount > 0 ? `${totalConflictCount}건 충돌` : '정상 운영 중'}
                </span>
              </div>
              <p className="text-[11px] mt-1 opacity-80">
                {totalConflictCount > 0
                  ? '아래 스태프 컨트롤러에서 빈 침대나 거실/사장님방으로 변경하세요.'
                  : '표시된 14일 일정 내 게스트-스태프 침대 충돌이 없습니다.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
