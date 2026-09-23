/**
 * C 端相册页用的接口（后端 AlbumCController，`/api/c/album`，方案 §5.4）。
 *
 * 这一端点只服务 C 端：路径与返回形状都按 C 端页面裁剪（下架的分组/图片在服务端就查不出来，
 * 返回体里也没有 C 端不展示的列），落库口径仍与 B 端共用同一套 service。
 * 封面和分组选项按 scope 隔离：默认 FAMILY 为家庭相册，PERSONAL 只返回当前用户的私人相册，
 * 私人相册没有"其他"卡片。
 * 请求封装见 utils/request.ts。
 */

import { getJson, requestJson } from '../utils/request';

export type AlbumScope = 'FAMILY' | 'PERSONAL';

/**
 * 对应 AlbumGroupCoverVO：相册页的一张分组卡片。
 *
 * 封面最多 3 张，顺序是置顶图优先、其余按最新。后端在这里就已经把 C 端不该看的都过掉了：
 * 下架的图不进张数和封面、下架的分组整张卡都不出、没有在架图片的分组也不出卡，
 * 所以这份列表同时也是详情页判断"这个深链还进不进得去"的依据。
 */
export interface AlbumGroupCover {
  /** 仅 FAMILY 有 null = "其他"卡：没关联任何分组的图片归到这里，固定排在最后 */
  groupId: number | null;
  name: string;
  /** 这个分组内的在架图片张数（不是封面那 3 张） */
  imageCount: number;
  coverThumbUrls: string[];
}

/**
 * 相册页的分组卡片列表，按 B 端分组排序值由大到小。
 *
 * scope 默认 FAMILY；PERSONAL 只返回当前用户的私人分组，不包含"其他"卡片。
 * 后端一次全量返回（家庭场景分组数量级很小），前端不翻页。
 */
export function listAlbumCovers(scope: AlbumScope = 'FAMILY'): Promise<AlbumGroupCover[]> {
  return getJson<AlbumGroupCover[]>(`/api/c/album/groups/covers?scope=${scope}`);
}

/**
 * 对应 AlbumImageBriefVO：相册详情里的一张图。
 *
 * C 端只有这四个字段（后端那份 C 端 VO 就这四列，城市/经纬度/拍摄时间/置顶标记/添加人都不下发），
 * 所以这里也不用挑字段。排序仍由后端定：置顶优先、其余按最新。
 */
export interface AlbumImage {
  id: number;
  fileId: number;
  url: string;
  thumbUrl?: string;
}

/** 对应统一分页响应 PageResult */
export interface AlbumImagePage {
  list: AlbumImage[];
  total: number;
  pageNo: number;
  pageSize: number;
  hasMore: boolean;
}

/** 详情页九宫格一页 9 张，正好三列三行 */
export const ALBUM_PAGE_SIZE = 9;

/**
 * 分页查一个相册里的在架图片。
 *
 * 只看得到在架图，而且这一条上<b>没有 status 参数</b>：C 端那一面在服务端写死只查 ON_SHELF。
 * scope 必传，服务端检查资源所属范围与 PERSONAL 属主。
 * 仅家庭相册有"其他"：没有分组 ID，用 ungrouped=true 查没关联任何分组的图片。
 */
export function pageAlbumImages(params: {
  scope: AlbumScope;
  groupId?: number;
  ungrouped?: boolean;
  pageNo: number;
}): Promise<AlbumImagePage> {
  const query = new URLSearchParams({
    scope: params.scope,
    pageNo: String(params.pageNo),
    pageSize: String(ALBUM_PAGE_SIZE),
  });
  if (params.groupId != null) query.set('groupId', String(params.groupId));
  if (params.scope === 'FAMILY' && params.ungrouped) query.set('ungrouped', 'true');
  return getJson<AlbumImagePage>(`/api/c/album/images?${query.toString()}`);
}

// ========== 上传入口要用的三个接口 ==========

/** 对应 AlbumGroupOptionVO：C 端只用到这两列 */
export interface AlbumGroupOption {
  id: number;
  name: string;
}

/**
 * 可绑定的分组选项：**只含上架分组**（下架的整本相册对 C 端不存在，不该选得到）。
 * scope 默认 FAMILY；PERSONAL 只列当前用户的私人分组，两种 scope 的候选不混用。
 *
 * <p>"滤掉下架"是服务端这一条接口的事，前端拿到什么就列什么，不再自己按 `status` 过一遍。
 * 之所以不复用相册页那份封面列表（{@link listAlbumCovers}）：封面列表按 C 端展示规则把没有在架图的
 * 分组整张卡都不出，拿它当选项就会漏掉"空分组"这种正好要往里传第一批图的情况；
 * 而家庭封面列表还会多带一张 groupId 为 null 的"其他"，那张卡不是分组，绑不了，私人相册没有这张卡。
 *
 * <p>C 端**不能新增分组**（用户明确要求），所以这里只读，页面上也不给"+ 新增分组"入口。
 */
export function listAlbumGroupOptions(scope: AlbumScope = 'FAMILY'): Promise<AlbumGroupOption[]> {
  return getJson<AlbumGroupOption[]>(`/api/c/album/groups/options?scope=${scope}`);
}

/** 对应 AlbumCityDTO：一个已有城市 + 它的图片张数 */
export interface AlbumCityOption {
  city: string;
  count: number;
}

/**
 * 已有城市，给城市下拉当候选。
 *
 * <p>城市是自由文本（后端 album_city 只是统计，不是字典），所以除了这里列出来的，
 * 用户还能直接输入一个新城市 —— 新城市不需要预先创建，绑定后后端会自动 upsert 统计。
 */
export function listAlbumCities(scope: AlbumScope): Promise<AlbumCityOption[]> {
  return getJson<AlbumCityOption[]>(`/api/c/album/cities?scope=${scope}`);
}

/**
 * 对应 AlbumImageBindRequest：往分组里挂一张图。
 *
 * <p>lng / lat / shootTime 是前端 exifr 从原图提取的 EXIF，**只能走这个接口**：上传接口只收
 * file + bizType 两个 part，`file_object` 也没有这三列，落库的位置是绑定时的 `album_image` 那一行。
 * shootTime 用本地时区的 "YYYY-MM-DDTHH:mm:ss"（后端字段是 LocalDateTime，带 Z 的 ISO 串它不认）。
 */
export interface AlbumImageBindItem {
  fileId: number;
  city?: string;
  lng?: number;
  lat?: number;
  shootTime?: string;
}

/** 对应 AlbumGroupService.BatchBindResult */
export interface BindImagesResult {
  added: number;
  /** md5 已在本分组里出现过的 fileId，被跳过了 */
  skippedDuplicates: number[];
}

/**
 * 把一批图片绑到一个分组。
 *
 * <p>同域同属主内，后端保证"一张图一行 + N 条关联"，跨域分组不能互相绑定。
 * 所以相册页那个"多选分组"就是按分组各调一次这个接口，顺序无所谓。
 * 同分组内 md5 重复的会被跳过（返回在 skippedDuplicates 里），不报错。
 *
 * <p>B 端上传走的是同一条服务方法的另一路径（`/api/b/album/groups/{id}/images`），落库口径一份。
 */
export function bindImagesToGroup(groupId: number, items: AlbumImageBindItem[], scope: AlbumScope): Promise<BindImagesResult> {
  return requestJson<BindImagesResult>('POST', `/api/c/album/groups/${groupId}/images?scope=${scope}`, { items });
}
