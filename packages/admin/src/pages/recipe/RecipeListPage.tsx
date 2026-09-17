import { PagePlaceholder } from '../../components/PagePlaceholder';

export function RecipeListPage() {
  return (
    <PagePlaceholder
      title="菜谱列表"
      milestone="M4（菜谱域）"
      planned={[
        '宽屏 Table / 窄屏（<768px）卡片列表——手机上横向滚动的表格基本没法用',
        '标签多选筛选 + 类型多选筛选 + 关键词搜索 + 状态筛选，分页',
        '每行显示封面、菜名、标签、类型、修改时间',
        '上下架开关（PUT /api/b/recipe/recipes/{id}/status）',
        '删除菜谱：置 DELETED 并物理删除该菜谱全部图片，二次确认要写明图片数和不可恢复',
      ]}
      notes={[
        '筛选语义：同维度内 OR，跨维度 AND。选「午餐+晚餐」和「荤」= (午餐 OR 晚餐) AND 荤',
        '后端用 EXISTS 子查询而不是 JOIN + DISTINCT，否则分页和 count 都会错（方案 §5.6）',
        'tags[] / types[] / coverUrl 用批量查询填充，不要在循环里单条查（N+1）',
      ]}
    />
  );
}
