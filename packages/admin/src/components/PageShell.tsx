import type { ReactNode } from 'react';
import { Space, Typography } from 'antd';

interface PageShellProps {
  title: string;
  /** 标题右侧的操作区（新建按钮、批量操作等） */
  actions?: ReactNode;
  /** 标题下方、正文上方的一条副信息（筛选器、统计、说明） */
  toolbar?: ReactNode;
  children: ReactNode;
}

/**
 * 页面外壳：标题 + 操作区 + 内容纵向堆叠。
 *
 * 抽出来的理由：B 端每个列表页都是同一套「大标题 + 右上角主操作 + 下面一排筛选 + 内容」，
 * 包括 M3 的分组页 / 图片网格页、M4 的菜谱列表 / 分类 / 做法页。间距只在这一处定义，
 * 改一处全站跟着改。
 *
 * 注意 antd v6 已把 `Space` 的 `direction` 标为废弃，这里用 `orientation`。
 */
export function PageShell({ title, actions, toolbar, children }: PageShellProps) {
  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {actions ? <Space>{actions}</Space> : null}
      </div>

      {toolbar}

      {children}
    </Space>
  );
}
