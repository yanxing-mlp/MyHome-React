import { PagePlaceholder } from '../../components/PagePlaceholder';

export function GroupListPage() {
  return (
    <PagePlaceholder
      title="相册分组"
      milestone="M3（相册域）"
      planned={[
        '分组卡片网格，每张卡片显示封面 + 分组名 + 图片数',
        '新建分组（只填名称，sort 由后端取 max(sort)+1 排到最前）',
        '拖拽排序：拖完把全部分组重排为 N..1 一次性提交 PUT /api/b/album/groups/sort',
        '改名、删除分组',
        '删除分组会级联删除其下全部图片（含物理删文件），必须强二次确认并显示图片数',
      ]}
      notes={[
        '列表不分页：拖拽排序要求前端持有完整列表，跨页拖不动（方案 §5.3）',
        '触摸端长按 200ms 触发拖拽，activationConstraint 的 delay/tolerance 只能真机调（方案 §10 风险 9）',
        '封面不存字段，取该分组最新一张上架图，用批量子查询一次拿到（方案 §4.3）',
        '分组是两态 deleted，可以挂 @TableLogic；图片是三态 status，必须手写过滤——两种机制并存容易搞混',
      ]}
    />
  );
}
