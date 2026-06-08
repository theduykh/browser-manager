export type ProfileStatus = 'IDLE' | 'IN_USE' | 'CORRUPT';

export interface LaunchConfig {
  lang?: string;
  proxy?: string;
  disableWebSecurity?: boolean;
  disableExtensions?: boolean;
  muteAudio?: boolean;
  ignoreCertErrors?: boolean;
  disableNotifications?: boolean;
  disablePopupBlocking?: boolean;
}

export function parseLaunchConfig(raw: string): LaunchConfig {
  try {
    const p = JSON.parse(raw);
    if (p !== null && typeof p === 'object' && !Array.isArray(p)) return p as LaunchConfig;
  } catch { /* fall through */ }
  return {};
}

export interface GroupRow {
  id: number;
  name: string;
  created_at: string;
}

export interface Group extends GroupRow {
  profile_count: number;
}

export function parseTags(raw: string): string[] {
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p.filter((t): t is string => typeof t === 'string');
  } catch { /* fall through */ }
  return [];
}

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
  created_at: string;
  window_width: number;
  window_height: number;
  launch_args: string;
  note: string;
  launch_config: string;
  group_id: number | null;
  tags: string;
}

export interface Profile extends Omit<ProfileRow, 'pids' | 'tags'> {
  pids: number[] | null;
  tags: string[];
}

export function rowToProfile(r: ProfileRow): Profile {
  return {
    ...r,
    pids: r.pids ? (JSON.parse(r.pids) as number[]) : null,
    tags: parseTags(r.tags),
  };
}

export interface ProfileConfigInput {
  window_width?: number;
  window_height?: number;
  launch_args?: string;
  note?: string;
  launch_config?: LaunchConfig;
  group_id?: number | null;
  tags?: string[];
}
