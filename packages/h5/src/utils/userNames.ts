/**
 * 「creator_id → 昵称 / 头像」这份小字典（C 端订单上的"谁下的单"、购物车分模块的模块头）。
 *
 * h5 没引 TanStack Query，所以缓存用最朴素的一层模块变量：全家就几个账号、这份数据一天也变不了
 * 一次，多个页面（订单列表、订单详情、点餐页抽屉、确认订单页）共用同一份结果，不必各发一次请求。
 * 账号昵称/头像变了要看到，刷新页面即可——C 端没有改账号的入口，这是 B 端的事。
 */
import { useEffect, useMemo, useState } from 'react';
import { listUserOptions, type UserOption } from '../api/user';

/** 账号被删了但历史订单还挂着它的 id：后端不清 creator_id，总得有个词接住 */
export const DELETED_USER_NAME = '已删除账号';

type DictEntry = Pick<UserOption, 'name' | 'avatarUrl'>;

let cache: Map<number, DictEntry> | null = null;
let pending: Promise<Map<number, DictEntry>> | null = null;

function loadDict(): Promise<Map<number, DictEntry>> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = listUserOptions()
      .then((options) => {
        cache = new Map(
          options.map((option) => [option.id, { name: option.name, avatarUrl: option.avatarUrl }]),
        );
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
function useUserDict(): Map<number, DictEntry> | null {
  const [dict, setDict] = useState<Map<number, DictEntry> | null>(cache);
  useEffect(() => {
    if (dict) return;
    let active = true;
    loadDict()
      .then((next) => {
        if (active) setDict(next);
      })
      .catch(() => {
        /* 取不到就不显示下单人，不打扰 */
      });
    return () => {
      active = false;
    };
  }, [dict]);
  return dict;
}

export function useUserNames(): Map<number, string> | null {
  const dict = useUserDict();
  return useMemo(
    () => (dict ? new Map(Array.from(dict, ([id, entry]) => [id, entry.name])) : null),
    [dict],
  );
}

/** 头像缩略图 URL 字典；没传过头像的账号是 null，调用处交给 resolveUserAvatar 画默认剪影。 */
export function useUserAvatars(): Map<number, string | null> | null {
  const dict = useUserDict();
  return useMemo(
    () => (dict ? new Map(Array.from(dict, ([id, entry]) => [id, entry.avatarUrl])) : null),
    [dict],
  );
}

/** 这一条数据的下单人名字；没有 id、或字典还没到，都返回 null（调用处整段不渲染） */
export function useCreatorName(id?: number | null): string | null {
  const names = useUserNames();
  if (id == null || !names) return null;
  return names.get(id) ?? DELETED_USER_NAME;
}
