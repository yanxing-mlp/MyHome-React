import { PagePlaceholder } from '../../components/PagePlaceholder';

export function TagManagePage() {
  return (
    <PagePlaceholder
      title="标签管理"
      milestone="M4（菜谱域）"
      planned={[
        '标签列表：名称 + 「被 N 道菜谱使用」，不分页（量小）',
        '新增标签（重名返回 409 TAG_NAME_DUPLICATED）',
        '改名（关联存的是 id，改名不影响已有菜谱）',
        '删除标签：级联解绑，返回 unboundRecipes 数量',
        '初始数据由 Flyway 插入：午餐 / 晚餐 / 早餐',
      ]}
      notes={[
        '删除按钮不置灰——v4 改成了级联解绑，所以任何标签都能删（方案 §5.3）',
        '但必须二次确认并显示影响范围：「该标签正被 12 道菜谱使用，删除后将从这些菜谱上移除，确定？」',
        'recipeCount 字段的用途就是这句确认文案，不是用来置灰按钮',
        '级联解绑是一个事务：先 DELETE FROM recipe_tag_rel WHERE tag_id=?，再删字典记录',
      ]}
    />
  );
}
