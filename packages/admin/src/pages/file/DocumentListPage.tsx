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
import { useDeleteDocument, useDocuments, useDownloadDocument } from '../../features/file/useDocuments';

/**
 * 文件管理：上传的文件列表，可下载可删。**不限格式**（2026-09-21 起，原先只收 csv / md / doc / docx）。
 *
 * 与相册/菜谱的关系：文件都存在于同一张 file_object 表里，靠 biz_type 区分。
 * 这一页只列 document 那部分，图片仍在相册页管理——删除入口也不通（后端会挡）。
 * 一期不分页：家庭量级几十份，整表返回；真要多了再补分页，不提前铺。
 */
export function DocumentListPage({ scope = 'PUBLIC' }: { scope?: DataScope }) {
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data, isFetching } = useDocuments(categoryId ?? undefined, scope);
  const deleteDocument = useDeleteDocument(scope);
  const { download, downloadingId } = useDownloadDocument(scope);
  const documents = data ?? [];

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
    { title: '分类', dataIndex: 'categoryName', width: 140, render: (v: string | null) => v ?? '-' },
    {
      title: '文件类型',
      dataIndex: 'fileType',
      width: 110,
      // 就是扩展名大写；没有扩展名的文件（后端收到空 ext）不给一个空 Tag 壳，整格留白
      render: (type: string) => (type ? <Tag>{type}</Tag> : null),
    },
    {
      title: '大小',
      dataIndex: 'fileSize',
      width: 110,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '添加人',
      dataIndex: 'creatorId',
      width: 110,
      render: (id?: number | null) => <CreatorText id={id} />,
    },
    {
      title: '上传时间',
      dataIndex: 'createTime',
      width: 170,
      render: (time: string) => <TimeText value={time} />,
    },
    {
      title: '操作',
      key: 'actions',
      width: 90,
      render: (_, record) => (
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
      ),
    },
  ];

  return (
    <PageShell
      title={scope === 'PRIVATE' ? '私人文件' : '公共文件'}
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
          locale={{ emptyText: '还没有文件，点右上角「上传文件」' }}
        />
      </Card>

      {uploadOpen && <UploadDocumentModal scope={scope} open onClose={() => setUploadOpen(false)} />}
    </PageShell>
  );
}
