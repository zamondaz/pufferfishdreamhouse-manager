'use client';

import React, { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  formatBedCode,
  generateGroupCode,
  getBedMaxCapacity,
} from '@/lib/supabase';
import {
  Bed,
  Gender,
  Reservation,
  Staff,
  UpdateReservationPayload,
} from '@/types/guesthouse';

interface BedMapCalendarProps {
  beds: Bed[];
  reservations: Reservation[];
  staff: Staff[];
  todayStr: string;
  startDate: Date;
  onChangeStartDate: (newDate: Date) => void;
  onClickEmptyCell: (bedId: number, dateStr: string) => void;
  onUpdateReservation: (payload: UpdateReservationPayload) => Promise<void>;
  onDeleteReservation: (reservationId: string) => void;
}

const GROUP_PALETTES = [
  {
    name: '퍼플 그룹',
    bg: 'bg-violet-100/95',
    border: 'border-violet-500 border-l-4 border-l-violet-600',
    badgeBg: 'bg-violet-600 text-white',
    text: 'text-violet-950',
    ring: 'ring-violet-500',
  },
  {
    name: '시안 그룹',
    bg: 'bg-cyan-100/95',
    border: 'border-cyan-500 border-l-4 border-l-cyan-600',
    badgeBg: 'bg-cyan-600 text-white',
    text: 'text-cyan-950',
    ring: 'ring-cyan-500',
  },
  {
    name: '푸시아 그룹',
    bg: 'bg-fuchsia-100/95',
    border: 'border-fuchsia-500 border-l-4 border-l-fuchsia-600',
    badgeBg: 'bg-fuchsia-600 text-white',
    text: 'text-fuchsia-950',
    ring: 'ring-fuchsia-500',
  },
  {
    name: '오렌지 그룹',
    bg: 'bg-orange-100/95',
    border: 'border-orange-500 border-l-4 border-l-orange-600',
    badgeBg: 'bg-orange-600 text-white',
    text: 'text-orange-950',
    ring: 'ring-orange-500',
  },
  {
    name: '블루 그룹',
    bg: 'bg-blue-100/95',
    border: 'border-blue-500 border-l-4 border-l-blue-600',
    badgeBg: 'bg-blue-600 text-white',
    text: 'text-blue-950',
    ring: 'ring-blue-500',
  },
  {
    name: '틸 그룹',
    bg: 'bg-teal-100/95',
    border: 'border-teal-500 border-l-4 border-l-teal-600',
    badgeBg: 'bg-teal-600 text-white',
    text: 'text-teal-950',
    ring: 'ring-teal-500',
  },
  {
    name: '핑크 그룹',
    bg: 'bg-pink-100/95',
    border: 'border-pink-500 border-l-4 border-l-pink-600',
    badgeBg: 'bg-pink-600 text-white',
    text: 'text-pink-950',
    ring: 'ring-pink-500',
  },
  {
    name: '라임 그룹',
    bg: 'bg-lime-100/95',
    border: 'border-lime-500 border-l-4 border-l-lime-600',
    badgeBg: 'bg-lime-700 text-white',
    text: 'text-lime-950',
    ring: 'ring-lime-500',
  },
];

export default function BedMapCalendar({
  beds,
  reservations,
  staff,
  todayStr,
  startDate,
  onChangeStartDate,
  onClickEmptyCell,
  onUpdateReservation,
  onDeleteReservation,
}: BedMapCalendarProps) {
  const [hoveredGroupCode, setHoveredGroupCode] = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);

  // Edit form states inside the Reservation Detail/Edit Modal
  const [editGuestName, setEditGuestName] = useState<string>('');
  const [editGender, setEditGender] = useState<Gender>('M');
  const [editBedId, setEditBedId] = useState<number>(1);
  const [editCheckIn, setEditCheckIn] = useState<string>('');
  const [editCheckOut, setEditCheckOut] = useState<string>('');
  const [editGroupCode, setEditGroupCode] = useState<string>('');
  const [syncGroupDates, setSyncGroupDates] = useState<boolean>(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  const openReservationEditor = (res: Reservation) => {
    setSelectedReservation(res);
    setEditGuestName(res.guest_name);
    setEditGender(res.gender);
    setEditBedId(res.bed_id);
    setEditCheckIn(res.check_in);
    setEditCheckOut(res.check_out);
    setEditGroupCode(res.group_code || '');
    setSyncGroupDates(Boolean(res.group_code));
    setEditError(null);
  };

  // Build 14 days array starting from startDate
  const days = useMemo(() => {
    return Array.from({ length: 14 }, (_, idx) => {
      const dateObj = addDays(startDate, idx);
      const dateStr = format(dateObj, 'yyyy-MM-dd');
      const dayOfWeek = dateObj.getDay(); // 0 Sun, 6 Sat
      return {
        dateObj,
        dateStr,
        monthDay: format(dateObj, 'M/d'),
        weekdayShort: format(dateObj, 'EEE', { locale: ko }),
        isToday: dateStr === todayStr,
        isSunday: dayOfWeek === 0,
        isSaturday: dayOfWeek === 6,
      };
    });
  }, [startDate, todayStr]);

  // Group beds by room_name preserving order: 5인실, 4인실, 2인실, 1인실
  const groupedRooms = useMemo(() => {
    const order = ['5인실', '4인실', '2인실', '1인실'];
    const map = new Map<string, Bed[]>();
    order.forEach((r) => map.set(r, []));

    beds.forEach((b) => {
      const list = map.get(b.room_name) || [];
      list.push(b);
      map.set(b.room_name, list);
    });

    return Array.from(map.entries()).filter(([, roomBeds]) => roomBeds.length > 0);
  }, [beds]);

  // Map every group_code across reservations to a unique palette index (no hash collisions)
  const { groupPaletteMap, groupMembersMap } = useMemo(() => {
    const paletteMap = new Map<string, (typeof GROUP_PALETTES)[number]>();
    const membersMap = new Map<string, string[]>();
    let idx = 0;

    reservations.forEach((r) => {
      if (!r.group_code) return;
      if (!paletteMap.has(r.group_code)) {
        paletteMap.set(
          r.group_code,
          GROUP_PALETTES[idx % GROUP_PALETTES.length]
        );
        idx++;
      }
      const list = membersMap.get(r.group_code) || [];
      if (!list.includes(r.guest_name)) {
        list.push(r.guest_name);
      }
      membersMap.set(r.group_code, list);
    });

    return { groupPaletteMap: paletteMap, groupMembersMap: membersMap };
  }, [reservations]);

  const getGroupPalette = (groupCode: string) => {
    return groupPaletteMap.get(groupCode) || GROUP_PALETTES[0];
  };

  // Distinct active group codes in the visible window for legend
  const visibleGroups = useMemo(() => {
    const startStr = days[0]?.dateStr || '';
    const endStr = days[days.length - 1]?.dateStr || '';
    const codes = new Map<string, string[]>();

    reservations.forEach((r) => {
      if (!r.group_code) return;
      if (r.check_out > startStr && r.check_in <= endStr) {
        const list = codes.get(r.group_code) || [];
        if (!list.includes(r.guest_name)) {
          list.push(r.guest_name);
        }
        codes.set(r.group_code, list);
      }
    });
    return Array.from(codes.entries());
  }, [reservations, days]);

  // Calculate daily total headcount (Guests + Staff sleeping inside) for each column
  const dailyHeadcounts = useMemo(() => {
    return days.map((d) => {
      const gCount = reservations.filter(
        (r) => r.check_in <= d.dateStr && d.dateStr < r.check_out
      ).length;
      const sCount = staff.filter(
        (s) =>
          s.check_in <= d.dateStr &&
          d.dateStr < s.check_out &&
          s.location_note !== '외부'
      ).length;
      return {
        guestCount: gCount,
        staffInsideCount: sCount,
        total: gCount + sCount,
      };
    });
  }, [days, reservations, staff]);

  return (
    <section className="max-w-[1600px] mx-auto px-4 sm:px-6 mt-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Calendar Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-extrabold text-slate-900">
                객실·침대 통합 베드맵 캘린더 (14일 뷰)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              빈 칸을 클릭하면 해당 날짜·침대로 즉시 예약을 추가할 수 있습니다. 일행(그룹코드)은 같은 테두리 색상으로 묶여 표시됩니다.
            </p>
          </div>

          {/* Date Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => onChangeStartDate(addDays(startDate, -7))}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-white hover:shadow-2xs transition-all cursor-pointer flex items-center gap-0.5"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                7일 전
              </button>
              <button
                type="button"
                onClick={() => onChangeStartDate(addDays(startDate, -1))}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-white hover:shadow-2xs transition-all cursor-pointer"
              >
                ◀ 하루
              </button>
              <button
                type="button"
                onClick={() => onChangeStartDate(parseISO(todayStr))}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-2xs hover:bg-indigo-700 transition-colors mx-1 cursor-pointer"
              >
                오늘 ({format(parseISO(todayStr), 'M/d')})
              </button>
              <button
                type="button"
                onClick={() => onChangeStartDate(addDays(startDate, 1))}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-white hover:shadow-2xs transition-all cursor-pointer"
              >
                하루 ▶
              </button>
              <button
                type="button"
                onClick={() => onChangeStartDate(addDays(startDate, 7))}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-white hover:shadow-2xs transition-all cursor-pointer flex items-center gap-0.5"
              >
                7일 후
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Legend & Group Filter Bar */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-bold text-slate-700">범례:</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-bold text-[10px]">
                남
              </span>
              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                여
              </span>
              <span className="text-slate-600">게스트 예약</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-500 inline-block" />
              <span className="text-emerald-800 font-semibold">
                상주 스태프 취침 (초록)
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-100 border-2 border-amber-500 inline-block" />
              <span className="text-amber-800 font-bold">
                ⚠️ 게스트+스태프 침대 중복 경고
              </span>
            </span>
          </div>

          {visibleGroups.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-500 font-semibold flex items-center gap-1 mr-1">
                <Users className="w-3.5 h-3.5" />
                일행(그룹) 하이라이트:
              </span>
              {visibleGroups.map(([code, memberNames]) => {
                const pal = getGroupPalette(code);
                const isHovered = hoveredGroupCode === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onMouseEnter={() => setHoveredGroupCode(code)}
                    onMouseLeave={() => setHoveredGroupCode(null)}
                    onClick={() =>
                      setHoveredGroupCode((prev) => (prev === code ? null : code))
                    }
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold transition-all cursor-pointer ${
                      pal.bg
                    } ${pal.border} ${pal.text} ${
                      isHovered ? `ring-2 ${pal.ring} scale-105` : ''
                    }`}
                  >
                    <span>👥 {code}</span>
                    <span className="opacity-75 font-medium">
                      ({memberNames.join(', ')})
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Matrix Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1180px] table-fixed">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200">
                <th className="w-24 py-3 px-2 text-left text-xs font-extrabold text-slate-700 border-r border-slate-200 sticky left-0 bg-slate-100 z-20">
                  객실
                </th>
                <th className="w-24 py-3 px-2 text-left text-xs font-extrabold text-slate-700 border-r border-slate-200 sticky left-24 bg-slate-100 z-20">
                  침대 번호
                </th>
                {days.map((d) => (
                  <th
                    key={d.dateStr}
                    className={`py-2.5 px-1.5 text-center border-r border-slate-200 last:border-r-0 ${
                      d.isToday
                        ? 'bg-indigo-50/90 ring-1 ring-inset ring-indigo-300'
                        : ''
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span
                        className={`text-[11px] font-bold ${
                          d.isToday
                            ? 'text-indigo-700'
                            : d.isSunday
                            ? 'text-rose-600'
                            : d.isSaturday
                            ? 'text-sky-600'
                            : 'text-slate-500'
                        }`}
                      >
                        {d.weekdayShort}
                        {d.isToday ? ' · 오늘' : ''}
                      </span>
                      <span
                        className={`text-sm font-extrabold mt-0.5 ${
                          d.isToday
                            ? 'bg-indigo-600 text-white px-2 py-0.5 rounded-full text-xs'
                            : 'text-slate-800'
                        }`}
                      >
                        {d.monthDay}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {groupedRooms.map(([roomName, roomBeds]) => (
                <React.Fragment key={roomName}>
                  {roomBeds.map((bed, bedIndex) => (
                    <tr
                      key={bed.id}
                      className={`group/row hover:bg-slate-50/60 transition-colors ${
                        bedIndex === roomBeds.length - 1
                          ? 'border-b-2 border-b-slate-300'
                          : ''
                      }`}
                    >
                      {/* Room Name Column (Rowspan per room) */}
                      {bedIndex === 0 && (
                        <td
                          rowSpan={roomBeds.length}
                          className="py-3 px-3 align-middle bg-slate-50 border-r border-slate-200 sticky left-0 z-10"
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-extrabold text-slate-900">
                              {roomName}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {roomName === '1인실'
                                ? '1~2인 사용 가능'
                                : `혼숙 · ${roomBeds.length}베드`}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* Bed Number Column (5-1, 4-1, 2-1, 1-1) */}
                      <td className="py-2.5 px-2.5 bg-white group-hover/row:bg-slate-50 border-r border-slate-200 sticky left-24 z-10">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-indigo-950 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            {formatBedCode(bed)}
                          </span>
                          {bed.room_name === '1인실' && (
                            <span className="text-[10px] text-indigo-600 font-bold">
                              최대2인
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 14 Date Cells */}
                      {days.map((d) => {
                        // Find all guest reservations occupying this bed on date d (1인실 can have up to 2 guests)
                        const cellGuests = reservations.filter(
                          (r) =>
                            r.bed_id === bed.id &&
                            r.check_in <= d.dateStr &&
                            d.dateStr < r.check_out
                        );
                        const primaryGuest = cellGuests[0] || null;
                        const maxCap = getBedMaxCapacity(bed);

                        // Find staff member assigned to this bed on date d
                        const assignedStaff = staff.find(
                          (s) =>
                            s.current_bed_id === bed.id &&
                            s.check_in <= d.dateStr &&
                            d.dateStr < s.check_out
                        );

                        const isConflict = Boolean(primaryGuest && assignedStaff);

                        // Case 1 & 2: Guest occupied (1 or 2 guests in cell, with or without staff conflict)
                        if (primaryGuest) {
                          const groupPalette = primaryGuest.group_code
                            ? getGroupPalette(primaryGuest.group_code)
                            : null;
                          const groupCount = primaryGuest.group_code
                            ? groupMembersMap.get(primaryGuest.group_code)?.length ||
                              cellGuests.length
                            : cellGuests.length;
                          const isGroupHighlighted = Boolean(
                            primaryGuest.group_code &&
                              hoveredGroupCode === primaryGuest.group_code
                          );
                          const isDimmed =
                            hoveredGroupCode !== null &&
                            primaryGuest.group_code !== hoveredGroupCode;

                          return (
                            <td
                              key={d.dateStr}
                              onMouseEnter={() =>
                                primaryGuest.group_code &&
                                setHoveredGroupCode(primaryGuest.group_code)
                              }
                              onMouseLeave={() => setHoveredGroupCode(null)}
                              onClick={() => openReservationEditor(primaryGuest)}
                              className={`p-1 border-r border-slate-200 align-top cursor-pointer transition-all ${
                                isConflict
                                  ? 'bg-amber-50/60'
                                  : d.isToday
                                  ? 'bg-indigo-50/30'
                                  : ''
                              }`}
                            >
                              <div
                                className={`h-full min-h-[58px] rounded-lg p-1.5 flex flex-col justify-between transition-all ${
                                  isConflict
                                    ? groupPalette
                                      ? `${groupPalette.bg} border-2 border-amber-500 border-l-4 ${groupPalette.text}`
                                      : 'bg-amber-50 border-2 border-amber-500'
                                    : groupPalette
                                    ? `${groupPalette.bg} border ${groupPalette.border} ${groupPalette.text} shadow-2xs`
                                    : 'bg-slate-100/90 border border-slate-300 text-slate-900 hover:bg-slate-200/70'
                                } ${
                                  isGroupHighlighted
                                    ? `ring-2 ${groupPalette?.ring || 'ring-amber-600'} scale-[1.03] shadow-sm`
                                    : ''
                                } ${isDimmed ? 'opacity-45' : ''}`}
                              >
                                {/* Render 1 or 2 guests inside this bed cell */}
                                <div className="space-y-1">
                                  {cellGuests.map((g) => (
                                    <div
                                      key={g.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openReservationEditor(g);
                                      }}
                                      className="flex items-center justify-between gap-1 hover:opacity-80"
                                    >
                                      <span className="text-xs font-extrabold truncate">
                                        {g.guest_name}
                                      </span>
                                      <span
                                        className={`px-1 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                                          g.gender === 'M'
                                            ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                                        }`}
                                      >
                                        {g.gender === 'M' ? '남' : '여'}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {/* Group or Occupancy Badge */}
                                <div className="mt-1 space-y-1">
                                  {cellGuests.length >= 2 && (
                                    <div className="px-1.5 py-0.5 rounded bg-indigo-700 text-white text-[9px] font-extrabold truncate">
                                      👫 1인실 2인 동반
                                    </div>
                                  )}

                                  {primaryGuest.group_code && groupPalette ? (
                                    <div
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold truncate flex items-center gap-0.5 ${groupPalette.badgeBg}`}
                                    >
                                      <span>
                                        👥 일행 {groupCount}명 (
                                        {primaryGuest.group_code.replace('GRP-', '')})
                                      </span>
                                    </div>
                                  ) : (
                                    cellGuests.length === 1 && (
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="text-[10px] text-slate-500 font-medium">
                                          개인 투숙
                                        </span>
                                        {maxCap > 1 && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onClickEmptyCell(bed.id, d.dateStr);
                                            }}
                                            className="px-1 py-0.2 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[9px] font-bold cursor-pointer"
                                            title="1인실에 2번째 동반 투숙객 추가"
                                          >
                                            +2인추가
                                          </button>
                                        )}
                                      </div>
                                    )
                                  )}

                                  {isConflict && assignedStaff && (
                                    <div className="px-1 py-0.5 rounded bg-amber-500 text-white text-[10px] font-extrabold flex items-center gap-0.5 justify-center animate-pulse">
                                      <AlertTriangle className="w-3 h-3 shrink-0" />
                                      <span className="truncate">
                                        ⚠️ {assignedStaff.name} 중복
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          );
                        }

                        // Case 3: Staff occupied (Green cell)
                        if (assignedStaff) {
                          return (
                            <td
                              key={d.dateStr}
                              onClick={() => onClickEmptyCell(bed.id, d.dateStr)}
                              title={`${assignedStaff.name} 취침 중 (클릭하여 게스트 예약 등록 시 충돌 경고가 표시됩니다)`}
                              className={`p-1 border-r border-slate-200 align-top cursor-pointer ${
                                d.isToday ? 'bg-emerald-50/40' : ''
                              }`}
                            >
                              <div className="h-full min-h-[58px] rounded-lg p-1.5 bg-emerald-50 border border-emerald-400 text-emerald-950 hover:bg-emerald-100/80 transition-colors flex flex-col justify-between">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs font-extrabold text-emerald-900 truncate">
                                    {assignedStaff.name}
                                  </span>
                                  <span
                                    className={`px-1 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                                      assignedStaff.gender === 'M'
                                        ? 'bg-sky-100 text-sky-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {assignedStaff.gender === 'M' ? '남' : '여'}
                                  </span>
                                </div>
                                <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold w-fit">
                                  상주 스태프
                                </div>
                              </div>
                            </td>
                          );
                        }

                        // Case 4: Empty Bed Cell (Click to add reservation)
                        return (
                          <td
                            key={d.dateStr}
                            onClick={() => onClickEmptyCell(bed.id, d.dateStr)}
                            className={`p-1 border-r border-slate-200 align-middle cursor-pointer group/cell ${
                              d.isToday ? 'bg-indigo-50/20' : ''
                            }`}
                          >
                            <div className="h-full min-h-[58px] rounded-lg border border-dashed border-transparent group-hover/cell:border-indigo-300 group-hover/cell:bg-indigo-50/50 flex items-center justify-center transition-all">
                              <span className="opacity-0 group-hover/cell:opacity-100 text-[11px] font-semibold text-indigo-600 flex items-center gap-0.5">
                                <Plus className="w-3.5 h-3.5" />
                                예약
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>

            {/* Daily Total Sleeping Headcount Footer Row */}
            <tfoot>
              <tr className="bg-slate-900 text-white">
                <td
                  colSpan={2}
                  className="py-3 px-3 text-xs font-bold sticky left-0 bg-slate-900 z-10 border-r border-slate-700"
                >
                  <div>일별 총 취침 인원</div>
                  <div className="text-[10px] text-slate-400 font-normal">
                    (게스트 + 내부 스태프)
                  </div>
                </td>
                {dailyHeadcounts.map((hc, idx) => {
                  const isTodayCol = days[idx]?.isToday;
                  return (
                    <td
                      key={days[idx].dateStr}
                      className={`py-2.5 px-1 text-center border-r border-slate-800 last:border-r-0 ${
                        isTodayCol ? 'bg-indigo-900' : ''
                      }`}
                    >
                      <div className="text-sm font-extrabold text-amber-300">
                        {hc.total}명
                      </div>
                      <div className="text-[10px] text-slate-300">
                        G:{hc.guestCount} / S:{hc.staffInsideCount}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Selected Reservation Detail / Edit / Delete Modal */}
      {selectedReservation && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedReservation(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-300" />
                <span className="text-base font-extrabold">
                  예약 상세 조회 및 수정
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReservation(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setEditError(null);

                if (!editGuestName.trim()) {
                  setEditError('투숙객 이름을 입력해 주세요.');
                  return;
                }
                if (!editCheckIn || !editCheckOut || editCheckOut <= editCheckIn) {
                  setEditError('체크아웃 날짜는 체크인 날짜보다 이후여야 합니다.');
                  return;
                }

                // Check bed capacity against other reservations overlapping [editCheckIn, editCheckOut)
                const targetBedObj = beds.find((b) => b.id === Number(editBedId));
                const maxCap = targetBedObj ? getBedMaxCapacity(targetBedObj) : 1;
                const overlappingOthers = reservations.filter(
                  (r) =>
                    r.id !== selectedReservation.id &&
                    r.bed_id === Number(editBedId) &&
                    r.check_in < editCheckOut &&
                    r.check_out > editCheckIn
                );

                if (overlappingOthers.length >= maxCap) {
                  const bedLabel = targetBedObj
                    ? formatBedCode(targetBedObj)
                    : `#${editBedId}`;
                  setEditError(
                    `${bedLabel} 침대는 선택한 일정에 이미 예약(${overlappingOthers
                      .map((o) => o.guest_name)
                      .join(', ')})이 차 있습니다.`
                  );
                  return;
                }

                try {
                  setSavingEdit(true);
                  await onUpdateReservation({
                    id: selectedReservation.id,
                    guest_name: editGuestName.trim(),
                    gender: editGender,
                    bed_id: Number(editBedId),
                    check_in: editCheckIn,
                    check_out: editCheckOut,
                    group_code: editGroupCode.trim() || null,
                    syncGroupDates:
                      syncGroupDates && Boolean(selectedReservation.group_code),
                    originalGroupCode: selectedReservation.group_code,
                  });
                  setSelectedReservation(null);
                } catch {
                  setEditError('예약 수정 중 오류가 발생했습니다.');
                } finally {
                  setSavingEdit(false);
                }
              }}
              className="p-5 space-y-4 text-sm"
            >
              {/* Name & Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    투숙객 이름
                  </label>
                  <input
                    type="text"
                    value={editGuestName}
                    onChange={(e) => setEditGuestName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    성별
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['M', 'F'] as Gender[]).map((gKey) => (
                      <button
                        key={gKey}
                        type="button"
                        onClick={() => setEditGender(gKey)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          editGender === gKey
                            ? gKey === 'M'
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'bg-rose-600 text-white border-rose-600'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {gKey === 'M' ? '남 (M)' : '여 (F)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bed Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  배정 침대 변경
                </label>
                <select
                  value={editBedId}
                  onChange={(e) => setEditBedId(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {beds.map((b) => {
                    const maxCap = getBedMaxCapacity(b);
                    const otherGuests = reservations.filter(
                      (r) =>
                        r.id !== selectedReservation.id &&
                        r.bed_id === b.id &&
                        r.check_in < editCheckOut &&
                        r.check_out > editCheckIn
                    );
                    const isFull = otherGuests.length >= maxCap;
                    const staffOnBed = staff.find(
                      (s) =>
                        s.current_bed_id === b.id &&
                        s.check_in < editCheckOut &&
                        s.check_out > editCheckIn
                    );

                    let suffix = ' (이동 가능)';
                    if (b.id === selectedReservation.bed_id) {
                      suffix = ' (현재 배정 침대)';
                    } else if (isFull) {
                      suffix = ` (❌ ${otherGuests
                        .map((o) => o.guest_name)
                        .join(', ')} 투숙 중)`;
                    } else if (otherGuests.length > 0) {
                      suffix = ` (👫 ${otherGuests[0].guest_name} 외 1인 동반 가능)`;
                    } else if (staffOnBed) {
                      suffix = ` (⚠️ ${staffOnBed.name} 배정 침대)`;
                    }

                    return (
                      <option key={b.id} value={b.id} disabled={isFull}>
                        {formatBedCode(b)} ({b.room_name}
                        {maxCap > 1 ? '·최대2인' : ''}){suffix}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Check-in / Check-out Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    체크인 (Check-In)
                  </label>
                  <input
                    type="date"
                    value={editCheckIn}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditCheckIn(val);
                      if (val && editCheckOut <= val) {
                        setEditCheckOut(
                          format(addDays(parseISO(val), 1), 'yyyy-MM-dd')
                        );
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    체크아웃 (Check-Out)
                  </label>
                  <input
                    type="date"
                    value={editCheckOut}
                    min={
                      editCheckIn
                        ? format(addDays(parseISO(editCheckIn), 1), 'yyyy-MM-dd')
                        : undefined
                    }
                    onChange={(e) => setEditCheckOut(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900"
                    required
                  />
                </div>

                {selectedReservation.group_code && (
                  <label className="sm:col-span-2 flex items-center gap-2 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={syncGroupDates}
                      onChange={(e) => setSyncGroupDates(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-indigo-900">
                      같은 일행({selectedReservation.group_code}) 전체의 체크인·체크아웃 날짜도 함께 변경
                    </span>
                  </label>
                )}
              </div>

              {/* Group Code Edit & Companions List */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700">
                    일행 그룹 코드 (같은 코드끼리 같은 색상으로 묶임)
                  </label>
                  <div className="flex items-center gap-1">
                    {!editGroupCode && (
                      <button
                        type="button"
                        onClick={() => setEditGroupCode(generateGroupCode())}
                        className="px-2 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[11px] font-bold cursor-pointer"
                      >
                        + 새 그룹코드 생성
                      </button>
                    )}
                    {editGroupCode && (
                      <button
                        type="button"
                        onClick={() => setEditGroupCode('')}
                        className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold cursor-pointer"
                      >
                        개인으로 분리
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="개인 투숙 (그룹코드 없음)"
                    value={editGroupCode}
                    onChange={(e) => setEditGroupCode(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900"
                  />
                  {visibleGroups.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) setEditGroupCode(e.target.value);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      <option value="">기존 일행에 합류...</option>
                      {visibleGroups.map(([code, names]) => (
                        <option key={code} value={code}>
                          {code} ({names.join(', ')})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedReservation.group_code && (
                  <div className="pt-1">
                    <div className="text-[11px] font-bold text-slate-500 mb-1">
                      현재 함께 묶인 일행 목록 (클릭 시 해당 인원 수정):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {reservations
                        .filter(
                          (r) => r.group_code === selectedReservation.group_code
                        )
                        .map((companion) => {
                          const cb = beds.find((x) => x.id === companion.bed_id);
                          const isSelf = companion.id === selectedReservation.id;
                          return (
                            <button
                              key={companion.id}
                              type="button"
                              onClick={() => openReservationEditor(companion)}
                              className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                                isSelf
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white hover:bg-indigo-50 border-slate-200 text-slate-800'
                              }`}
                            >
                              {companion.guest_name} (
                              {companion.gender === 'M' ? '남' : '여'} ·{' '}
                              {cb ? formatBedCode(cb) : ''})
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {editError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  {editError}
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onDeleteReservation(selectedReservation.id);
                    setSelectedReservation(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  예약 취소/삭제
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedReservation(null)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    닫기
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {savingEdit ? '저장 중...' : '수정사항 저장'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
