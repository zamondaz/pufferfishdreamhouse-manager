'use client';

import React, { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { formatBedCode, getBedMaxCapacity } from '@/lib/supabase';
import { Bed, Reservation, Staff } from '@/types/guesthouse';

interface BedMapCalendarProps {
  beds: Bed[];
  reservations: Reservation[];
  staff: Staff[];
  todayStr: string;
  startDate: Date;
  onChangeStartDate: (newDate: Date) => void;
  onClickEmptyCell: (bedId: number, dateStr: string) => void;
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
  onDeleteReservation,
}: BedMapCalendarProps) {
  const [hoveredGroupCode, setHoveredGroupCode] = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);

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
                              onClick={() => setSelectedReservation(primaryGuest)}
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
                                        setSelectedReservation(g);
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

      {/* Selected Reservation Detail / Delete Popover Modal */}
      {selectedReservation && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedReservation(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold text-slate-900">
                  {selectedReservation.guest_name}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    selectedReservation.gender === 'M'
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {selectedReservation.gender === 'M' ? '남성 (M)' : '여성 (F)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReservation(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">배정 침대</span>
                <span className="font-bold text-slate-900">
                  {(() => {
                    const b = beds.find((x) => x.id === selectedReservation.bed_id);
                    return b ? `${formatBedCode(b)} (${b.room_name})` : `#${selectedReservation.bed_id}`;
                  })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">체크인 ~ 체크아웃</span>
                <span className="font-bold text-slate-900">
                  {selectedReservation.check_in} ~ {selectedReservation.check_out}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">일행 그룹 코드</span>
                {selectedReservation.group_code ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold text-xs">
                    👥 {selectedReservation.group_code}
                  </span>
                ) : (
                  <span className="text-slate-400 text-xs">개인 예약 (없음)</span>
                )}
              </div>

              {selectedReservation.group_code && (
                <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs font-bold text-slate-600 mb-1.5">
                    함께 투숙하는 일행 목록:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {reservations
                      .filter((r) => r.group_code === selectedReservation.group_code)
                      .map((companion) => {
                        const cb = beds.find((x) => x.id === companion.bed_id);
                        return (
                          <span
                            key={companion.id}
                            className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800"
                          >
                            {companion.guest_name} ({companion.gender === 'M' ? '남' : '여'} ·{' '}
                            {cb ? formatBedCode(cb) : ''})
                          </span>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  onDeleteReservation(selectedReservation.id);
                  setSelectedReservation(null);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                예약 취소/삭제
              </button>
              <button
                type="button"
                onClick={() => setSelectedReservation(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
