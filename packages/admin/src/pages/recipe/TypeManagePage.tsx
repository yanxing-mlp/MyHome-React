import { PagePlaceholder } from '../../components/PagePlaceholder';

export function TypeManagePage() {
  return (
    <PagePlaceholder
      title="类型管理"
      milestone="M4（菜谱域）"
      planned={[
        '类型列表：名称 + 「被 N 道菜谱使用」，不分页（量小）',
        '新增类型（重名返回 409 TYPE_NAME_DUPLICATED）',
        '改名',
        '删除类型：级联解绑，返回 unboundRecipes 数量',
        '初始数据由 Flyway 插入：荤 / 素 / 汤 / 其他',
      ]}
      notes={[
        '与标签管理完全同构，接口路径换成 /api/b/recipe/types，可以抽一个共用组件',
        '删除同样不置灰，但要二次确认显示影响的菜谱数',
      ]}
    />
  );
}
