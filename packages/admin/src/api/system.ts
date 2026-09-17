import { get } from '@family-home/shared/http';

/** 对应后端 HealthController 的返回结构 */
export interface HealthInfo {
  app: string;
  time: string;
  java: string;
  storageRoot: string;
  db: string;
}

export function fetchHealth(): Promise<HealthInfo> {
  return get<HealthInfo>('/api/b/health');
}
