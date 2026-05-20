type Level = 'info' | 'warn' | 'error' | 'debug';

export function log(level: Level, msg: string, ctx: Record<string, unknown> = {}) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...ctx });
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}
