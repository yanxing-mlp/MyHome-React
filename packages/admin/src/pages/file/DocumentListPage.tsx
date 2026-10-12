import { useState } from 'react';
import { Button, Card, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { formatFileSize } from '@family-home/shared/format';
import type { DocumentFile } from '../../api/file';
import type { DataScope } from '../../lib/http';
import { PageShell } from '../../components/PageShell';
import { CreatorText } from '../../components/CreatorText';
import { TimeText } from '../../components/TimeText';
import { FileCategorySelect } from '../../features/file/FileCategorySelect';
import { UploadDocumentModal } from '../../features/file/UploadDocumentModal';
import { EditFileGroupsModal } from '../../features/file/EditFileGroupsModal';
import { useDeleteDocument, useDocuments, useDownloadDocument } from '../../features/file/useDocuments';
import { useFileGroups } from '../../features/file/useFileGroups';

/**
 * 文件管理：上传的文件列表，可下载可删。**不限格式**（2026-09-21 起，原先只收 csv / md / doc / docx）。
 *
 * 与相册/菜谱的关系：文件都存在于同一张 file_object 表里，靠 biz_type 区分。
 * 这一页只列 document 那部分，图片仍在相册页管理——删除入口也不通（后端会挡）。
 * 一期不分页：家庭量级几十份，整表返回；真要多了再补分页，不提前铺。
 *
 * 两种进入方式共用这一份实现：
 * - 「全部文件」（groupId 不传）：整表 + 分类筛选 + 分组列，行内可「编辑所属分组」。
 * - 「文件分组」详情（groupId 由路由带入）：只列该分组下的文件，标题=分组名，上传即绑这个分组。
 */
export function DocumentListPage({ scope = 'PUBLIC', groupId }: { scope?: DataScope; groupId?: number }) {
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentFile | null>(null);

  const { data, isFetching } = useDocuments(categoryId ?? undefined, scope, groupId);
  const deleteDocument = useDeleteDocument(scope);
  const { download, downloadingId } = useDownloadDocument(scope);
  const documents = data ?? [];

  // 分组详情页的标题就是分组名（复用分组列表查询，不为一个标题新开接口）
  const { data: groups } = useFileGroups('document', scope, undefined, groupId != null);
  const group = groupId != null ? groups?.find((g) => g.id === groupId) : undefined;

  const title = groupId != null
    ? (group?.name ?? '文件分组')
    : (scope === 'PRIVATE' ? '私人文件' : '公共文件');

  const columns: ColumnsType<DocumentFile> = [
    {
      title: '文件名称',
      dataIndex: 'name',
      render: (name: string, record) => (
        scope === 'PUBLIC' && record.url ? (
          <a href={record.url} target="_blank" rel="noreferrer">{name}</a>
        ) : (
          <Button
            type="link"
            style={{ padding: 0, whiteSpace: 'normal', textAlign: 'left', height: 'auto' }}
            loading={downloadingId === record.id}
            onClick={() => void download(record)}
          >
            {name}
          </Button>
        )
      ),
    },
    { title: '分类', dataIndex: 'categoryName', width: 130, render: (v: string | null) => v ?? '-' },
    {
      title: '分组',
      dataIndex: 'groupNames',
      width: 180,
      render: (names: string[] | undefined) =>
        names && names.length > 0
          ? <Space size={4} wrap>{names.map((n) => <Tag key={n}>{n}</Tag>)}</Space>
          : <Typography.Text type="secondary">未分组</Typography.Text>,
    },
    {
      title: '文件类型',
      dataIndex: 'fileType',
      width: 100,
      render: (type: string) => (type ? <Tag>{type}</Tag> : null),
    },
    {
      title: '大小',
      dataIndex: 'fileSize',
      width: 100,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '添加人',
      dataIndex: 'creatorId',
      width: 100,
      render: (id?: number | null) => <CreatorText id={id} />,
    },
    {
      title: '上传时间',
      dataIndex: 'createTime',
      width: 160,
      render: (time: string) => <TimeText value={time} />,
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => setEditing(record)}>
            编辑所属分组
          </Button>
          <Popconfirm
            title="删除这个文件？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => deleteDocument.mutate(record.id)}
          >
            <Button type="link" danger size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageShell
      title={title}
      actions={
        <Button type="primary" onClick={() => setUploadOpen(true)}>
          上传文件
        </Button>
      }
      toolbar={
        <Space wrap>
          <FileCategorySelect
            scope={scope}
            allowClear
            creatable={false}
            placeholder="全部分类"
            value={categoryId}
            onChange={setCategoryId}
            style={{ width: 180 }}
          />
          <Typography.Text type="secondary">共 {documents.length} 个文件</Typography.Text>
        </Space>
      }
    >
      <Card variant="borderless">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={documents}
          loading={isFetching}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          locale={{ emptyText: groupId != null ? '该分组下还没有文件' : '还没有文件，点右上角「上传文件」' }}
        />
      </Card>

      {uploadOpen && (
        <UploadDocumentModal scope={scope} open fixedGroupId={groupId} onClose={() => setUploadOpen(false)} />
      )}
      {editing && (
        <EditFileGroupsModal
          open
          fileId={editing.id}
          initialGroupIds={editing.groupIds ?? []}
          bizType="document"
          scope={scope}
          fileName={editing.name}
          onClose={() => setEditing(null)}
        />
      )}
    </PageShell>
  );
}
