import { Switch } from 'antd';
import type { ContentStatus } from '@family-home/shared/http';

import { updateAlbumImage, type AlbumGroupScope } from '../../api/album';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useAlbumKeys } from './useAlbumGroups';

/**
 * 图片上下架开关。
 *
 * <p>与菜谱列表那一列同一口径：开关**就是**状态，不再另配一个"上架/下架"的 Tag（原先两处各说一遍）；
 * 也不给 `size="small"`——小尺寸轨道只有 16px 高，塞不下"上架/下架"四个字。
 * 文案上没有额外解释：关掉之后这张图在 C 端就没了，B 端照旧看得见，这是 `status` 三态本来的语义。
 *
 * <p>请求只发 `{ status }`：后端 `AlbumImageService.update` 对 `city`/`status` 各自判 null，
 * 所以改状态不会把城市冲掉（`ImageEditModal` 反向同理，它只发 city）。
 *
 * <p>抽成一个组件而不是两页各写一遍，还有一层好处：**mutation 挂在每张卡片自己身上**，
 * `loading` 就只转被点的那一枚开关。菜谱那一页是全表共用一个 mutation，只能刻意不挂 loading
 * （一挂所有行的开关一起转），这里没必要抄那个妥协。
 */
export function AlbumImageStatusSwitch({ imageId, status, scope }: { imageId: number; status: ContentStatus; scope: AlbumGroupScope }) {
  const keys = useAlbumKeys(scope);
  const onShelf = status === 'ON_SHELF';
  const mutation = useApiMutation(
    async () => {
      await updateAlbumImage(imageId, { status: onShelf ? 'OFF_SHELF' : 'ON_SHELF' }, scope);
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
