export const config = {
  port: Number(process.env.PORT ?? 3000),
  databasePath: process.env.DATABASE_PATH ?? '/app/data/database.sqlite',
  profilesRoot: process.env.PROFILES_ROOT ?? '/app/profiles_data',
  maxSlots: Number(process.env.MAX_SLOTS ?? 50),
  cdpWaitMs: Number(process.env.CDP_WAIT_MS ?? 10_000),
  maxSessionMs: Number(process.env.MAX_SESSION_MS ?? 30 * 60 * 1000),
  zombieScanMs: Number(process.env.ZOMBIE_SCAN_MS ?? 5 * 60 * 1000),
} as const;

export function portsForSlot(slotId: number) {
  return {
    display: `:${99 + slotId}`,
    vncPort: 5900 + slotId,
    wsPort: 6000 + slotId,
    cdpPort: 9222 + slotId,
  };
}
