import { Alert } from 'antd';
import { CapabilityList } from './CapabilityList';
import { PageShell } from './PageShell';

interface PagePlaceholderProps {
  /** 页面标题 */
  title: string;
  /** 哪个里程碑实现 */
  milestone: string;
  /** 该页面计划实现的能力 */
  planned: string[];
  /** 需要提醒的实现要点/坑 */
  notes?: string[];
}

/**
 * 未实现页面的占位。
 *
 * 刻意把每个页面将来要做什么、以及方案里对应的坑写在页面上，
 * 这样打开浏览器就能看到 M3/M4 的工作清单，不用回头翻文档。
 *
 * 外壳走 PageShell、两段清单走 CapabilityList —— 本组件只负责"占位"这件事的语义，
 * 排版不在这里重复一遍。
 */
export function PagePlaceholder({ title, milestone, planned, notes }: PagePlaceholderProps) {
  return (
    <PageShell title={title}>
      <Alert
        type="info"
        showIcon
        title={`本页面将在 ${milestone} 实现`}
        description="已交付的是骨架：多模块工程、统一响应、Flyway 建表、前后端联调通路。"
      />

      <CapabilityList title="计划实现的能力" items={planned} />

      {notes && notes.length > 0 && (
        <CapabilityList title="实现要点" items={notes} tone="secondary" />
      )}
    </PageShell>
  );
}
