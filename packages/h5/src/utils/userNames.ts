/**
 * 「creator_id → 昵称」这份小字典（C 端订单上的"谁下的单"）。
 *
 * h5 没引 TanStack Query，所以缓存用最朴素的一层模块变量：全家就几个账号、这份数据一天也变不了
 * 一次，多个页面（订单列表、订单详情）共用同一份结果，不必各发一次请求。
 * 账号昵称/头像变了要看到，刷新页面即可——C 端没有改账号的入口，这是 B 端的事。
 */
import { useEffect, useState } from 'react';
import { listUserOptions } from '../api/user';

/** 账号被删了但历史订单还挂着它的 id：后端不清 creator_id，总得有个词接住 */
export const DELETED_USER_NAME = '已删除账号';

let cache: Map<number, string> | null = null;
let pending: Promise<Map<number, string>> | null = null;

function loadNames(): Promise<Map<number, string>> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = listUserOptions()
      .then((options) => {
        cache = new Map(options.map((option) => [option.id, option.name]));
        return cache;
      })
      // 失败后把在途的 promise 丢掉，下一页还能重试；C 端这里不弹全局错误，取不到就不显示名字
      .catch((error: unknown) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

/** null = 还没查到。宁可不显示，也不要先闪一次"已删除账号"。 */
export function useUserNames(): Map<number, string> | null {
  const [names, setNames] = useState<Map<number, string> | null>(cache);
  useEffect(() => {
    if (names) return;
    let active = true;
    loadNames()
      .then((next) => {
        if (active) setNames(next);
      })
      .catch(() => {
        /* 取不到就不显示下单人，不打扰 */
      });
    return () => {
      active = false;
    };
  }, [names]);
  return names;
}

/** 这一条数据的下单人名字；没有 id、或字典还没到，都返回 null（调用处整段不渲染） */
export function useCreatorName(id?: number | null): string | null {
  const names = useUserNames();
  if (id == null || !names) return null;
  return names.get(id) ?? DELETED_USER_NAME;
}
