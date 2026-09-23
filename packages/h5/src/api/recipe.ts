/**
 * C 端点餐页用的菜谱接口（后端 RecipeCController / RecipeCartCController / RecipeOrderCController，
 * 全在 `/api/c/recipe` 下，方案 §5.4）。
 *
 * 这一套接口只服务 C 端：路径不借 B 端的，返回也按 C 端页面裁剪——菜品只给在架的、
 * 订单与统计一次给全量（不再靠前端传 `pageSize=100` 变通）。落库口径与 B 端共用同一套 service。
 *
 * h5 只借 @family-home/shared 的图片处理、品牌图与当前账号，axios 那份 http 封装不用；
 * 请求封装见 utils/request.ts。
 */

import { getJson, requestJson } from '../utils/request';

/** 对应 RecipeCategoryDTO（分类侧栏那一条） */
export interface RecipeCategory {
  id: number;
  name: string;
  sortOrder: number;
  recipeCount: number;
}

/**
 * 对应 RecipeDTO：点餐页的一道菜。
 *
 * 没有 `status` 这一列：这个接口只返在架菜品，下架的压根查不出来，声明一个恒等值没意义。
 */
export interface Recipe {
  id: number;
  name: string;
  description?: string;
  coverUrl?: string;
  category?: string;
  categoryId?: number;
  practiceGroups: RecipePracticeGroup[];
  updateTime: string;
}

/**
 * 对应 RecipePracticeGroupDTO：这道菜绑定的一个做法分组 + 两项配置。
 *
 * defaultOptionId 为 null（或被删过、不在本组里）时不预选。
 */
export interface RecipePracticeGroup {
  groupId: number;
  /** true = 必须在这组里选一个做法才能加购，且不能点已选中的选项取消 */
  required: boolean;
  defaultOptionId: number | null;
}

/** 对应 PracticeOptionDTO（做法组内一个选项：不辣/微辣/好辣） */
export interface PracticeOption {
  id: number;
  groupId: number;
  name: string;
}

/**
 * 对应 PracticeGroupDTO（做法分组：辣度/糖）。
 *
 * 没有排序字段：options 按录入顺序返回。预选哪个由菜品自己的 practiceGroups 配置决定。
 * B 端的 recipeCount（关联菜品数量）C 端用不上，这里不声明。
 */
export interface PracticeGroup {
  id: number;
  name: string;
  options: PracticeOption[];
}

/** 查询所有菜品分类（按 sortOrder 升序，后端已排好） */
export function listCategories(): Promise<RecipeCategory[]> {
  return getJson<RecipeCategory[]>('/api/c/recipe/categories');
}

/** 查询全部做法分组（含组内选项，均已排序） */
export function listPractices(): Promise<PracticeGroup[]> {
  return getJson<PracticeGroup[]>('/api/c/recipe/practices');
}

/**
 * 整张菜单：全部在架菜品，后端一次给完，前端不翻页。
 *
 * 家庭场景菜品量级就是几十道，所以这一条按 C 端语义做成"不分页的全量列表"，
 * 而不是让前端传一个 `pageSize=100` 去凑。要筛选/翻页的是 B 端菜谱管理页那一条。
 */
export function listOnShelfRecipes(): Promise<Recipe[]> {
  return getJson<Recipe[]>('/api/c/recipe/recipes');
}

/** 购物车条目里的一个做法选择（对应 CartPracticeDTO） */
export interface CartPractice {
  groupId: number;
  optionId: number;
}

/** 对应 CartItemDTO：加购数据落在 recipe_cart_item 表，家庭共用单车 */
export interface CartItem {
  recipeId: number;
  qty: number;
  /** 加购人 ID（app_user.id） */
  creatorId?: number | null;
  practices?: CartPractice[] | null;
}

/** 版本与明细来自同一服务端快照；版本在所有账号之间共享，不按浏览器生成。 */
export interface CartSnapshot {
  version: number;
  items: CartItem[];
}

/** 查询购物车（按加入顺序） */
export function getCart(): Promise<CartSnapshot> {
  return getJson<CartSnapshot>('/api/c/recipe/cart');
}

/** 绝对值改量与做法覆盖；过期版本拒绝，不能覆盖他人修改或复活已下单的车。 */
export function setCartItem(version: number, recipeId: number, qty: number, practices?: CartPractice[]): Promise<CartSnapshot> {
  return requestJson<CartSnapshot>('PUT', '/api/c/recipe/cart', { version, recipeId, qty, practices });
}

export function clearCart(version: number): Promise<CartSnapshot> {
  return requestJson<CartSnapshot>('DELETE', `/api/c/recipe/cart?version=${version}`);
}

/** 下单只传所见版本，不传菜品快照；同一版本重试返回原订单，不重复清车。 */
export function createOrder(version: number): Promise<number> {
  return requestJson<number>('POST', '/api/c/recipe/orders', { version });
}

/** 对应 RecipeOrderItemDTO：菜名、封面图和做法都是下单时的快照 */
export interface OrderItem {
  recipeId: number;
  recipeName: string;
  /** 下单那一刻的封面 URL；NULL=这道菜当时没图（或这单早于 V315） */
  coverUrl?: string | null;
  qty: number;
  practices?: CartPractice[] | null;
}

/** 对应 RecipeOrderDTO（列表与详情同一结构，列表也带明细） */
export interface Order {
  id: number;
  /** 订单状态：PENDING=待制作 / COMPLETED=已完成 / CANCELLED=已取消（终态，不能改回） */
  status: string;
  totalQty: number;
  /** 下单人（app_user.id）：谁在这台手机上点的单。名字要拿账号字典现查，见 utils/userNames */
  creatorId?: number | null;
  /** 后端 LocalDateTime 序列化成 ISO 串 */
  createTime: string;
  items: OrderItem[];
}

/**
 * 我的订单（最近下单的在前，含明细）。
 *
 * 后端这一条<b>不分页、也不接受筛选参数</b>：家庭场景单量小，C 端就是要一次看全。
 * 按状态/菜名筛那份是分页接口，只有 B 端点单列表用。
 */
export function listOrders(): Promise<Order[]> {
  return getJson<Order[]>('/api/c/recipe/orders');
}

/** 订单详情；订单不存在时后端返回业务错（"订单不存在"） */
export function getOrder(id: number): Promise<Order> {
  return getJson<Order>(`/api/c/recipe/orders/${id}`);
}

/** 对应 ReorderResultDTO：再来一单的回执（只回计数，车里的内容仍由 getCart 重读） */
export interface ReorderResult {
  /** 加入购物车的菜品条数 */
  addedCount: number;
  /** 跳过的条数：菜品已删除，历史快照里的菜加不回来 */
  skippedCount: number;
}

/**
 * 再来一单：把这一单的明细追加进当前购物车（同一道菜份数累加，做法以本单快照覆盖）。
 *
 * 只写车、不成单——下不下单仍由确认页那个按钮决定；无请求体，购物车以服务端为准。
 */
export function reorderOrder(id: number): Promise<ReorderResult> {
  return requestJson<ReorderResult>('POST', `/api/c/recipe/orders/${id}/again`);
}

/**
 * 推进到已完成（PENDING → COMPLETED）。这一档是定稿：两端都没有改回待制作的入口。
 *
 * 后端对重复调用按幂等处理，所以已完成的单再点一次也不会报错。
 */
export function completeOrder(id: number): Promise<null> {
  return requestJson<null>('POST', `/api/c/recipe/orders/${id}/complete`);
}

/**
 * 取消订单（PENDING → CANCELLED）。只有待制作的单能取消，已完成的单后端会报错。
 *
 * 已取消是终态：这一单不再算进"点过 x 次"，也不能改回来，想吃只能再下一单。
 */
export function cancelOrder(id: number): Promise<null> {
  return requestJson<null>('POST', `/api/c/recipe/orders/${id}/cancel`);
}

/**
 * 继续加菜：把当前购物车并进这一单（同一道菜份数累加，做法以本次加购覆盖），后端同时清空购物车。
 *
 * 只有待制作的单可以加；与普通下单共用购物车版本和消费回执，不能重复追加。
 */
export function appendCartToOrder(id: number, version: number): Promise<null> {
  return requestJson<null>('POST', `/api/c/recipe/orders/${id}/append`, { version });
}

/** 对应 RecipeOrderStatDTO（统计的一个聚合行） */
export interface RecipeOrderStat {
  recipeId: number;
  /** 菜名快照（后端按 recipe_id 聚合时取字符串序最大的那条）。点餐页不用它——卡片按 recipeId 取数，菜名以菜谱为准 */
  recipeName: string;
  /** 累计下单份数 SUM(qty) */
  totalQty: number;
}

/**
 * 点单统计：每个菜品的累计下单份数，按份数倒序，一次给全。
 *
 * C 端点餐页拿它回显卡片上的"点过 x 次"。**这个 x 就是累计份数**（口径已与产品确认，
 * 不是"下过几张单"），而且已取消的单不算。
 *
 * <p>这一条不分页：这一页要的就是**所有**菜品的份数，服务端直接给全量列表，
 * 所以不需要像以前那样传 `pageSize=100` 去够上限。B 端统计页要翻页和按菜名筛，走 `/api/b` 那一条，
 * 两处的聚合是同一次实现，数字对得上。
 */
export function listOrderStatistics(): Promise<RecipeOrderStat[]> {
  return getJson<RecipeOrderStat[]>('/api/c/recipe/orders/statistics');
}
