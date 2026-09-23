import type {
  OrderPracticeDTO,
  PracticeGroupDTO,
  RecipeOrderStatPracticeDTO,
} from '../../api/recipe';

/**
 * 选项名字现查做法字典：分组或选项已被删除时返回 undefined。
 *
 * 快照里只有 groupId/optionId，删掉了就无从显示——调用方跳过这一档。
 */
function optionName(
  groups: PracticeGroupDTO[],
  groupId: number,
  optionId: number,
): string | undefined {
  return groups
    .find((group) => group.id === groupId)
    ?.options.find((option) => option.id === optionId)?.name;
}

/**
 * 做法选中项 → 展示摘要（如 "微辣 · 加糖"）。
 *
 * 订单明细里只存 groupId/optionId，名字要拿做法字典现查；字典里已删除的分组/选项
 * 直接跳过（快照不记名字，删了就无从显示），全跳光时返回空串。
 *
 * 与 h5 的 utils/practice.ts 同口径——h5 刻意不依赖 @family-home/shared，
 * 所以两边各留一份同样的小函数。
 */
export function practiceSummary(
  groups: PracticeGroupDTO[],
  picks?: OrderPracticeDTO[] | null,
): string {
  if (!picks || picks.length === 0) return '';
  return picks
    .map((pick) => optionName(groups, pick.groupId, pick.optionId))
    .filter(Boolean)
    .join(' · ');
}

/**
 * 做法份数 → 展示摘要（如 "微辣 ×3 · 特辣 ×1"）。
 *
 * 统计接口按选项回份数，名字同样现查字典、已删除的那档跳过；顺序沿用后端排好的
 * "份数多的在前"，不在前端重排。全跳光时返回空串，这一列留白。
 */
export function practiceCountSummary(
  groups: PracticeGroupDTO[],
  counts?: RecipeOrderStatPracticeDTO[] | null,
): string {
  if (!counts || counts.length === 0) return '';
  return counts
    .map((count) => {
      const name = optionName(groups, count.groupId, count.optionId);
      return name ? `${name} ×${count.qty}` : '';
    })
    .filter(Boolean)
    .join(' · ');
}
