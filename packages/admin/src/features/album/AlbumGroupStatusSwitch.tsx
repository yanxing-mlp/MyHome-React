import { Switch } from 'antd';
import type { ContentStatus } from '@family-home/shared/http';

import { updateAlbumGroup, type AlbumGroupScope } from '../../api/album';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useAlbumKeys } from './useAlbumGroups';

/**
 * 分组上下架开关。
 *
 * <p>与图片那一枚（{@link AlbumImageStatusSwitch}）同一口径：开关**就是**状态，不另配一个 Tag；
 * 不给 `size="small"`，小尺寸轨道塞不下"上架/下架"四个字。文案也不额外解释——关掉之后这本相册在
 * C 端整本消失（卡片、深链、上传候选三处一起没），B 端照旧看得见，这正是 `status` 三态本来的语义。
 *
 * <p><b>下架只动分组自己</b>：组里每张图各自的 `status` 一个都不改，所以一张同时挂在两个相册的图，
 * 另一个相册的卡片照旧在；城市统计数的是在架图片，跟分组状态无关，后端因此不重算 `album_city`。
 *
 * <p>请求只发 `{ status }`：后端 `AlbumGroupService.update` 对 `name`/`status` 各自判 null，
 * 所以改状态不会把分组名冲掉（重命名弹窗反向同理，它只发 name）。
 * mutation 挂在这张卡自己身上，`loading` 就只转被点的那一枚开关。
 */
export function AlbumGroupStatusSwitch({ groupId, status, scope }: { groupId: number; status: ContentStatus; scope: AlbumGroupScope }) {
  const keys = useAlbumKeys(scope);
  const onShelf = status === 'ON_SHELF';
  const mutation = useApiMutation(
    async () => {
      await updateAlbumGroup(groupId, { status: onShelf ? 'OFF_SHELF' : 'ON_SHELF' }, scope);
    },
    { invalidate: [keys.root] },
  );

  return (
    <Switch
      checked={onShelf}
      loading={mutation.isPending}
      checkedChildren="上架"
      unCheckedChildren="下架"
      onChange={() => void mutation.mutate()}
    />
  );
}
