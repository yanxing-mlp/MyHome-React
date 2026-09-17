import { useParams } from 'react-router';
import { PagePlaceholder } from '../../components/PagePlaceholder';

export function RecipeEditPage() {
  const { id } = useParams();
  const isCreate = id === undefined;

  return (
    <PagePlaceholder
      title={isCreate ? '新建菜谱' : `编辑菜谱（id=${id}）`}
      milestone="M4（菜谱域）"
      planned={[
        '菜名（必填）',
        '菜品图片：多图上传 + 拖拽调整顺序，第一张即封面（复用 dnd-kit）',
        '做法描述（多行文本，后端 TEXT 类型）',
        '标签多选、类型多选（选项来自字典接口）',
        '状态：上架 / 下架',
        '窄屏下把「基本信息 / 图片 / 标签类型 / 做法描述」从左右分栏改为纵向堆叠',
      ]}
      notes={[
        '三张子表（recipe_image / recipe_tag_rel / recipe_type_rel）都是全量覆盖保存：先按 recipe_id 全删再批量插',
        '编辑时被移除的图片必须调 FileFacade.markDeletedAndPurge，否则变成孤儿文件（方案 §6.7）',
        '提交是一个事务：主表 update + 三张子表覆盖',
      ]}
    />
  );
}
