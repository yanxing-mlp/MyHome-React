import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, Card, Form, Input, Select, Switch, Space, Upload, App, Divider, Checkbox } from 'antd';
import type { UploadFile } from 'antd';
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import { DuplicateFormItem } from '../../components/DuplicateFormItem';
import { DuplicateNameInput } from '../../components/DuplicateNameInput';
import { useValidationSession } from '../../hooks/useValidationSession';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { PageShell } from '../../components/PageShell';
import { useRecipeDetail } from '../../features/recipe/useRecipes';
import { useCreateRecipe, useUpdateRecipe } from '../../features/recipe/useRecipeMutations';
import { useCategories, useCreateCategory } from '../../features/recipe/useCategories';
import { usePractices } from '../../features/recipe/usePractices';
import { compressImage } from '@family-home/shared/image';
import { uploadImage } from '../../api/album';

const { TextArea } = Input;

/** 这道菜在某个做法分组上的配置（存在关联行里，跟着菜谱一起保存） */
interface PracticeConfig {
  required: boolean;
  defaultOptionId: number | null;
}

const NO_PRACTICE_CONFIG: PracticeConfig = { required: false, defaultOptionId: null };

/** 分类下拉里"未分类"这一档的取值（编辑态才出现，见下方 options 的注释） */
const NO_CATEGORY = '__NONE__';

/** 菜谱封面的业务类型，取值对齐后端 `file_object.biz_type` 列注释（相册那边是 ALBUM_IMAGE） */
const BIZ_TYPE_RECIPE_IMAGE = 'RECIPE_IMAGE';

/** 拖拽排序图片项 */
function SortableImage({ file }: { file: UploadFile }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: file.uid,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        style={{
          width: 104,
          height: 104,
          marginRight: 8,
          marginBottom: 8,
          position: 'relative',
          cursor: 'grab',
        }}
      >
        <img
          src={file.url || (file.originFileObj ? URL.createObjectURL(file.originFileObj) : '')}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            fontSize: 12,
            textAlign: 'center',
            padding: '2px 0',
          }}
        >
          拖拽排序
        </div>
      </div>
    </div>
  );
}

export function RecipeEditPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isCreate = id === undefined;
  const recipeId = id ? Number(id) : undefined;
  const { capture } = useValidationSession(true, id ?? 'new');

  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [categoryPopupOpen, setCategoryPopupOpen] = useState(false);
  // 每个做法分组一项配置，键是分组 id。放在组件 state 而不是 Form 里：
  // antd v6 的 Form.List 在 setFieldsValue 时不回灌子项值（做法编辑弹窗踩过这个坑）。
  const [practiceConfigs, setPracticeConfigs] = useState<Record<number, PracticeConfig>>({});

  const selectedPracticeGroupIds: number[] = Form.useWatch('practiceGroupIds', form) ?? [];

  const setPracticeConfig = (groupId: number, patch: Partial<PracticeConfig>) => {
    setPracticeConfigs((prev) => ({
      ...prev,
      [groupId]: { ...NO_PRACTICE_CONFIG, ...prev[groupId], ...patch },
    }));
  };

  const { data: recipe, isLoading: loadingDetail } = useRecipeDetail(recipeId);
  const { data: categories } = useCategories();
  const { data: practices } = usePractices();
  const createMutation = useCreateRecipe();
  const updateMutation = useUpdateRecipe();
  const createCategoryMutation = useCreateCategory();

  // 初始化表单数据
  useEffect(() => {
    if (recipe) {
      const configs: Record<number, PracticeConfig> = {};
      recipe.practiceGroups.forEach((p) => {
        configs[p.groupId] = {
          required: p.required === true,
          defaultOptionId: p.defaultOptionId ?? null,
        };
      });
      setPracticeConfigs(configs);
      form.setFieldsValue({
        name: recipe.name,
        description: recipe.description,
        status: recipe.status === 'ON_SHELF',
        // 没有分类的菜要能在下拉里显示"未分类"，就得回填成那个选项的取值（哨兵，不是 null）
        categoryId: recipe.categoryId ?? NO_CATEGORY,
        practiceGroupIds: recipe.practiceGroups.map((p) => p.groupId),
      });
      // 初始化图片列表
      if (recipe.coverUrl) {
        setFileList([
          {
            uid: '-1',
            name: 'cover.jpg',
            status: 'done',
            url: recipe.coverUrl,
          },
        ]);
      }
    }
  }, [recipe, form]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fileList.findIndex((f) => f.uid === active.id);
    const newIndex = fileList.findIndex((f) => f.uid === over.id);
    setFileList(arrayMove(fileList, oldIndex, newIndex));
  };

  /**
   * 选一张图：先 canvas 转 JPEG 再上传（同相册那条路，见 `useAlbumImageUpload`）。
   *
   * <p>不能直传原文件：后端 `FileFacadeImpl` 的 mime 白名单只有 jpeg/png/webp/gif，
   * iPhone 上的 HEIC 原图会被 415 打回；而且相册那边传的都是转码后的图，菜谱这里再直传原图
   * 就等于同一份能力两套体积。
   */
  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const jpegFile = new File([compressed.blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
        type: 'image/jpeg',
      });
      const result = await uploadImage(jpegFile, BIZ_TYPE_RECIPE_IMAGE);
      const newFile: UploadFile = {
        uid: String(result.id),
        name: file.name,
        status: 'done',
        url: result.url || '',
      };
      setFileList((prev) => [...prev, newFile]);
      message.success('上传成功');
    } catch (error) {
      message.error('上传失败');
    } finally {
      setUploading(false);
    }
    return false; // 阻止默认上传行为
  };

  const handleSubmit = async (values: any) => {
    const isCurrent = capture();
    const coverFileIds = fileList
      .filter((f) => f.status === 'done')
      .map((f) => parseInt(f.uid))
      .filter((id) => !isNaN(id) && id > 0);

    const data = {
      name: values.name.trim(),
      description: values.description,
      status: values.status ? 'ON_SHELF' : 'OFF_SHELF',
      // 哨兵回写成 null：后端 updateRecipe 只在 categoryId 非 null 时覆盖关联行，
      // 传 null = 不动，正好对应"这道菜本来就没分类"。
      categoryId: values.categoryId === NO_CATEGORY ? null : values.categoryId,
      // 只按当前勾选的分组提交：取消勾选的分组配置留在 map 里也没人读
      practiceGroups: ((values.practiceGroupIds ?? []) as number[]).map((groupId) => ({
        groupId,
        ...NO_PRACTICE_CONFIG,
        ...practiceConfigs[groupId],
      })),
      coverFileIds: coverFileIds.length > 0 ? coverFileIds : undefined,
    };

    try {
      if (isCreate) {
        await createMutation.mutateAsync(data);
      } else if (recipeId) {
        await updateMutation.mutateAsync({ id: recipeId, data });
      }
      if (isCurrent()) navigate('/recipe');
    } catch (error) {
      if (isCurrent()) message.error(error instanceof Error ? error.message : (isCreate ? '创建失败' : '更新失败'));
    }
  };

  const uploadButton = (
    <div style={{
      width: 104,
      height: 104,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    }}>
      {uploading ? <LoadingOutlined /> : <PlusOutlined />}
      <div>上传图片</div>
    </div>
  );

  const handleCategoryChange = async (value: any) => {
    if (value === '__ADD_NEW__') {
      setIsAddingCategory(true);
    }
  };

  return (
    <PageShell title={isCreate ? '新建菜谱' : '编辑菜谱'}>
      <Card variant="borderless" loading={loadingDetail}>
        <Form
          form={form}
          layout="vertical"
          disabled={createMutation.isPending || updateMutation.isPending}
          onSubmitCapture={async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (createMutation.isPending || updateMutation.isPending) return;
            const isCurrent = capture();
            try {
              const values = await form.validateFields();
              if (isCurrent()) await handleSubmit(values);
            } catch {
              // Form.Item 保留校验错误；离开页面后不继续写入。
            }
          }}
          // 新建默认上架：以前不给初值，Switch 关着进页面，于是建出来的菜全是下架，
          // 而"上架"才是常态（C 端只展示上架的）。编辑态由下面那个回填 useEffect 覆盖。
          initialValues={{ status: true }}
          style={{ maxWidth: 800 }}
        >
          <DuplicateFormItem
            label="菜名"
            name="name"
            duplicate={{ kind: 'RECIPE', excludeId: recipeId }}
            rules={[{ required: true, whitespace: true, message: '请输入菜名' }]}
          >
            <Input placeholder="例如：红烧肉" />
          </DuplicateFormItem>

          <Form.Item label="做法描述" name="description">
            <TextArea rows={4} placeholder="详细描述做法步骤..." />
          </Form.Item>

          <Form.Item label="菜品图片" extra="第一张为封面图，可拖拽调整顺序">
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fileList.map((f) => f.uid)}>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {fileList.map((file) => (
                    <SortableImage key={file.uid} file={file} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <Upload
              listType="picture-card"
              fileList={[]}
              beforeUpload={handleUpload}
              showUploadList={false}
            >
              {fileList.length >= 8 ? null : uploadButton}
            </Upload>
          </Form.Item>

          <Form.Item
            label="菜品分类"
            name="categoryId"
            rules={isCreate ? [{ required: true, message: '请选择菜品分类' }] : undefined}
          >
            <Select
              placeholder="选择分类"
              onChange={handleCategoryChange}
              onOpenChange={setCategoryPopupOpen}
              popupRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  {isAddingCategory ? (
                    <DuplicateNameInput
                      placeholder="输入分类名称，按回车确认"
                      duplicate={{ kind: 'RECIPE_CATEGORY' }}
                      active={categoryPopupOpen}
                      requiredMessage="请输入分类名称"
                      saveOnBlur={false}
                      showConfirm
                      onSave={(name) => createCategoryMutation.mutateAsync({ name })}
                      onSaved={() => setIsAddingCategory(false)}
                      onCancel={() => setIsAddingCategory(false)}
                      autoFocus
                      style={{ padding: '4px 8px' }}
                    />
                  ) : (
                    <div
                      style={{
                        padding: '4px 11px',
                        cursor: 'pointer',
                        color: '#1890ff',
                        fontWeight: 500,
                      }}
                      onClick={() => setIsAddingCategory(true)}
                    >
                      + 新增分类
                    </div>
                  )}
                </>
              )}
              options={[
                // "未分类"不是一个可选项，只是当前状态的显示：删分类时服务端会先解绑菜品
                // （RecipeCategoryServiceImpl.deleteCategory），那些菜编辑时 categoryId 为空。
                // 它 disabled、也只在这道菜确实没分类时才出现，因为反过来"把菜改成未分类"
                // 服务端做不到：updateRecipe 只在 categoryId 非 null 时覆盖关联行，传 null 等于不动。
                // 值用哨兵不用 null：rc-select 对 value 为 null 的选项会打告警。
                ...(recipe && recipe.categoryId == null
                  ? [{ label: '未分类', value: NO_CATEGORY, disabled: true }]
                  : []),
                ...(categories?.map((c: { id: number; name: string }) => ({ label: c.name, value: c.id })) || [])
              ]}
            />
          </Form.Item>

          <Form.Item label="可选做法" name="practiceGroupIds">
            <Select
              mode="multiple"
              placeholder="选择做法分组（可多选）"
              allowClear
              options={practices?.map((g: { id: number; name: string }) => ({ label: g.name, value: g.id })) || []}
            />
          </Form.Item>

          {selectedPracticeGroupIds.map((groupId) => {
            const group = practices?.find(
              (g: { id: number; name: string; options: { id: number; name: string }[] }) => g.id === groupId
            );
            if (!group) return null;
            const config = practiceConfigs[groupId] ?? NO_PRACTICE_CONFIG;
            return (
              <div
                key={groupId}
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginBottom: 12,
                  background: '#fafafa',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{group.name}</span>
                  <Space size={8}>
                    <span>必选</span>
                    <Switch
                      checked={config.required}
                      disabled={group.options.length === 0}
                      onChange={(checked) => setPracticeConfig(groupId, { required: checked })}
                    />
                  </Space>
                </div>
                {group.options.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 16px' }}>
                    <span>默认选中</span>
                    {group.options.map((o) => {
                      const checked = config.defaultOptionId === o.id;
                      return (
                        <Checkbox
                          key={o.id}
                          checked={checked}
                          disabled={!checked && config.defaultOptionId !== null}
                          onChange={(e) =>
                            setPracticeConfig(groupId, {
                              defaultOptionId: e.target.checked ? o.id : null,
                            })
                          }
                        >
                          {o.name}
                        </Checkbox>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <Form.Item label="状态" name="status" valuePropName="checked">
            <Switch checkedChildren="上架" unCheckedChildren="下架" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending || updateMutation.isPending}>
                保存
              </Button>
              <Button onClick={() => navigate('/recipe')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </PageShell>
  );
}
