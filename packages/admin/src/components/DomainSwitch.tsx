import { Button, Tooltip } from 'antd';
import { SwapOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { useDomain, type Domain } from '../lib/domain';

/**
 * 「当前在哪个域」的常驻指示 + 一键切换。
 *
 * 为什么单独立这么一块：头像下拉里虽然也能切家庭/个人，但它是收起来的——不点开就看不出
 * 现在这套菜单是家庭还是个人（用户口径：「不知道当前用的菜单是家庭还是个人」）。所以侧栏顶部
 * 常驻一枚明确的域牌：文字直接写「家庭 / 个人」，配色也跟着变（家庭=蓝、个人=紫），
 * 右侧那枚 SwapOutlined 就是「点我切换」的提示，整块点一下即在两域间对调（一键切换）。
 *
 * 它和头像下拉、菜单渲染读的是同一个 useDomain（域以 URL 为准、localStorage 兜底，见 lib/domain.ts），
 * 三处永远同步，不会出现「牌子上写家庭、菜单却是个人」的脱钩。切域沿用同一套跳转口径：
 * 跳到当前模块的对应档，没有对应档就回退到该域落地页。
 *
 * collapsed（侧栏收成 64px 图标窄栏）时放不下文字，只留当前域的图标按钮 + Tooltip 说明，点击照样切换。
 */
export function DomainSwitch({
  collapsed = false,
  onAfterSwitch,
}: {
  collapsed?: boolean;
  onAfterSwitch?: () => void;
}) {
  const { domain, setDomain } = useDomain();
  const isFamily = domain === 'FAMILY';
  const other: Domain = isFamily ? 'PERSONAL' : 'FAMILY';
  const toggle = () => {
    setDomain(other);
    // 窄屏抽屉里切完域要顺手关掉抽屉（和点菜单导航后关抽屉同一口径），否则挡住新页面
    onAfterSwitch?.();
  };

  if (collapsed) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '8px 0',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Tooltip title={`当前：${isFamily ? '家庭' : '个人'}（点击切换到${other === 'FAMILY' ? '家庭' : '个人'}）`} placement="right">
          <Button
            type="text"
            aria-label="切换家庭/个人"
            onClick={toggle}
            icon={isFamily ? <TeamOutlined style={{ color: '#1677ff' }} /> : <UserOutlined style={{ color: '#722ed1' }} />}
          />
        </Tooltip>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
      <Tooltip title={`切换到${other === 'FAMILY' ? '家庭' : '个人'}`} placement="right">
        <button
          type="button"
          onClick={toggle}
          aria-label="切换家庭/个人"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            border: `1px solid ${isFamily ? '#91caff' : '#d3adf7'}`,
            borderRadius: 8,
            background: isFamily ? '#e6f4ff' : '#f9f0ff',
            cursor: 'pointer',
            fontSize: 13,
            color: 'rgba(0,0,0,0.88)',
          }}
        >
          {isFamily ? <TeamOutlined style={{ color: '#1677ff' }} /> : <UserOutlined style={{ color: '#722ed1' }} />}
          <span style={{ fontWeight: 600 }}>{isFamily ? '家庭' : '个人'}</span>
          <span style={{ flex: 1 }} />
          <SwapOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />
        </button>
      </Tooltip>
    </div>
  );
}
