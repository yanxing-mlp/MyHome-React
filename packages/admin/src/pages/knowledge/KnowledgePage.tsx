import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Alert,
  App,
  Button,
  Empty,
  Input,
  Modal,
  Result,
  Space,
  Spin,
  Tag,
  Tooltip,
  Tree,
  Typography,
} from 'antd';
import type { TreeDataNode } from 'antd';
import { CloudUploadOutlined, QuestionCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { can, PERMISSION, useCurrentUser } from '@family-home/shared/auth';
import {
  fetchKnowledgeFile,
  fetchKnowledgeGitStatus,
  fetchKnowledgeTree,
  pushKnowledge,
  saveKnowledgeFile,
  type KnowledgeNode,
} from '../../api/knowledge';
import { PageShell } from '../../components/PageShell';
import { useApiMutation } from '../../hooks/useApiMutation';
import { withIdentity } from '../../lib/http';

/** 扩展 antd 树节点：把「是否目录 / 是否可编辑」挂在节点上，onSelect 时据此决定打开编辑器还是只展开。 */
interface KTreeNode extends TreeDataNode {
  isDir?: boolean;
  editable?: boolean;
}

/** 把后端文件树映射成 antd Tree 需要的结构：目录不可选中（只展开），不可编辑的文件标题置灰。 */
function toTreeData(nodes: KnowledgeNode[]): KTreeNode[] {
  return nodes.map((n) => ({
    key: n.key,
    title: n.editable || n.dir ? n.title : <span style={{ color: '#bfbfbf' }}>{n.title}</span>,
    isDir: n.dir,
    editable: n.editable,
    isLeaf: !n.dir,
    selectable: !n.dir,
    children: n.dir ? toTreeData(n.children ?? []) : undefined,
  }));
}

/** 先隔离权限再挂载数据组件：无知识库权限者不会创建任何查询（与系统日志/部署管理页同一口径）。 */
export function KnowledgePage() {
  const user = useCurrentUser();
  if (!user || !can(user, PERMISSION.KNOWLEDGE_ACCESS)) {
    return <Result status="403" title="只有超级管理员能访问知识库" />;
  }
  return <KnowledgeContent key={user.id} userId={user.id} />;
}

function KnowledgeContent({ userId }: { userId: number }) {
  const { message } = App.useApp();
  const [selected, setSelected] = useState<{ path: string; editable: boolean } | null>(null);
  const [draft, setDraft] = useState('');
  const [pushOpen, setPushOpen] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');

  const treeQuery = useQuery({
    queryKey: ['knowledge-tree', userId],
    queryFn: ({ signal }) => fetchKnowledgeTree({ ...withIdentity(String(userId)), signal }),
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 0,
    gcTime: 0,
  });

  const available = treeQuery.data?.available ?? false;
  const rootName = treeQuery.data?.root ?? '';
  const treeData = useMemo(() => toTreeData(treeQuery.data?.tree ?? []), [treeQuery.data]);

  // git 状态：驱动「推送到 Git」按钮的待推送数量与推送弹窗里的改动清单。仅在已接入知识库时查。
  const gitQuery = useQuery({
    queryKey: ['knowledge-git', userId],
    queryFn: ({ signal }) => fetchKnowledgeGitStatus({ ...withIdentity(String(userId)), signal }),
    enabled: available,
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 0,
    gcTime: 0,
  });

  // 选中一个可编辑文件后拉它的全文；切换文件即换 queryKey 重取。
  const fileQuery = useQuery({
    queryKey: ['knowledge-file', userId, selected?.path],
    queryFn: ({ signal }) => fetchKnowledgeFile(selected!.path, { ...withIdentity(String(userId)), signal }),
    enabled: !!selected && selected.editable,
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: Infinity,
    gcTime: 0,
  });

  // 文件全文到达后回填编辑器，并把「原文」锚点设为同一份，dirty 从此比对。
  useEffect(() => {
    if (fileQuery.data) setDraft(fileQuery.data.content);
  }, [fileQuery.data]);

  const original = fileQuery.data?.content ?? '';
  const dirty = !!selected && selected.editable && draft !== original;

  const saveMutation = useApiMutation(
    () => saveKnowledgeFile(selected!.path, draft, withIdentity(String(userId))),
    {
      invalidate: [['knowledge-tree', userId], ['knowledge-git', userId]],
      successMessage: '已保存到本地',
      // 保存成功后把「原文」锚点更新为当前草稿：react-query 不会自动改 fileQuery.data，
      // 这里手动把 data 写回缓存，dirty 才会立刻复位（否则要等重取）。
      onSettledSuccess: () => {
        void treeQuery.refetch();
      },
    },
  );

  const pushMutation = useApiMutation((msg: string) => pushKnowledge(msg, withIdentity(String(userId))), {
    invalidate: [['knowledge-tree', userId], ['knowledge-git', userId]],
    onSettledSuccess: (result) => {
      if (result.ok && result.pushed) {
        message.success('已推送到远端');
      } else if (result.ok && !result.pushed) {
        message.info(result.message || '没有需要推送的改动');
      } else {
        message.error(`${result.message}${result.output ? '：' + result.output.split('\n')[0] : ''}`);
      }
      setPushOpen(false);
    },
  });

  const changed = gitQuery.data?.changed ?? [];
  const gitReady = gitQuery.data?.git ?? false;
  const canPush = available && gitReady && (changed.length > 0 || (gitQuery.data?.ahead ?? 0) > 0);

  const openPush = () => {
    setCommitMsg('');
    setPushOpen(true);
  };

  const onSelect: NonNullable<ComponentProps<typeof Tree>['onSelect']> = (_keys, info) => {
    const node = info.node as KTreeNode;
    if (node.isDir) return;
    setSelected({ path: String(node.key), editable: !!node.editable });
  };

  const actions = (
    <Space size={8}>
      {available && gitReady && (
        <Tag color={canPush ? 'blue' : 'default'}>
          {canPush ? `待推送 ${changed.length + (gitQuery.data?.ahead ?? 0)} 项` : '已是最新'}
        </Tag>
      )}
      <Tooltip title="知识库直接读写部署机上那个 git 工作副本里的文件。「保存」只写回本地文件，不会同步到远端；要把改动发布出去，另点「推送到 Git」——它会先列出待提交的改动清单，填一句提交信息后一次做完 git add / commit / push。二进制文件（图片等）只在左侧列出、不支持在线编辑。开发机未配置知识库目录时此页为空态。">
        <QuestionCircleOutlined aria-label="知识库口径" tabIndex={0} style={{ color: '#8c8c8c' }} />
      </Tooltip>
      <Button
        icon={<ReloadOutlined />}
        loading={treeQuery.isFetching}
        onClick={() => {
          void treeQuery.refetch();
          if (available) void gitQuery.refetch();
        }}
      >
        刷新
      </Button>
      <Button
        type="primary"
        icon={<CloudUploadOutlined />}
        disabled={!canPush}
        loading={pushMutation.isPending}
        onClick={openPush}
      >
        推送到 Git
      </Button>
    </Space>
  );

  let body: ReactNode;
  if (treeQuery.isLoading) {
    body = (
      <Space size={8}>
        <Spin aria-label="正在读取知识库" />
        <Typography.Text type="secondary">正在读取知识库文件树…</Typography.Text>
      </Space>
    );
  } else if (treeQuery.isError) {
    body = <Alert type="error" showIcon message="知识库读取失败" description={treeQuery.error.message} />;
  } else if (!available) {
    body = (
      <Empty description="当前环境未配置知识库目录，无法在此浏览/编辑。">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          部署机配置 fh.knowledge.repo-dir（指向知识库 git 仓库的本地目录）后，这里即可在线浏览、编辑并一键推送。
        </Typography.Text>
      </Empty>
    );
  } else {
    body = (
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 300,
            flex: 'none',
            maxHeight: 'calc(100vh - 240px)',
            minHeight: 360,
            overflow: 'auto',
            border: '1px solid #f0f0f0',
            borderRadius: 6,
            padding: 8,
          }}
        >
          {treeData.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="知识库为空" />
          ) : (
            <Tree
              treeData={treeData}
              onSelect={onSelect}
              selectedKeys={selected ? [selected.path] : []}
              blockNode
            />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {!selected ? (
            <Empty description="从左侧选择一个文件开始浏览/编辑" />
          ) : !selected.editable ? (
            <Empty description="该文件类型不支持在线编辑（二进制文件请在仓库中查看）" />
          ) : fileQuery.isLoading ? (
            <Space size={8}>
              <Spin aria-label="正在读取文件" />
              <Typography.Text type="secondary">正在读取「{selected.path}」…</Typography.Text>
            </Space>
          ) : fileQuery.isError ? (
            <Alert type="error" showIcon message="文件读取失败" description={fileQuery.error.message} />
          ) : (
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Space size={8} wrap>
                <Typography.Text strong>{fileQuery.data?.name}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {selected.path}
                </Typography.Text>
                {dirty && <Tag color="orange">未保存</Tag>}
                <span style={{ flex: 1 }} />
                <Button
                  type="primary"
                  disabled={!dirty}
                  loading={saveMutation.isPending}
                  onClick={() => saveMutation.mutate(undefined)}
                >
                  保存
                </Button>
              </Space>
              <Input.TextArea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-label={`编辑 ${selected.path}`}
                style={{
                  fontFamily: 'Menlo, Consolas, monospace',
                  fontSize: 13,
                  lineHeight: 1.6,
                  height: 'calc(100vh - 320px)',
                  minHeight: 320,
                  resize: 'vertical',
                }}
              />
            </Space>
          )}
        </div>
      </div>
    );
  }

  return (
    <PageShell title={rootName ? `知识库 · ${rootName}` : '知识库'} actions={actions}>
      {body}

      <Modal
        title="推送到 Git"
        open={pushOpen}
        onCancel={() => setPushOpen(false)}
        onOk={() => pushMutation.mutate(commitMsg.trim())}
        okText="确认推送"
        cancelText="取消"
        confirmLoading={pushMutation.isPending}
        okButtonProps={{ icon: <CloudUploadOutlined /> }}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            分支：{gitQuery.data?.branch || '—'}
            {gitQuery.data?.hasUpstream ? '' : '（未配置上游，将推送到 origin 同名分支）'}
          </Typography.Text>
          <div>
            <Typography.Text strong>待推送改动</Typography.Text>
            {changed.length === 0 ? (
              <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                工作副本没有未提交改动{gitQuery.data?.ahead ? `，但本地领先上游 ${gitQuery.data.ahead} 个提交，推送会一并发布。` : '。'}
              </Typography.Paragraph>
            ) : (
              <ul style={{ margin: '4px 0 0', paddingLeft: 20, maxHeight: 220, overflow: 'auto' }}>
                {changed.map((c) => (
                  <li key={c.path}>
                    <Tag>{c.status}</Tag>
                    <Typography.Text style={{ fontSize: 12 }}>{c.path}</Typography.Text>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <Typography.Text strong>提交信息</Typography.Text>
            <Input.TextArea
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              placeholder="留空则用默认：docs: 通过知识库在线编辑更新"
              autoSize={{ minRows: 2, maxRows: 4 }}
              style={{ marginTop: 4 }}
              aria-label="提交信息"
            />
          </div>
        </Space>
      </Modal>
    </PageShell>
  );
}
