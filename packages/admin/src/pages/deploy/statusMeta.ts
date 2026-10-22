import type { DeployCommits, DeployStatus } from '../../api/deploy';

/** 部署状态徽标配色：准备中/部署中/完成/失败，和实时进度、历史列表共用一套口径。 */
export const DEPLOY_STATUS_TAG: Record<DeployStatus, { color: string; text: string }> = {
  pending: { color: 'blue', text: '准备中' },
  running: { color: 'processing', text: '部署中' },
  done: { color: 'success', text: '部署完成' },
  failed: { color: 'error', text: '部署失败' },
};

/** 完整 hash 取前 7 位；空值给空串。 */
export function shortOf(hash?: string): string {
  return hash ? (hash.length >= 7 ? hash.slice(0, 7) : hash) : '';
}

/** 两仓标签：后端 / 前端，和变更记录页一致。 */
const REPO_LABEL: Record<string, string> = { server: '后端', web: '前端' };

/**
 * 一次部署里某仓的「从 X 到 Y」迁移文案；拿不到 from 或 to 就退化成只显示能拿到的那一端。
 * to 优先用真实拉到的 resultCommits，没有再退回触发时的 targetCommits。
 */
export function commitMigration(
  repoKey: string,
  from?: DeployCommits,
  result?: DeployCommits,
  target?: DeployCommits,
): string | null {
  const fromHash = from?.[repoKey as keyof DeployCommits];
  const toHash = result?.[repoKey as keyof DeployCommits] ?? target?.[repoKey as keyof DeployCommits];
  const label = REPO_LABEL[repoKey] ?? repoKey;
  if (fromHash && toHash) return `${label} · ${shortOf(fromHash)} → ${shortOf(toHash)}`;
  if (toHash) return `${label} · ${shortOf(toHash)}`;
  if (fromHash) return `${label} · ${shortOf(fromHash)}`;
  return null;
}

/** 把 startedAt→finishedAt 的毫秒差格式化成「x 秒 / x 分 y 秒」；缺任一时间返回 null。 */
export function formatDuration(startedAt?: string | null, finishedAt?: string | null): string | null {
  if (!startedAt || !finishedAt) return null;
  const start = Date.parse(startedAt);
  const end = Date.parse(finishedAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  const millis = end - start;
  if (millis < 0) return null;
  const totalSeconds = Math.round(millis / 1000);
  if (totalSeconds < 60) return `${totalSeconds} 秒`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分`;
}
