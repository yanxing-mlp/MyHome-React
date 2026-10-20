import type { AxiosRequestConfig } from 'axios';
import { get, post, put, toQuery } from '../lib/http';

export interface StorageFolderEntry {
  name: string;
  path: string;
  enterable: boolean;
  disabledReason: string | null;
}

export interface StorageFolderListing {
  path: string | null;
  parentPath: string | null;
  selectable: boolean;
  disabledReason: string | null;
  directories: StorageFolderEntry[];
}

/** 只读浏览服务器目录，不访问浏览器所在电脑的文件系统。 */
export function fetchStorageFolders(path?: string, config?: AxiosRequestConfig): Promise<StorageFolderListing> {
  return get<StorageFolderListing>(`/api/b/storage/folders${toQuery({ path })}`, config);
}

export interface StorageDirectory {
  id: number;
  path: string;
  privatePath: string;
  isDefault: boolean;
  available: boolean;
  writable: boolean;
  error: string | null;
  volume: string | null;
  totalBytes: number | null;
  usedBytes: number | null;
  usableBytes: number | null;
  /** 两个根内的文件大小合计，与磁盘已用空间分开。 */
  directoryBytes: number | null;
  directoryScannedAt: string | null;
  directoryScanning: boolean;
  directoryError: string | null;
}

export interface StorageOverview {
  defaultDirectoryId: number;
  refreshedAt: string;
  directories: StorageDirectory[];
}

export function fetchStorage(config?: AxiosRequestConfig): Promise<StorageOverview> {
  return get<StorageOverview>('/api/b/storage', config);
}

/** 只关联目录，不改变默认上传位置。 */
export function createStorageDirectory(input: { path: string }, config?: AxiosRequestConfig): Promise<number> {
  return post<number>('/api/b/storage', input, config);
}

export function setDefaultStorageDirectory(id: number, config?: AxiosRequestConfig): Promise<void> {
  return put<void>(`/api/b/storage/${id}/default`, undefined, config);
}
