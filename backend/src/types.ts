export type ProfileStatus = 'IDLE' | 'IN_USE' | 'CORRUPT';

export interface ProfileRow {
  id: number;
  profile_name: string;
  folder_path: string;
  status: ProfileStatus;
  slot_id: number | null;
  ws_port: number | null;
  cdp_port: number | null;
  pids: string | null;
  allocated_at: string | null;
  last_active: string;
  window_width: number;
  window_height: number;
  launch_args: string;
  note: string;
}

export interface Profile extends Omit<ProfileRow, 'pids'> {
  pids: number[] | null;
}

export function rowToProfile(r: ProfileRow): Profile {
  return { ...r, pids: r.pids ? (JSON.parse(r.pids) as number[]) : null };
}

export interface ProfileConfigInput {
  window_width?: number;
  window_height?: number;
  launch_args?: string;
  note?: string;
}
