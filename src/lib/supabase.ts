import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { addDays, format, subDays } from 'date-fns';
import {
  Bed,
  CreateReservationsPayload,
  Reservation,
  Staff,
  StaffLocationNote,
  UpdateReservationPayload,
  UpdateStaffProfilePayload,
} from '@/types/guesthouse';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('your-project-url')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Seed 12 beds: 5인실 (1-5), 4인실 (1-4), 2인실 (1-2), 1인실 (1)
export const INITIAL_BEDS: Bed[] = [
  { id: 1, room_name: '5인실', bed_number: 1 },
  { id: 2, room_name: '5인실', bed_number: 2 },
  { id: 3, room_name: '5인실', bed_number: 3 },
  { id: 4, room_name: '5인실', bed_number: 4 },
  { id: 5, room_name: '5인실', bed_number: 5 },
  { id: 6, room_name: '4인실', bed_number: 1 },
  { id: 7, room_name: '4인실', bed_number: 2 },
  { id: 8, room_name: '4인실', bed_number: 3 },
  { id: 9, room_name: '4인실', bed_number: 4 },
  { id: 10, room_name: '2인실', bed_number: 1 },
  { id: 11, room_name: '2인실', bed_number: 2 },
  { id: 12, room_name: '1인실', bed_number: 1 },
];

export function getInitialMockStaff(baseDate: Date = new Date()): Staff[] {
  return [
    {
      id: 'staff-a-uuid',
      name: '스태프A',
      gender: 'M',
      check_in: format(subDays(baseDate, 10), 'yyyy-MM-dd'),
      check_out: format(addDays(baseDate, 45), 'yyyy-MM-dd'),
      current_bed_id: 5, // 5인실-5 (intentionally has a guest conflict in demo data)
      location_note: '침대',
    },
    {
      id: 'staff-b-uuid',
      name: '스태프B',
      gender: 'F',
      check_in: format(subDays(baseDate, 5), 'yyyy-MM-dd'),
      check_out: format(addDays(baseDate, 30), 'yyyy-MM-dd'),
      current_bed_id: 9, // 4인실-4
      location_note: '침대',
    },
  ];
}

export function getInitialMockReservations(baseDate: Date = new Date()): Reservation[] {
  const d0 = format(baseDate, 'yyyy-MM-dd');
  const d1 = format(addDays(baseDate, 1), 'yyyy-MM-dd');
  const d2 = format(addDays(baseDate, 2), 'yyyy-MM-dd');
  const d3 = format(addDays(baseDate, 3), 'yyyy-MM-dd');
  const d4 = format(addDays(baseDate, 4), 'yyyy-MM-dd');
  const d5 = format(addDays(baseDate, 5), 'yyyy-MM-dd');
  const d6 = format(addDays(baseDate, 6), 'yyyy-MM-dd');
  const dm1 = format(subDays(baseDate, 1), 'yyyy-MM-dd');

  return [
    // Group 1: 3 friends staying in 5인실 (Beds 1, 2, 3)
    {
      id: 'res-1',
      guest_name: '김민수',
      gender: 'M',
      bed_id: 1,
      check_in: d0,
      check_out: d3,
      group_code: 'GRP-JEJU01',
      created_at: new Date().toISOString(),
    },
    {
      id: 'res-2',
      guest_name: '이준호',
      gender: 'M',
      bed_id: 2,
      check_in: d0,
      check_out: d3,
      group_code: 'GRP-JEJU01',
      created_at: new Date().toISOString(),
    },
    {
      id: 'res-3',
      guest_name: '박서연',
      gender: 'F',
      bed_id: 3,
      check_in: d0,
      check_out: d3,
      group_code: 'GRP-JEJU01',
      created_at: new Date().toISOString(),
    },
    // Solo guest in 5인실-5 overlapping with 스태프A -> triggers ⚠️ conflict warning!
    {
      id: 'res-4',
      guest_name: '최현우',
      gender: 'M',
      bed_id: 5,
      check_in: d1,
      check_out: d4,
      group_code: null,
      created_at: new Date().toISOString(),
    },
    // Group 2: Couple in 2인실 (Beds 10, 11)
    {
      id: 'res-5',
      guest_name: '정다은',
      gender: 'F',
      bed_id: 10,
      check_in: dm1,
      check_out: d2,
      group_code: 'GRP-COUPLE2',
      created_at: new Date().toISOString(),
    },
    {
      id: 'res-6',
      guest_name: '강동원',
      gender: 'M',
      bed_id: 11,
      check_in: dm1,
      check_out: d2,
      group_code: 'GRP-COUPLE2',
      created_at: new Date().toISOString(),
    },
    // Solo guest in 1인실 (Bed 12)
    {
      id: 'res-7',
      guest_name: '한지민',
      gender: 'F',
      bed_id: 12,
      check_in: d0,
      check_out: d2,
      group_code: null,
      created_at: new Date().toISOString(),
    },
    // Upcoming group in 4인실 (Beds 6, 7)
    {
      id: 'res-8',
      guest_name: '송하늘',
      gender: 'F',
      bed_id: 6,
      check_in: d3,
      check_out: d6,
      group_code: 'GRP-SURF88',
      created_at: new Date().toISOString(),
    },
    {
      id: 'res-9',
      guest_name: '윤바다',
      gender: 'F',
      bed_id: 7,
      check_in: d3,
      check_out: d6,
      group_code: 'GRP-SURF88',
      created_at: new Date().toISOString(),
    },
    // Solo guest in 4인실-1 today
    {
      id: 'res-10',
      guest_name: '오지훈',
      gender: 'M',
      bed_id: 6,
      check_in: d0,
      check_out: d2,
      group_code: null,
      created_at: new Date().toISOString(),
    },
    // Solo guest in 1인실 later
    {
      id: 'res-11',
      guest_name: '유재석',
      gender: 'M',
      bed_id: 12,
      check_in: d3,
      check_out: d5,
      group_code: null,
      created_at: new Date().toISOString(),
    },
  ];
}

const STORAGE_KEYS = {
  RESERVATIONS: 'pufferfish_mock_reservations_v1',
  STAFF: 'pufferfish_mock_staff_v1',
};

function loadMockState(): { beds: Bed[]; reservations: Reservation[]; staff: Staff[] } {
  if (typeof window === 'undefined') {
    return {
      beds: INITIAL_BEDS,
      reservations: getInitialMockReservations(),
      staff: getInitialMockStaff(),
    };
  }

  try {
    const savedRes = window.localStorage.getItem(STORAGE_KEYS.RESERVATIONS);
    const savedStaff = window.localStorage.getItem(STORAGE_KEYS.STAFF);

    const reservations: Reservation[] = savedRes
      ? JSON.parse(savedRes)
      : getInitialMockReservations();
    const rawStaff: Staff[] = savedStaff ? JSON.parse(savedStaff) : getInitialMockStaff();
    const staff: Staff[] = rawStaff.map((s) => ({
      ...s,
      location_note:
        (s.location_note as string) === '외부' ? '외박' : s.location_note,
    }));

    if (!savedRes) {
      window.localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(reservations));
    }
    if (!savedStaff) {
      window.localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff));
    }

    return {
      beds: INITIAL_BEDS,
      reservations,
      staff,
    };
  } catch {
    return {
      beds: INITIAL_BEDS,
      reservations: getInitialMockReservations(),
      staff: getInitialMockStaff(),
    };
  }
}

export function resetMockState(): { beds: Bed[]; reservations: Reservation[]; staff: Staff[] } {
  const reservations = getInitialMockReservations();
  const staff = getInitialMockStaff();
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(reservations));
    window.localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff));
  }
  return { beds: INITIAL_BEDS, reservations, staff };
}

export async function fetchGuesthouseData(): Promise<{
  beds: Bed[];
  reservations: Reservation[];
  staff: Staff[];
  usingMock: boolean;
}> {
  if (supabase) {
    try {
      const [bedsRes, reservationsRes, staffRes] = await Promise.all([
        supabase.from('beds').select('*').order('id', { ascending: true }),
        supabase.from('reservations').select('*').order('check_in', { ascending: true }),
        supabase.from('staff').select('*').order('name', { ascending: true }),
      ]);

      if (!bedsRes.error && !reservationsRes.error && !staffRes.error && bedsRes.data?.length) {
        return {
          beds: bedsRes.data as Bed[],
          reservations: (reservationsRes.data || []) as Reservation[],
          staff: (staffRes.data || []) as Staff[],
          usingMock: false,
        };
      }
    } catch (err) {
      console.warn('Supabase fetch failed, falling back to local mock mode:', err);
    }
  }

  const mock = loadMockState();
  return { ...mock, usingMock: true };
}

export function generateGroupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `GRP-${suffix}`;
}

export async function createReservations(
  payload: CreateReservationsPayload
): Promise<{ created: Reservation[]; groupCode: string | null }> {
  const isGroup = payload.guests.length > 1;
  const groupCode = isGroup ? generateGroupCode() : null;

  const rowsToInsert = payload.guests.map((g) => ({
    guest_name: g.guest_name.trim(),
    gender: g.gender,
    bed_id: Number(g.bed_id),
    check_in: payload.check_in,
    check_out: payload.check_out,
    group_code: groupCode,
  }));

  if (supabase) {
    const { data, error } = await supabase
      .from('reservations')
      .insert(rowsToInsert)
      .select('*');

    if (!error && data) {
      return { created: data as Reservation[], groupCode };
    }
  }

  // Fallback mock mode
  const mock = loadMockState();
  const created: Reservation[] = rowsToInsert.map((row, idx) => ({
    ...row,
    id: `mock-res-${Date.now()}-${idx}`,
    created_at: new Date().toISOString(),
  }));

  const updated = [...mock.reservations, ...created];
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(updated));
  }
  return { created, groupCode };
}

export async function deleteReservation(reservationId: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('reservations').delete().eq('id', reservationId);
    if (!error) return;
  }

  const mock = loadMockState();
  const updated = mock.reservations.filter((r) => r.id !== reservationId);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(updated));
  }
}

export async function updateReservation(
  payload: UpdateReservationPayload
): Promise<Reservation[]> {
  const normalizedGroupCode = payload.group_code?.trim() || null;

  if (supabase) {
    await supabase
      .from('reservations')
      .update({
        guest_name: payload.guest_name.trim(),
        gender: payload.gender,
        bed_id: Number(payload.bed_id),
        check_in: payload.check_in,
        check_out: payload.check_out,
        group_code: normalizedGroupCode,
      })
      .eq('id', payload.id);

    if (payload.syncGroupDates && payload.originalGroupCode) {
      await supabase
        .from('reservations')
        .update({
          check_in: payload.check_in,
          check_out: payload.check_out,
        })
        .eq('group_code', payload.originalGroupCode)
        .neq('id', payload.id);
    }

    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .order('check_in', { ascending: true });

    if (!error && data) {
      return data as Reservation[];
    }
  }

  // Fallback mock mode
  const mock = loadMockState();
  const updatedList = mock.reservations.map((r) => {
    if (r.id === payload.id) {
      return {
        ...r,
        guest_name: payload.guest_name.trim(),
        gender: payload.gender,
        bed_id: Number(payload.bed_id),
        check_in: payload.check_in,
        check_out: payload.check_out,
        group_code: normalizedGroupCode,
      };
    }
    if (
      payload.syncGroupDates &&
      payload.originalGroupCode &&
      r.group_code === payload.originalGroupCode
    ) {
      return {
        ...r,
        check_in: payload.check_in,
        check_out: payload.check_out,
      };
    }
    return r;
  });

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      STORAGE_KEYS.RESERVATIONS,
      JSON.stringify(updatedList)
    );
  }
  return updatedList;
}

export async function updateStaffLocation(
  staffId: string,
  currentBedId: number | null,
  locationNote: StaffLocationNote
): Promise<Staff | null> {
  const normalizedNote: StaffLocationNote = currentBedId !== null ? '침대' : locationNote;

  if (supabase) {
    const { data, error } = await supabase
      .from('staff')
      .update({
        current_bed_id: currentBedId,
        location_note: normalizedNote,
      })
      .eq('id', staffId)
      .select('*')
      .single();

    if (!error && data) {
      return data as Staff;
    }
  }

  const mock = loadMockState();
  let updatedStaffMember: Staff | null = null;
  const updatedStaffList = mock.staff.map((s) => {
    if (s.id === staffId) {
      updatedStaffMember = {
        ...s,
        current_bed_id: currentBedId,
        location_note: normalizedNote,
      };
      return updatedStaffMember;
    }
    return s;
  });

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(updatedStaffList));
  }
  return updatedStaffMember;
}

export async function updateStaffProfile(
  payload: UpdateStaffProfilePayload
): Promise<Staff | null> {
  const patch: Record<string, unknown> = {
    name: payload.name.trim(),
    gender: payload.gender,
  };
  if (payload.check_in) patch.check_in = payload.check_in;
  if (payload.check_out) patch.check_out = payload.check_out;

  if (supabase) {
    const { data, error } = await supabase
      .from('staff')
      .update(patch)
      .eq('id', payload.id)
      .select('*')
      .single();

    if (!error && data) {
      return data as Staff;
    }
  }

  const mock = loadMockState();
  let updatedStaffMember: Staff | null = null;
  const updatedStaffList = mock.staff.map((s) => {
    if (s.id === payload.id) {
      updatedStaffMember = {
        ...s,
        name: payload.name.trim(),
        gender: payload.gender,
        check_in: payload.check_in || s.check_in,
        check_out: payload.check_out || s.check_out,
      };
      return updatedStaffMember;
    }
    return s;
  });

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      STORAGE_KEYS.STAFF,
      JSON.stringify(updatedStaffList)
    );
  }
  return updatedStaffMember;
}

/**
 * Returns true if the staff member is sleeping inside the guesthouse
 * ('침대', '거실', '사장님방', '샤바나' -> true; '외박' -> false)
 */
export function isStaffSleepingInside(locationNote: string): boolean {
  return locationNote !== '외박' && locationNote !== '외부';
}

/**
 * Formats bed label as "5-1", "4-2", "2-1", "1-1"
 */
export function formatBedCode(bed: Bed): string {
  const roomNum = bed.room_name.replace(/[^0-9]/g, '');
  return `${roomNum || bed.room_name}-${bed.bed_number}`;
}

/**
 * Returns max guest capacity for a single bed.
 * 1인실 (1-1) can be used by up to 2 guests together (2인 동반 사용 가능).
 */
export function getBedMaxCapacity(bed: Bed): number {
  return bed.room_name === '1인실' ? 2 : 1;
}

/**
 * Automatically assigns the best empty beds for `guestCount` guests during [checkIn, checkOut).
 * Prioritizes:
 * 1) Preferred room if specified (including 1인실 2-person sharing when 1인실 is chosen)
 * 2) Beds without staff conflicts (Tier 1) before beds with resident staff (Tier 2)
 * 3) Keeping companions in the same room (closest-fitting room capacity first)
 */
export function autoAssignEmptyBeds({
  checkIn,
  checkOut,
  guestCount,
  beds,
  reservations,
  staff,
  preferredRoom = 'AUTO',
}: {
  checkIn: string;
  checkOut: string;
  guestCount: number;
  beds: Bed[];
  reservations: Reservation[];
  staff: Staff[];
  preferredRoom?: string;
}): {
  assignedBedIds: number[];
  totalAvailableCount: number;
  usesStaffBed: boolean;
} {
  if (!checkIn || !checkOut || checkOut <= checkIn || guestCount <= 0) {
    return { assignedBedIds: [], totalAvailableCount: 0, usesStaffBed: false };
  }

  // Count how many guests are already booked in each bed overlapping [checkIn, checkOut)
  const guestCountByBedId = new Map<number, number>();
  reservations.forEach((r) => {
    if (r.check_in < checkOut && r.check_out > checkIn) {
      guestCountByBedId.set(r.bed_id, (guestCountByBedId.get(r.bed_id) || 0) + 1);
    }
  });

  const staffOccupiedBedIds = new Set<number>();
  staff.forEach((s) => {
    if (
      s.current_bed_id !== null &&
      s.check_in < checkOut &&
      s.check_out > checkIn
    ) {
      staffOccupiedBedIds.add(s.current_bed_id);
    }
  });

  // Beds with 0 guests currently booked
  const availableBeds = beds.filter(
    (b) => (guestCountByBedId.get(b.id) || 0) === 0
  );

  // Special case: 1인실 (1-1) can hold up to 2 guests
  const singleRoomBed = beds.find((b) => b.room_name === '1인실');
  const singleRoomCurrentGuests = singleRoomBed
    ? guestCountByBedId.get(singleRoomBed.id) || 0
    : 2;
  const singleRoomRemainingSlots = singleRoomBed
    ? Math.max(0, getBedMaxCapacity(singleRoomBed) - singleRoomCurrentGuests)
    : 0;

  const totalAvailableCapacity =
    availableBeds.filter((b) => b.room_name !== '1인실').length +
    singleRoomRemainingSlots;

  // If user explicitly prefers '1인실' (or '1인실_2인') and singleRoomBed has enough slots (1 or 2 guests)
  if (
    (preferredRoom === '1인실' || preferredRoom === '1인실_2인') &&
    singleRoomBed &&
    singleRoomRemainingSlots > 0
  ) {
    const slotsInSingle = Math.min(guestCount, singleRoomRemainingSlots);
    const initialAssigned = Array(slotsInSingle).fill(singleRoomBed.id);
    if (initialAssigned.length >= guestCount) {
      return {
        assignedBedIds: initialAssigned,
        totalAvailableCount: totalAvailableCapacity,
        usesStaffBed: staffOccupiedBedIds.has(singleRoomBed.id),
      };
    }
  }

  const tier1Beds = availableBeds.filter((b) => !staffOccupiedBedIds.has(b.id));
  const tier2Beds = availableBeds.filter((b) => staffOccupiedBedIds.has(b.id));

  const pickFromPool = (pool: Bed[], needed: number): Bed[] => {
    if (needed <= 0 || pool.length === 0) return [];

    // Group available beds in pool by room_name
    const byRoom = new Map<string, Bed[]>();
    pool.forEach((b) => {
      const list = byRoom.get(b.room_name) || [];
      list.push(b);
      byRoom.set(b.room_name, list);
    });

    const result: Bed[] = [];
    const usedIds = new Set<number>();

    // 1. If a specific preferred room was requested, take from that room first
    if (preferredRoom !== 'AUTO' && byRoom.has(preferredRoom)) {
      const prefBeds = byRoom.get(preferredRoom)!;
      for (const b of prefBeds) {
        if (result.length < needed) {
          result.push(b);
          usedIds.add(b.id);
        }
      }
    }

    const remainingNeeded = needed - result.length;
    if (remainingNeeded <= 0) return result;

    // 2. Try to find a single room that can fit all `remainingNeeded` guests together
    // Sort candidate rooms by smallest excess capacity so 1 guest prefers 1인실/2인실, 2 guests prefer 2인실, etc.
    const candidateRooms = Array.from(byRoom.entries())
      .map(([roomName, roomBeds]) => ({
        roomName,
        freeBeds: roomBeds.filter((b) => !usedIds.has(b.id)),
      }))
      .filter((r) => r.freeBeds.length >= remainingNeeded)
      .sort((a, b) => a.freeBeds.length - b.freeBeds.length);

    if (candidateRooms.length > 0) {
      const bestRoom = candidateRooms[0];
      for (const b of bestRoom.freeBeds) {
        if (result.length < needed) {
          result.push(b);
          usedIds.add(b.id);
        }
      }
      return result;
    }

    // 3. Otherwise, fill from rooms with the most free beds first to keep party members as grouped as possible
    const roomsDesc = Array.from(byRoom.entries())
      .map(([roomName, roomBeds]) => ({
        roomName,
        freeBeds: roomBeds.filter((b) => !usedIds.has(b.id)),
      }))
      .sort((a, b) => b.freeBeds.length - a.freeBeds.length);

    for (const r of roomsDesc) {
      for (const b of r.freeBeds) {
        if (result.length < needed) {
          result.push(b);
          usedIds.add(b.id);
        }
      }
    }

    return result;
  };

  // First try picking all from Tier 1 (no staff conflict)
  const chosenTier1 = pickFromPool(tier1Beds, guestCount);
  if (chosenTier1.length >= guestCount) {
    return {
      assignedBedIds: chosenTier1.map((b) => b.id),
      totalAvailableCount: totalAvailableCapacity,
      usesStaffBed: false,
    };
  }

  // If Tier 1 wasn't enough, supplement from Tier 2 (beds currently used by staff)
  const stillNeeded = guestCount - chosenTier1.length;
  const chosenTier2 = pickFromPool(tier2Beds, stillNeeded);
  const combined = [...chosenTier1, ...chosenTier2].map((b) => b.id);

  // If still 1 slot short and 1인실 (1-1) can hold a 2nd guest, use 1-1's 2nd slot
  if (
    combined.length < guestCount &&
    singleRoomBed &&
    singleRoomRemainingSlots >= 1
  ) {
    const alreadyAssignedInSingle = combined.filter(
      (id) => id === singleRoomBed.id
    ).length;
    if (alreadyAssignedInSingle < singleRoomRemainingSlots) {
      combined.push(singleRoomBed.id);
    }
  }

  return {
    assignedBedIds: combined,
    totalAvailableCount: totalAvailableCapacity,
    usesStaffBed: chosenTier2.length > 0,
  };
}
