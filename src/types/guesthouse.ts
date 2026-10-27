export type Gender = 'M' | 'F';

export type RoomName = '5인실' | '4인실' | '2인실' | '1인실';

export type StaffLocationNote = '침대' | '거실' | '사장님방' | '외부';

export interface Bed {
  id: number;
  room_name: RoomName | string;
  bed_number: number;
}

export interface Reservation {
  id: string;
  guest_name: string;
  gender: Gender;
  bed_id: number;
  check_in: string; // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD
  group_code: string | null;
  created_at: string;
}

export interface Staff {
  id: string;
  name: string;
  gender: Gender;
  check_in: string; // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD
  current_bed_id: number | null;
  location_note: StaffLocationNote;
}

export interface NewReservationGuestInput {
  guest_name: string;
  gender: Gender;
  bed_id: number;
}

export interface CreateReservationsPayload {
  check_in: string;
  check_out: string;
  guests: NewReservationGuestInput[];
}

export interface UpdateReservationPayload {
  id: string;
  guest_name: string;
  gender: Gender;
  bed_id: number;
  check_in: string;
  check_out: string;
  group_code: string | null;
  syncGroupDates?: boolean;
  originalGroupCode?: string | null;
}
