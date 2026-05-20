export type ProfileStatus = 'IDLE' | 'IN_USE' | 'CORRUPT';

export interface Profile {
  id: number;
  profile_name: string;
  folder_path: string;
  status: ProfileStatus;
  slot_id: number | null;
  ws_port: number | null;
  cdp_port: number | null;
  pids: number[] | null;
  allocated_at: string | null;
  last_active: string;
  window_width: number;
  window_height: number;
  launch_args: string;
  note: string;
}

export interface ProfileConfigInput {
  profile_name?: string;
  window_width?: number;
  window_height?: number;
  launch_args?: string;
  note?: string;
}

export interface AllocateResponse {
  profile_id: number;
  slot_id: number;
  ws_port: number;
  cdp_port: number;
  cdp_endpoint: string;
  ws_url: string;
}
