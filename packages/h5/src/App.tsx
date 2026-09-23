import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { getCurrentUser, setCurrentUser, useCurrentUser } from '@family-home/shared/auth';
import { fetchMe } from './api/user';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { AlbumPage } from './pages/AlbumPage';
import { AlbumGroupPage } from './pages/AlbumGroupPage';
import { OrderPage } from './pages/OrderPage';
import { OrderConfirmPage } from './pages/OrderConfirmPage';
import { OrderListPage } from './pages/OrderListPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { VideoPage } from './pages/VideoPage';

/**
 * C 端路由（方案 §7.3）。
 * basename 与 vite base 一致，都是 '/'。
 * 进页面先过一道身份：本机没有缓存过账号就是登录页，登录一次之后一直用那个账号（不再问）。
 * /album 是相册页（一张卡片一个分组，点卡片进详情页）；
 * /album/:groupId 是相册详情页（三列九宫格分页 + 单图预览），"其他"相册走 /album/ungrouped；
 * /album/personal 是当前用户的私人相册页，没有"其他"卡片；
 * /album/personal/:groupId 是私人相册详情页，与家庭相册按 scope 和账号隔离状态；
 * /recipe/order 是点餐页（分类侧栏 + 菜品列表 + 加购）；
 * /recipe/order/confirm 是确认订单页，下单后整单车快照成订单落库；
 * /recipe/orders[/:id] 是订单列表与详情（明细是下单快照；待制作可推进为完成/取消，详情页摘要条带订单号）。
 * /video 是家庭视频页（PUBLIC，全家可见），/video/personal 是私人视频页（PRIVATE，只当前账号）；
 * 两端都只读——列表 + 点开原生 <video> 播放（可选集），上传/删除仍只在 B 端"视频管理"。
 */
export default function App() {
  const user = useCurrentUser();

  /**
   * 拿着本机缓存的 id 回服务端对一次，把昵称/头像刷成现在的值。
   *
   * 账号在 B 端被改名、换头像，C 端下次打开就跟得上；被删掉了则 /me 返 401，
   * 请求层会顺手清掉缓存（见 utils/request），这一帧之后自动回到登录页重选。
   * 失败不提示：网络抖一下不足以把人赶出家门，留着缓存等下次。
   */
  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchMe()
      .then((current) => {
        // 注销/换人后，旧请求不能重新写回身份；同步检查也覆盖 effect 清理前的间隙。
        if (active && getCurrentUser()?.id === user.id) setCurrentUser(current);
      })
      .catch(() => {
        /* 401 已经在请求层清过缓存，其余错误就当没这回事 */
      });
    // 只在"从没登录变成登录"这一次对，昵称改了由登录页/刷新负责，不每次切页都发
    return () => { active = false; };
  }, [user?.id]);

  return (
    <BrowserRouter basename="/">
      {user ? (
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/album" element={<AlbumPage key={`family-${user.id}`} scope="FAMILY" />} />
          <Route path="/album/personal" element={<AlbumPage key={`personal-${user.id}`} scope="PERSONAL" />} />
          <Route path="/album/personal/:groupId" element={<AlbumGroupPage key={`personal-${user.id}`} scope="PERSONAL" />} />
          <Route path="/album/:groupId" element={<AlbumGroupPage key={`family-${user.id}`} scope="FAMILY" />} />
          <Route path="/video" element={<VideoPage key={`family-video-${user.id}`} scope="PUBLIC" />} />
          <Route path="/video/personal" element={<VideoPage key={`personal-video-${user.id}`} scope="PRIVATE" />} />
          <Route path="/recipe/order" element={<OrderPage />} />
          <Route path="/recipe/order/confirm" element={<OrderConfirmPage />} />
          <Route path="/recipe/orders" element={<OrderListPage />} />
          <Route path="/recipe/orders/:id" element={<OrderDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <LoginPage />
      )}
    </BrowserRouter>
  );
}
