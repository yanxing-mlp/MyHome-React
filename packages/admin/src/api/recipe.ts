import { del, get, post, put, toQuery } from '../lib/http';
import type { PageResult } from '../lib/http';

// ========== Types ==========

export interface RecipeDTO {
  id: number;
  name: string;
  description?: string;
  status: string;
  coverUrl?: string;
  category?: string;
  categoryId?: number;
  practiceGroups: RecipePracticeGroup[];
  /** 添加人（app_user.id），存量已由迁移洗成大宝 */
  creatorId?: number | null;
  updateTime: string;
}

/** 菜谱绑定的一个做法分组，带上这道菜在该组里的两项配置 */
export interface RecipePracticeGroup {
  groupId: number;
  /** true = C 端必须在这组里选一个做法 */
  required: boolean;
  /** 默认选中的选项，null = 不预选 */
  defaultOptionId: number | null;
}

export interface RecipeQueryRequest {
  keyword?: string;
  status?: string;
  categoryId?: number;
  pageNo: number;
  pageSize: number;
}

export interface CreateRecipeRequest {
  name: string;
  description?: string;
  status?: string;
  categoryId?: number;
  practiceGroups?: RecipePracticeGroup[];
  coverFileIds?: number[];
}

export interface UpdateRecipeRequest {
  name: string;
  description?: string;
  status?: string;
  categoryId?: number;
  /** 覆盖：不传 = 不动，空数组 = 清空 */
  practiceGroups?: RecipePracticeGroup[];
  coverFileIds?: number[];
}

export interface RecipeCategoryDTO {
  id: number;
  name: string;
  sortOrder: number;
  recipeCount: number;
  /** 添加人（app_user.id） */
  creatorId?: number | null;
}

/** 做法选项（组内一项）：后端按录入顺序（id）返回，没有排序字段 */
export interface PracticeOptionDTO {
  id: number;
  groupId: number;
  name: string;
}

export interface PracticeGroupDTO {
  id: number;
  name: string;
  /** 关联菜品数量：已删除的菜品不算，下架的仍算 */
  recipeCount: number;
  options: PracticeOptionDTO[];
}

/** 提交的一个选项：带 id=改名，不带 id=新增，这次没列出的会被删掉 */
export interface PracticeOptionItem {
  id?: number;
  name: string;
}

// ========== API Functions ==========

/** 分页查询菜谱列表 */
export async function pageRecipes(query: RecipeQueryRequest) {
  const res = await get<{
    list: RecipeDTO[];
    total: number;
    pageNo: number;
    pageSize: number;
  }>(`/api/b/recipe/recipes${toQuery(query)}`);
  return res;
}

/** 获取菜谱详情 */
export async function getRecipeDetail(id: number) {
  const res = await get<RecipeDTO>(`/api/b/recipe/recipes/${id}`);
  return res;
}

/** 创建菜谱 */
export async function createRecipe(data: CreateRecipeRequest) {
  const res = await post<number>('/api/b/recipe/recipes', data);
  return res;
}

/** 更新菜谱 */
export async function updateRecipe(id: number, data: UpdateRecipeRequest) {
  await put(`/api/b/recipe/recipes/${id}`, data);
}

/** 删除菜谱 */
export async function deleteRecipe(id: number) {
  await del(`/api/b/recipe/recipes/${id}`);
}

/** 查询所有分类 */
export async function listCategories() {
  const res = await get<RecipeCategoryDTO[]>('/api/b/recipe/categories');
  return res;
}

/** 创建分类 */
export async function createCategory(name: string, sortOrder?: number) {
  const res = await post<number>('/api/b/recipe/categories', { name, sortOrder });
  return res;
}

/** 更新分类 */
export async function updateCategory(id: number, name: string, sortOrder?: number) {
  await put(`/api/b/recipe/categories/${id}`, { name, sortOrder });
}

/** 删除分类 */
export async function deleteCategory(id: number) {
  await del(`/api/b/recipe/categories/${id}`);
}

// ========== 做法字典 ==========

/** 查询全部做法分组（含组内选项和关联菜品数量） */
export async function listPractices() {
  const res = await get<PracticeGroupDTO[]>('/api/b/recipe/practices');
  return res;
}

/** 创建做法分组（只建分组，选项在列表那一行的 + 里加） */
export async function createPracticeGroup(name: string) {
  const res = await post<number>('/api/b/recipe/practices', { name });
  return res;
}

/**
 * 更新做法分组：组名 + 全部选项一次提交。
 *
 * 表格里改组名、改选项名、加/删选项都发这一个请求（options 带着当前整组），后端按差量改：
 * 带 id 改名、不带 id 新增、没列出的删除。
 */
export async function updatePracticeGroup(id: number, name: string, options: PracticeOptionItem[]) {
  await put(`/api/b/recipe/practices/${id}`, { name, options });
}

/** 删除做法分组（级联删选项 + 解绑菜品） */
export async function deletePracticeGroup(id: number) {
  await del(`/api/b/recipe/practices/${id}`);
}

// ========== 点单订单 ==========

/** 对应后端 CartPracticeDTO：一条做法选择，只存分组 + 选项 ID，名字要拿字典现查 */
export interface OrderPracticeDTO {
  groupId: number;
  optionId: number;
}

/** 对应后端 RecipeOrderItemDTO：菜名与做法都是下单时的快照 */
export interface RecipeOrderItemDTO {
  recipeId: number;
  recipeName: string;
  /** 下单那一刻的封面 URL 快照；这一页不展示图片，字段只为和后端 DTO 对齐 */
  coverUrl?: string | null;
  qty: number;
  practices?: OrderPracticeDTO[] | null;
}

/** 对应后端 RecipeOrderDTO：列表接口就带明细（一行的菜品摘要与份数都从明细来） */
export interface RecipeOrderDTO {
  id: number;
  /** PENDING=待制作 / COMPLETED=已完成 / CANCELLED=已取消（后端按字符串返回，字典外的 code 原样展示） */
  status: string;
  totalQty: number;
  /** 下单人（app_user.id）—— C 端谁登录谁下的单 */
  creatorId?: number | null;
  createTime: string;
  items: RecipeOrderItemDTO[];
}

/**
 * 点单列表的查询条件（对应后端 RecipeOrderQueryRequest）。
 *
 * `keyword` 打的是明细里的菜名快照，不是菜谱现名——下单之后那道菜改名了，老单仍按老名字搜得到。
 */
export interface RecipeOrderQueryRequest {
  keyword?: string;
  status?: string;
  pageNo: number;
  pageSize: number;
}

/** 这一页能把状态改去的那几档（区别于上面的 status：那是实况值，这是可选目标）。
 *  已完成与已取消都是定稿档，只能从待制作推过去，没有改回待制作这一档 */
export type OrderStatus = 'COMPLETED' | 'CANCELLED';

/** 订单列表：分页 + 条件过滤，最近下单的在前 */
export async function pageOrders(query: RecipeOrderQueryRequest) {
  const res = await get<PageResult<RecipeOrderDTO>>(`/api/b/recipe/orders${toQuery(query)}`);
  return res;
}

/** 推进到已完成（与 C 端同一个接口，已是已完成时后端按幂等返回成功） */
export async function completeOrder(id: number) {
  await post(`/api/b/recipe/orders/${id}/complete`);
}

/** 取消订单：只有待制作的单能取消，已完成的后端会报错；已取消是终态，改不回来 */
export async function cancelOrder(id: number) {
  await post(`/api/b/recipe/orders/${id}/cancel`);
}

/**
 * 删除订单：整单连同明细物理删掉，点单统计与"点过 x 次"跟着少这一单。
 * 只有已完成/已取消两档删得掉，待制作的后端会报错（列表里那行根本不给这个按钮）。
 */
export async function deleteOrder(id: number) {
  await del(`/api/b/recipe/orders/${id}`);
}

// ========== 点单统计 ==========

/** 对应后端 RecipeOrderStatPracticeDTO：一个做法选项在这道菜上被点过的累计份数（只给 ID，名字现查字典） */
export interface RecipeOrderStatPracticeDTO {
  groupId: number;
  optionId: number;
  qty: number;
}

/** 对应后端 RecipeOrderStatDTO：一个菜品的累计下单份数 + 各做法选项分别被点了多少份 */
export interface RecipeOrderStatDTO {
  recipeId: number;
  recipeName: string;
  /** 菜品当前封面，null = 这道菜没配过图（不是订单快照），展示时走 resolveRecipeCover */
  coverUrl?: string | null;
  totalQty: number;
  /** 份数多的在前；空 = 这道菜没被点过任何做法 */
  practices?: RecipeOrderStatPracticeDTO[] | null;
}

/** 对应后端 RecipeOrderStatQueryRequest：分页 + 菜名关键词（不传 keyword = 全部菜品） */
export interface RecipeOrderStatQueryRequest {
  keyword?: string;
  pageNo: number;
  pageSize: number;
}

/**
 * 点单统计：按菜品聚合累计下单份数（份数多的在前），分页与筛选都在服务端。
 *
 * 聚合永远是对全部参与统计的明细做一次再切片，所以 `total` 是"被点过的菜品数"，
 * 每一行的份数都是这道菜的全历史累计，不是"这一页的份数"。
 */
export async function pageOrderStatistics(query: RecipeOrderStatQueryRequest) {
  const res = await get<PageResult<RecipeOrderStatDTO>>(
    `/api/b/recipe/orders/statistics${toQuery(query)}`
  );
  return res;
}
