import type { CartPractice, PracticeGroup } from "../api/recipe";

/**
 * 做法选中项 → 展示摘要（如 "微辣 · 加糖"）。
 *
 * 字典里已删除的分组/选项直接跳过，不留空括号；全被删光时返回空串。
 */
export function practiceSummary(
  groups: PracticeGroup[],
  picks: CartPractice[],
): string {
  return picks
    .map((p) => {
      const group = groups.find((g) => g.id === p.groupId);
      return group?.options.find((o) => o.id === p.optionId)?.name;
    })
    .filter(Boolean)
    .join(" · ");
}
