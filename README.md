# family-home-web

家庭 Home 前端，pnpm monorepo：B 端管理后台（admin）+ C 端 H5（h5）+ 跨端共享包（shared）。

- 技术栈：React 19 · TypeScript 5.9 · Vite 8 · antd 6（admin）· TanStack Query 5 · react-router 7；h5 不引组件库，UI 全是手写 `fh-*` 样式
- 配套后端：[family-home-server](https://github.com/yanxing-mlp/MyHome)（`http://localhost:8080`）

## 业务字段去重（2026-09-22）

B 端菜名、菜品分类（含下拉新增）、做法分组/组选项、相册分组、账号昵称/手机号、个人资料、密码本、文件分类统一接入 `POST /api/b/validation/duplicate`。不使用当前页面列表判重，由数据库比较首尾普通空格、大小写及重音；编辑传 excludeId，选项传 groupId，相册传 FAMILY/PERSONAL scope，文件分类与密码本传 PUBLIC/PRIVATE scope，私人属主由后端取当前身份。密码本只检查同分区的「平台名称 + 账号」，密码不参与判重请求。

`DuplicateFormItem` 使用 250ms 防抖与输入/失焦校验；网络异常同样阻止提交。`DuplicateNameInput` 支持行内回车/失焦保存，无效时保留输入和红色错误；下拉新增使用无 DOM Form，避免嵌套 HTML form 和回车误提交外层。`FormModal` 保存前等待字段校验，校验中重复点击不重复写入，写入阶段禁用表单。按钮不保证始终呈禁用外观，真正的拦截在提交校验中；服务端 409 仍是并发情况下的最终兜底。

`useValidationSession` 在关闭、卸载、换账号及业务上下文变化时废弃旧校验/保存回调；密码本两个联合字段相互依赖，任一变更都会重新检查。B 端 `refreshMe` 也核对请求发起时的身份对象（`getCurrentUserId()` 锚点），迟到响应不能撤销注销或覆盖新登录态。这一轮不改身份机制；身份凭据其后（2026-09-22）已从可伪造的 `X-User-Id` 头升级为服务端签发的 HMAC Bearer token，见「登录与「添加人」」一节。

本轮本地验证：`pnpm build`（shared/admin/h5）与 `pnpm typecheck` 通过。真实后端浏览器已验证菜名重复/编辑排除自身、菜品分类新建/行内改名及下拉新增、同组做法选项重复与跨组允许同名、家庭与个人相册各自判重。延迟真实校验响应后快速改名不回显旧错误，校验期间改值/关窗/换账号均不会继续发出旧写请求；延迟真实 `/me` 响应后换账号/注销，旧响应均被丢弃。有效分类连点三次确认，仅发出一次新建并生成一条记录；分类错误态截图已查看，红框与行内提示显示正常。所有本轮分类浏览器夹具已删除，取消提交的名称经 SQL 确认未落库；真实 MySQL 45 例和错误映射 10 例详见后端 README。

独立浏览器会话进一步验证了新增账号昵称/手机号重复提示、个人资料自身昵称/手机号不误判及撞他人昵称拦截、密码本名称与账号双字段联动判重，以及文件分类含首尾空格的重名拦截（回车和确认图标均不能提交）。仅中断判重请求的故障注入验证了网络失败时阻止保存，解除后恢复真实校验；故障注入不计作真实后端响应验证。这组检查未提交有效业务写入，观测到业务写请求为 0，不覆盖这些页面的成功保存流程；未读取密码或调用 reveal，无测试夹具，临时拦截和身份已清除、独立会话已关闭。

## 包结构

```
family-home-web
├── packages/admin    # B 端管理后台，web/h5 响应式一套代码，端口 5173，base=/admin/
├── packages/h5       # C 端 H5，端口 5174，base=/
└── packages/shared   # 跨端共享：axios 封装、TS 类型、hooks、图片转码与 EXIF 提取、菜品默认封面、品牌标识、当前登录账号（./auth）、口令传输层加解密（./crypto）
```

> h5 只引 `@family-home/shared` 的五个纯 TS 子路径（`./image`、`./brand`、`./auth`、`./crypto`、`./format`——最后一个是 2026-09-23 视频页显示文件大小时加的 `formatFileSize`），不引 admin 那套 axios 封装与任何组件库（保持 C 端零构建耦合），接口层是包内原生 fetch 薄封装（`src/utils/request.ts`，各域 api 文件共用）。非 2xx 也要先尝试解析 `Result` 体取 `message` 再抛错——后端业务异常（`GlobalExceptionHandler`）就是 HTTP 400 + Result 体，那句 `message` 才是给用户看的话，只报"HTTP 400"会丢掉它。

## 环境要求

- Node >= 22.12（`engines` 已声明）
- pnpm（workspace 协议，不能用 npm/yarn 装）
- **访问地址必须是 `localhost` 或 https**（2026-09-22 起）：口令加密用的是 `crypto.subtle`，它只在 secure context 暴露。上面那两条 dev 命令给的 `localhost:5173/5174` 天然满足；换成局域网 IP 用 `http://` 打开会**登录不进去**（原因与那句中文提示见「口令的传输层加密」一节）
- 可选构建期变量：`VITE_FH_TRANSPORT_CRYPTO_SALT`（口令传输层加密的盐，**必须与服务端 `fh.transport-crypto.salt` 逐字相同**）。dev 两侧各有同一个默认值，所以正常开发**不需要配它**；只有换生产盐时才配

## 快速开始

```bash
pnpm install

# 先起后端（见 family-home-server README），再按需起前端：
pnpm dev:admin   # http://localhost:5173/admin/
pnpm dev:h5      # http://localhost:5174/

pnpm build       # 按 shared -> admin -> h5 顺序构建
pnpm typecheck   # 全仓类型检查
```

## 开发代理（为什么不用配 CORS）

dev 期靠 Vite proxy 把请求变成同源，后端不需要 CORS：

| 包 | 代理规则 | 转发到 |
| --- | --- | --- |
| admin | `/admin/api/*`、`/admin/files/*`（rewrite 去掉 `/admin` 前缀） | `:8080` 的 `/api/*`、`/files/*` |
| admin | `/files/*`（**原样转发，不 rewrite**） | `:8080` 的 `/files/*` |
| h5 | `/api/*`、`/files/*`（原样转发） | `:8080` |

admin 的 axios `baseURL` 是 `'/admin/'`，与 proxy rewrite 是配套的，**两者缺一不可**；dev 与 prod 用同一个 `base`，路由行为完全一致。生产由 nginx 按路径分发：`/admin/` → admin dist，`/` → h5 dist。

h5 那一条 `/api/*` 是按前缀通配的，所以 2026-09-21 C 端换成 `/api/c/**` 之后**代理一行都不用改**——这也是"路径只在各域的 api 文件里出现、`utils/request.ts` 不存任何 URL"换来的好处。

第二条是补的：后端返回的资源地址是绝对路径 `/files/...`（`url-prefix=/files`），浏览器请求的就是根路径、不带
`/admin`，之前只靠 `/admin/files` 那条 rewrite 是匹配不到的——缩略图/文档链接在 dev 下其实一直 404，只是被浏览器缓存
掩盖了。现在 dev 与 prod（nginx 在根上直接服务 `/files`）行为一致。

## 品牌标识（logo）

**唯一的源是 `packages/shared/src/brand/logo.ts`**：一张 64×64 的 SVG 写成 data URI（`FH_LOGO`），与菜品默认封面同一套做法——不建 `public/`、不塞二进制、不多一条网络请求。图形是"圆角徽牌 + 白色房子 + 心形门"，三个色标全部取自现有主题（`#2f54eb` = admin 的 `colorPrimary`、`#ff5858` = C 端主色、`#8e54e9` = 相册卡渐变），蓝→紫→珊瑚这一条渐变就是"B 端 + C 端合成一个家"；插中间那档紫是因为蓝直连珊瑚中段会发灰。文字"家庭 Home"刻意**不做进 SVG**，两端仍是 HTML 文本，跟着系统字体与主题走。

展示位一共四处，两端各自只有一份实现：

| 位置 | 尺寸 | 说明 |
| --- | --- | --- |
| B 端侧栏（`AdminLayout` 的 `BrandMark`） | 24px | 展开态图形 + 文字；**收起态也留图形**（以前那一栏整条是空的，收起后认不出是哪个系统），24 + 4 + 32 挤进 64px，实测无溢出 |
| B 端 < 992px 顶栏 | 24px | ☰ + 图形 + 文字，与 C 端同一排法 |
| C 端首页品牌位（`.fh-home__brand`） | 44px | 图形在左，标题"家庭 Home"与副标题"我们的小窝"在右；C 端内页顶栏是"返回 + 页名"，不重复放 |
| 两端标签页图标 | 16px | 由 `applyFavicon()` 在 `main.tsx` 里注入同一份常量。**不在 `index.html` 写 `<link rel="icon">`**：那样就得把 SVG 再抄一份，改图形要同步两处；代价是 JS 跑起来前那一瞬是浏览器默认图标 |

`node tools/gen-logo-preview.mjs` 会从 `logo.ts` 里把 SVG 抠出来，生成 `plans/logo-preview.html`（16/24/32/44/64/128 六档 × 白底/页面底色/深色/压渐变，外加 B 端侧栏展开收起、C 端首页、标签页图标的实装示意）。预览页由脚本生成而不是手抄，是为了让它不可能和线上那张图长得不一样。

> 给 `shared` 新增一条导出子路径（这次的 `./brand`）后**要重启 dev server**：Vite 按会话缓存 workspace 包的 `exports` map，不重启那次 import 会 500，报 `Pre-transform error: "./brand" is not exported under the conditions [...]`——页面整片白，看起来像代码写错了。

## 登录与「添加人」（两端）

2026-09-21 加的账号体系。B 端与 C 端走的是同一套 store、同一套请求头注入，只有"露在哪"不同。

- **登录门槛**：两端最外层（`admin/src/App.tsx`、`h5/src/App.tsx`）都先看本机有没有当前账号，没有就只渲染登录页，路由一条都不挂。所以"没选用户先进登录页"这件事不需要每个页面自己判。
- **登录页只有两项**：下拉选账号 + 填这个账号的**密码**（2026-09-21 从"填手机号"改过来的，手机号退成纯资料项），两项都齐了「登录」才可点（与"未选分组就置灰上传"同一口径）。两端形状不同但口径一致：admin 是 antd `Select` + `Input.Password`，h5 是原生 `<select>` + `<input type="password">`。选了账号**刻意不"免输直接进"**——那等于没有登录；手机号印在每个人自己身上，密码只有本人知道，这一项的存在就是为了"全家共用一台平板、随手点到别人名字"时多一道拦。不做验证码、不做"忘记密码"：忘了就在 B 端登进去、到「个人中心」自己改（这一页只有 B 端有）；连原口令都想不起来、登不进去时，只剩"管理员删号重建"这一条路——账号管理那边**没有**"替别人重置口令"，2026-09-21 起那条接口整个下线了（代价见下面 `/user` 那一行）。后端那句中文（`密码与该账号不匹配` / `账号不存在，请重新选择`）原样显示，不翻译成"登录失败"。⚠️ 口令类错误是 **400 不是 401**，因为 HTTP 层一看到 401 就清登录态，那句会告诉用户"该改哪个输入框"的中文会被吞掉。
- **登录一次即可**：登录成功后端在返回体里多给一枚 `token`（服务端 HMAC 签发、7 天有效），前端把**展示对象与令牌分两格存**——`localStorage['fh-current-user']`（`{id,name,role,avatarUrl}`）与 `localStorage['fh-auth-token']`（admin 与 h5 端口不同、各存一份，互不影响）。之后每次请求由 HTTP 层带 `Authorization: Bearer <token>`，不需要"记住我"开关；令牌 7 天到期后任意请求返 401，同样落回登录页重登一次。
- **为什么令牌要和展示对象分开存**：展示对象会被 `/me` 的返回整格覆盖（`refreshMe`），而 `/me` 不带令牌；若把令牌塞进同一个对象，一次开机自校就会把它抹掉。所以 `setCurrentUser` 只动展示对象（且 `normalize` 一遍，即便把带 token 的登录返回体整个丢进来，令牌也不会混进展示缓存），`setAuthToken` 单独管令牌，`clearCurrentUser` 才把两样一起清（只清一个会留下"看着登录了但请求全 401"或"有令牌却显示未登录"的错位）。**令牌是凭据、展示对象不是**：令牌别写进日志、query cache 或任何会被持久化/上报的地方；展示对象里也刻意没有手机号与口令。
- **一份 store，两端共用**：`packages/shared/src/auth`（`@family-home/shared/auth`）是一个模块单例 + `useSyncExternalStore`，导出 `useCurrentUser` / `getCurrentUser` / `setCurrentUser` / `clearCurrentUser`（展示对象），`getAuthToken` / `setAuthToken`（令牌），`getCurrentUserId`（"身份有没有切换"的比对锚点，**不再当请求头送出去**），以及 `AUTH_HEADER`（`'Authorization'`）/ `BEARER_PREFIX`（`'Bearer '`，与后端 `CurrentUserHolder` 逐字对齐）。旧的 `getCurrentUserIdHeader` / `USER_HEADER` 已随 `X-User-Id` 一起删除。展示对象只有 `{id,name,role,avatarUrl}` 四个字段：**口令一个字节都不进**（它只在登录那一次请求里出现、在个人中心那一次提交里出现，而且 2026-09-22 起出门前就已经是传输层密文了，见下面「口令的传输层加密」一节），**手机号也不进**（V502 后连登录都不核对它了，要用的人自己去 `/api/b/user/profile` 取），**令牌也不进这一格**（单独存，见上）。**没有 `isAdmin()` 这种一行的糖**：账号管理的侧栏菜单与页面直接按 `role === 'ADMIN'` 判断，头像下拉三项不判角色；加一层函数只是多一处要 import 的地方；同理也没有 `patchCurrentUser`——"改的就是自己"由 `useUsers.ts` 的 `refreshMe()` 拿服务端现值整格覆盖，比在本地拼 patch 少漏字段。
- **请求头注入**：admin 的 axios 请求拦截器与 h5 的 `request.ts` 都在**每次发请求时**现读本机令牌那一格（`getAuthToken()`），有值就写 `Authorization: Bearer <token>`、无值就不带这个头（不在模块初始化时抓快照——否则切换账号后还得刷新页面才生效）。401（`USER_NOT_LOGIN`，含令牌过期/验不过、以及账号被删后 `/me` 的返回）由 HTTP 层统一处理成"清掉当前账号 + 令牌"，登录门槛下一帧就把页面换回登录页。
- **以服务端为准**：两端进页面各调一次"我是谁"（B 端 `GET /api/b/user/me`、C 端 `GET /api/c/user/me`，同一个 `me()`），用最新的昵称/头像/角色覆盖本机那一格（管理员改了昵称、换了头像，另一台设备刷新就跟上了；**把谁提为超管或降为成员也一样靠这一条生效**，不需要对方重新登录，2026-09-22；后端没起来时保留本机那一格，不把登录态清掉）。
- **当前用户展示位**：B 端在 `components/CurrentUserBlock.tsx`——桌面侧栏底部与窄屏顶栏右侧共用同一组件；点击头像，下拉对所有角色**仅按顺序显示「切换账号 / 个人中心 / 注销」**，不含账号管理。「个人中心」执行 `navigate('/profile')`；「切换账号」与「注销」均沿用 `clearCurrentUser()` 清除本机当前身份，由登录门槛显示登录页，**注销不是删除账号**，不调用删号接口。C 端首页显示头像、昵称与展开箭头；点击展开的下拉仅有「注销」，不含切换账号或个人中心。注销调用 `clearCurrentUser()`，再次打开或刷新都须重新选账号、输入密码登录；旧 `/me` 响应不得恢复已注销的身份。重复点头像、点击外部、焦点移出或 Esc 可收起，Esc 把焦点还给头像。头像为空时用 `shared/image` 的 `resolveUserAvatar` 给默认剪影，不留空圈（与菜品默认封面同一口径）。**2026-09-22 本次验证**：admin 类型检查通过；浏览器实测 ADMIN/MEMBER 下拉均严格为这三项，个人中心跳转、切换账号后重新登录成员、注销后清除本机身份并显示登录页均通过，账号仍保留。窄屏抽屉不含个人中心；桌面分支以 `matchMedia` 临时模拟，展开/收起态头像三项及侧栏无个人中心均通过，测试后已恢复原生断点与原侧栏偏好；未做截图视觉验收。
- **个人中心只有 B 端有**（`/profile` → `pages/user/ProfilePage.tsx`，2026-09-21）：两张卡各带一个「保存」按钮——账号信息（头像 + 昵称 + 手机号）与修改密码（原密码 / 新密码 / 确认新密码）。三点值得记：① **头像下拉的个人中心项对所有角色显示，侧栏不再展示该项**，`/profile` 页面路由保留；服务端那三条 `/api/b/user/profile*` 判的是"有身份"而不是角色，MEMBER 管得了自己；账号管理仍仅在 ADMIN 的侧栏显示，不在头像下拉中；② 昵称/手机号/头像必须现拉 `GET /api/b/user/profile`，本机那一格里刻意没有手机号（见上一条），所以这一页是全站唯一读 `/profile` 的地方，而改名/换头像成功后要 `refreshMe()`，否则侧栏那一格还挂着旧昵称、旧头像；③ 表单拆成 `ProfileForm` / `PasswordForm` 两个子组件、`initialValues` 在挂载时就拿到值（antd 的异步回填不可靠，与 Form.List 那个坑同一类），拉取中渲染一张空 `Card` 而不是禁用一堆字段。改密码成功只 `resetFields()`、**不动任何缓存**——登录态就是一个 id，换口令不需要重新登录。**昵称、手机号、口令、头像这四项在整个产品里只有这一页一个入口**：管理员那一侧对这四项既看不到也改不了（`PUT /api/b/user/{id}` 那条"替别人改"已于 2026-09-21 整条下线，2026-09-22 放回来的只有「角色」那一列，与这四项无关），所以这一页不是"给管理员省事的备份入口"，而是唯一入口。**头像的自助换头像入口就在这一页**（2026-09-23 加，此前头像只在建号那一刻由管理员定、之后无处可改）：账号信息卡顶部一行「头像」——`Avatar` 预览 + 「更换头像」按钮，选完文件先过 `shared/image` 的 `compressImage`（canvas→JPEG，避免 HEIC 撞 415，与新增账号/相册/菜谱封面同一条路）再 `uploadAvatar(file)`（`POST /api/b/file/upload`，`bizType=USER_AVATAR`）拿 `id`，**头像放组件 `useState`（不进 antd Form values）**：初值取自 `profile.avatarFileId`/`avatarUrl`，上传后换成新文件的 id 与预览地址，点「保存」时随 `{name,phone,avatarFileId}` 一起发 `PUT /api/b/user/profile`。放 state 而不是 Form values 是为了避开 `FormModal` 那套外壳"取消后残留上一次上传 id"的坑（与新增账号弹窗同一条经验）。后端 `updateById` 对 null 列跳过（NOT_NULL 策略），所以这条**只能换头像、清不掉**：没传新的就保持原样，想恢复默认剪影两端都没有入口。管理员建号时仍先定一张（账号管理的新建弹窗），那是管理员唯一能替别人定的资料字段，建完之后就归本人自己换。**这一页同样没有"我是超管吗"这一格**——角色由别的管理员在账号管理页定，自己要看只能看侧栏那个 Tag。
- **「添加人」/「下单人」怎么显示**：后端只给 `creatorId`，昵称现查 `{id,name}` 那本字典（**两端各一条路径、同一个 `options()`、同一个 VO**：admin `GET /api/b/user/options`、h5 `GET /api/c/user/options`；admin `features/user/useUsers.ts` 的 `useUserOptions`，h5 `utils/userNames.ts` 的模块级缓存 + `useUserNames`）。三条渲染规则：字典里查不到（账号已删）显示"已删除账号"；`creatorId` 为 NULL 整段不渲染（不放 `-` 占位）；字典还没到也先不渲染，避免"已删除账号"闪一下。B 端七处（相册分组 / 相册图片 / 菜谱 / 分类 / 点单列表 / 文件 / 密码本）+ C 端四处（**购物车抽屉与确认订单页按加购人分模块**（2026-09-23 加：一人一个模块、模块头 = 昵称 + 该人份数合计、行内不再挂名字；读的是购物车条目上的 `creatorId`，即"谁把这道菜加进车的"；`creatorId` 为 NULL 的那一组与字典未到的那一刻都不渲染模块头）、订单列表合计行、订单详情摘要条）。**不为这一列做任何跨域 join 接口**。⚠️ h5 这两处拿到的字典是 `Map<number,string>`，取值必须 `userNames.get(id)`——写成 `userNames[id]` 永远 undefined、那一格静默不渲染。
- **两端各打各的前缀（2026-09-21 起）**：h5 运行时**不再打任何 `/api/b/**`**（`packages/h5/src` 里那几处命中全是注释）。C 端那一半在服务端是独立的 `controller/c/` 类，路径与返回体按 C 端页面裁剪，Java 层仍共用同一套 service。两件事值得记住：① 路径只写在 `packages/h5/src/api/*.ts` 里，`utils/request.ts` 不存任何 URL，换前缀不动封装；② "C 端只读"这个前提已经没了——`/api/c/**` 现在带着上传、绑图、购物车、下单、状态推进这一串**写**接口，部署层的放行规则要按这个重想（方案 §8.3）。
- ⚠️ **shared 每加一个 `exports` 子路径，两个 dev server 都得重启**（`./auth` 是 2026-09-21 那次，`./crypto` 是 2026-09-22 那次）：Vite 对 workspace 包 `package.json#exports` 的解析在启动时固定，只重启其中一个会出现"一边能 import、另一边 500"。

## 口令的传输层加密（2026-09-22 起）

用户口径"所有的密码加解密都通过一个盐、前后端都要"落在**传输段**：页面照常收集用户敲进去的那一串，**api 层出门前加密**，服务端在业务入口解回明文后走原来的存储口径（登录仍是 PBKDF2 哈希、密码本仍是那把 vault 密钥的 AES-256-GCM）。**端到端这次做不到、也不是目标**：`login()` 必须拿到明文才能算哈希，reveal 必须把明文还给人看，硬做成端到端等于把这两条功能拆掉。

- **实现只有一处**：`packages/shared/src/crypto/transport.ts`（`@family-home/shared/crypto`）。导出两个 async 函数 `encryptPassword(plain)` / `decryptPassword(cipher)`，底层是 `crypto.subtle` 的 PBKDF2 + AES-GCM，**零新增依赖**。派生出来的密钥按 Promise 缓存一份（`derivedKey`）：十万轮 PBKDF2 在浏览器里是个位数毫秒，但没必要每次提交口令都重跑一遍。
- **调用点只在 api 层，共三处文件、五个出入口**：`packages/admin/src/api/user.ts`（B 端登录 + 个人中心改口令的两格）、`packages/admin/src/api/vault.ts`（密码本新建/编辑 + reveal 的**反方向解密**）、`packages/h5/src/api/user.ts`（C 端登录）。**页面与组件里一行加解密都没有**——理由与"URL 只写在 api 文件里"同一类：全站口令出入口就这五处，它们本来就都在 api 层收口了，再多包一层 hook 只会多一处要 import 的地方。
- **线上形状**：`base64(12 字节随机 IV ‖ AES-256-GCM 密文 + 128 bit tag)`，密钥 = PBKDF2-HMAC-SHA256(盐, 盐, **10 万轮**) 取 256 bit——**盐串的 UTF-8 字节同时当 PBKDF2 的口令材料与 salt**（与服务端 `deriveKey` 一致，这是三处实现能对上字的唯一前提）。轮数 / IV 长度 / tag 长度三个常量在 TS 与 Java 两侧各写一份，**改一侧必须改另一侧**，否则对面只得到一句"解不开"。密文比明文长（14 个字符的明文 → 42 字节 → 56 个 base64 字符），所以别按明文长度估请求体大小，也**别在前端做任何"口令长度"以外的校验**。
- **盐从哪来**：构建期环境变量 `VITE_FH_TRANSPORT_CRYPTO_SALT`；没配就用 `DEV_TRANSPORT_SALT`（与后端 `application-dev.yml` 里那个默认值**一字相同**，所以 `pnpm dev` 开箱即用，不需要建 `.env`，也不要在 dev 下拿它当"秘密"——它随 bundle 公开）。要换就得两侧同时换：只换一侧的表现是登录弹"口令无法解密，请刷新页面后重试（前后端加密参数不一致）"，而**不是**"密码与该账号不匹配"——这两句分开就是留给这种配置的。盐**不要带首尾空格、不要用非 ASCII**：两端都会先 `trim()`，非 ASCII 时两侧的 PBKDF2 输入字节可能分叉，所以 `transport.ts` 对这两种情况直接抛中文错（配置期就炸，别等登录时）。
- ⚠️ **页面必须在 https 或 localhost 下打开**：`crypto.subtle` 只在 secure context 暴露。`http://192.168.x.x:5173` 这种 vite 局域网地址**会登不进去**——`requireSubtle()` 抛"当前环境不支持 Web Crypto（crypto.subtle 不可用），口令无法加密。请通过 https 或 localhost 访问本页面"，那句中文原样出现在登录页的红字里。这是刻意选的：宁可给一句能看懂的中文，也不要"静默退回明文"（那会让人以为加密还在生效）。生产部署因此必须上 https，与后端 README「配置说明」那条 ⚠️ 是同一件事。
- **它不是访问控制**：那串盐随构建产物公开，能打开页面的人就拥有解开密文所需的一切。这一层挡的是"Network 面板 / nginx access log / 局域网顺手抓包里出现明文"，**不挡有意调接口的人**——别因为"reveal 现在返回密文"就以为密码本变安全了（服务端现在校验登录身份、分区及属主，而身份自 2026-09-22 起由服务端签发的 HMAC Bearer token 决定，不再是可伪造的 `X-User-Id` 头）。同理，日志口径没有放松：**密文进日志等于凭据进日志**，前端不把密文写进任何 `localStorage` 或 query cache；登录令牌是另一码事——它本身就是凭据，只存 `fh-auth-token` 那一格，同样不得进日志或 query cache。
- `decryptPassword` 目前**只有一个使用方**（reveal 那一格）。登录、改口令、新建/编辑条目都是单向加密，没有反解需求，所以两端页面代码里不会出现"解密"字样，这是正常的而不是漏了一半。

## 页面与路由

密码本和文件管理各有公共、私人两个子菜单；历史数据在公共页，私人页按当前账号隔离，文件分类也不混用。两域 queryKey 包含 scope/userId，切换后重挂页面，清除筛选、弹窗和密码明文；异步回调校验发起身份与页面会话。私人下载走带身份头的 Blob 请求，临时 objectURL 用后释放；文档仍为单文件上传，固定发起身份，切换账号或关闭弹窗后旧响应不回填。首页仍是六张卡，其中文件和密码卡只统计公共数据、跳公共子路由。视频管理（2026-09-23）沿用同一套公共/私人分区口径（`/video/public`、`/video/private`，queryKey `['video']` + `scope`，切分区 `key` 重挂），但播放不走静态 URL 也不走 Blob 下载，而是服务端签发的 6h 短时票据流（`<video src>` 带不上 `Authorization` 头），播放器为 xgplayer 3.0.26。**C 端（h5）2026-09-23 起也能看视频**：首页加「家庭视频 / 私人视频」两入口，路由 `/video`、`/video/personal` 复用同一个 scope 参数化的 `VideoPage`，读只读接口 `GET /api/c/video`，播放用**原生 `<video controls playsInline>`**（h5 一贯手写 `fh-*`、不引组件库，故不用 admin 那套 xgplayer），票据流与 B 端同一套（票据与路径无关）。C 端只能看不能传/删，详见下面 h5 路由表。

admin（`/` 直接就是首页，不再重定向到某个模块页）：

| 路由 | 页面 |
| --- | --- |
| `/`、`/home` | 首页：六个总览卡（相册图片 / 菜品 / 待制作 / 累计份数 / 文档 / 密码本，每张带一行分解小字，整张点进对应模块）+ 最近点单前 5 条、热门菜品前 5 道。数字全部现查各模块自己的列表接口（分页只取 1 条、读 `total`），**没有为首页新增后端接口**，所以这里的数和点进去看到的条数一定对得上；"待制作"卡的小字"共 N 单"与点单列表页脚同一个 `total`；"待制作"非零时数字着橙色（首页唯一"有事要做"的数）。2026-09-21 点单列表改成服务端分页后，首页这两个数各走一次 `useOrders`："待制作"= `{status:'PENDING', pageSize:1}` 只读 `total`（**不再是从拉回的数组里 filter 计数**——那样只会数到第一页），"最近点单"= `{pageSize:5}` 直接用 `list`（后端已按最近在前排好，所以这一列就是最新 5 单）。2026-09-21 点单统计也分页后，"累计份数"卡与"热门菜品"表共走一次 `useOrderStatistics({pageNo:1, pageSize:100})`：接口上限就是 100，而首页要的是**全部**菜品的份数之和与前 5 名，从一页里求和/截取的只是这一页——家庭量级被点过的菜品远不到 100 道，后端又已按份数倒序，所以前 5 条即热门榜（与点单统计页第 1 页头部同源同行）。订单状态文案/颜色与点单列表共用 `features/recipe/orderStatus.ts` |
| `/album/groups` | **家庭相册**的分组列表（`<GroupListPage scope="FAMILY" />`，拖拽排序；「个人相册」那一页共用这一份实现，差别见下一行。2026-09-22 前这一页是"全部相册"，`scope` 一列出来之后它只管家庭那一档，个人相册不再混在这排卡片里）。每张卡上的"共 x 张"和封面都走 `album_image_group_rel` + 只算在架图，与 C 端封面卡片、图片网格的分组筛选（EXISTS 子查询）同一口径——`album_image` 上那个遗留的 `group_id` 列已经由 `V207` 删掉，归属只有关联表一处答案。**每张卡标签排的第一枚是整本相册的上下架开关**（`features/album/AlbumGroupStatusSwitch`，2026-09-20 补）：与图片卡那枚同一口径（默认尺寸 `Switch`、"上架/下架"字样、mutation 挂在每张卡片自己身上所以 `loading` 只转被点的那一枚），发的仍是 `PUT /groups/{id}`，只带 `{ status }`、名字不动（"重命名"反过来只带 `{ name }`、状态不动）。**下架只是让这本相册在 C 端消失**：B 端这张卡照旧在（列表只排 `DELETED`），点进去照样看图、改图、继续上传，图片一行都不动，也不会因为它下架就漏进"其他"。开关排在卡片操作区第一枚，然后是重命名、删除（`AlbumGroupActions`）。弹窗那条路同一天修了一处：`AlbumGroupFormModal` 的 `onSubmit` 原先只 fire mutation 不关窗，窗口一直开着，再点另一张卡片的"重命名"时外壳 `FormModal` 的重置 effect（只依赖 `open`）不重跑，输入框里还是上一个名字——改成 `await mutateAsync` + 成功才 `onClose`，与 `VaultAccountFormModal`（`onSettledSuccess: onClose`）、`UploadDocumentModal`（await 后 close）同口径。**新建/重命名弹窗里没有"家庭还是个人"这一格**：`AlbumGroupFormModal` 多收一个 `scope`，值由"这是哪一页"定死（这一页 → `FAMILY`），新建时随 `{ name, scope }` 发出去，重命名只发 `{ name }`——`scope` 建出来就定死，服务端那条 `PUT` 收不到这一列，想换档只能删了重建（把一本私人相册改成家庭相册，等于顺手把它推到全家面前） |
| `/album/personal/groups`、`/album/personal/:groupId` | **个人相册的分组列表 / 组内图片**（v14）：与家庭档复用 `GroupListPage` / `ImageGridPage`，传 `scope="PERSONAL"`，标题、新建、排序、编辑、删除及上传都限定当前账号分区。分组属主由服务端取当前账号，不由前端指定；读图和裸 ID 操作也必须带 scope，跨区/跨属主 404，不再仅靠「标题查不到」兜底。私人分组卡**仍不显示上下架开关**，C 端仍只看其上架图/组。图片不跨家庭/个人或个人账号共行、关联，城市及分组候选也不混用 |
| `/album/personal` | **B 端旧入口重定向**至 `/album/personal/groups`；H5 同名私人入口仍是列表，不做此重定向 |
| `/album/personal/images` | **当前账号的图片管理**：与家庭图片页复用组件，但筛选、编辑、上传候选、批量操作均带 PERSONAL，不能混入家庭或其他账号数据 |
| `/album/personal/distribution` | **当前账号的图片分布**：复用城市地图，城市及点位图片均按 PERSONAL/当前账号读取 |
| `/album/images`、`/album/:groupId` | **家庭图片管理 / 家庭分组图片网格**（FAMILY）：上传、置顶、上下架、城市编辑、同分区多组关联及批量删除。详情标题从当前 scope 的分组列表取，无单独详情接口。B 端仍可管下架图/组，C 端只读上架。图片管理上传必须多选至少一个本分区分组；详情传 fixedGroupId，隐藏选择器并固定绑定当前组。上传、筛选、编辑分组/城市候选与新增分组均使用页面 scope，**不再合并家庭与个人候选，也不再固定只建家庭组**。新建 scope 随 body，其他 album 调用随 query；编辑城市与状态分别提交，关联用 `PUT /images/{id}/groups` 整组覆盖。批删 body 为 `{ids:[...]}`，服务端先验全部 ID；整组覆盖也须先验图片与全部目标组，禁止跨区。组内 md5 重复会提示跳过，新 file 必须本人上传，另一 scope 已用 fileId 要重传；同分区可复用 image，跨区不可复用 |
| `/album/distribution` | **家庭图片分布**（ECharts）：只读 FAMILY 的城市及点位图片，个人数据不计入 |
| `/recipe`、`/recipe/new`、`/recipe/:id/edit` | 菜谱列表（列：封面 / 菜名 / 菜品分类 / 状态 / 修改时间 / 操作。**上下架就放在"状态"这一列**，是一个默认尺寸的 `Switch`，里面带"上架/下架"字样，状态列不再有绿 Tag——同一个状态两处各说一遍没意义；也不用 `size="small"`，16px 高塞两个字会被挤扁，这正是它先前难看的原因。操作列因此只剩"编辑 / 删除"）/ 新建 / 编辑（新建时分类必填、状态默认就是"上架"——常态是上架，C 端只展示上架的菜，Switch 关着进页面等于每建一道都先下架一次）。分类下拉里那个"未分类"**不是一个可选项**：只有这道菜当前确实没分类时才出现（删分类时服务端会先解绑菜品），disabled、纯展示，也没有清除按钮——反过来的"把菜改成未分类"服务端做不到（`updateRecipe` 只在 `categoryId` 非 null 时覆盖关联行，传 null = 不动），做不到的事不在前端给入口。哨兵值 `__NONE__` 而不是 `null`：rc-select 会对 `value: null` 的选项打告警。"可选做法"勾了哪个分组，下面就跟一个分组卡片：组名 + 必选开关 + 一行"默认选中"的选项 Checkbox。默认选中**只能有一个**：勾上某个后其余自动置灰，想换就先把当前这个取消勾选（置灰而不是隐藏，一眼能看出为什么点不动）；一个都没勾 = `defaultOptionId=null` = 不预选，所以行尾不需要"不预选"这一项。勾掉分组这个卡片就消失。配置存在关联行上、跟菜谱一起整体覆盖保存，**不在字典上**——同一个"辣度"分组，A 菜可以设成必选默认微辣，B 菜可以设成不预选。组内没选项时必选开关置灰（没有可选项，勾了必选就是把这道菜钉死），"默认选中"那一行整个不渲染。"菜品图片"选完文件先过 `shared/image` 的 `compressImage` 再上传（和相册同一条路）：直传原文件时 iPhone 的 HEIC 会被后端 mime 白名单以 415 打回，而且相册里存的都是转码后的图，这边再存原图就是同一份能力两套体积）。**菜没配图时封面列不再空着**（2026-09-21）：这一格一律渲染 `<img>`，src 走 `shared/image` 的 `resolveRecipeCover(coverUrl)`——有图用图，没图用那张默认封面（`DEFAULT_RECIPE_COVER`，一张 SVG data URI，两端同一份），原先这里是个 `-`。**编辑页反过来不给默认图**：那块是上传器，摆一张看着像"已有封面"的图会让人以为已经传过了 |
| `/recipe/categories` | 分类管理（一行一个分类：拖拽把手 / 分类名称 / 排序权重 / 关联菜品 / 操作）。**关联菜品只数未删除的菜**（删菜是软删，`recipe_category_rel` 关联行留着，直接 `count(*)` 会大于菜谱列表页的条数；下架仍算）——和做法管理那一列同一口径、同一段实现。**没有"编辑"这一步**：点名称就地变输入框，回车或失焦保存，空名、与原名相同、与别的分类重名都在前端挡下不发请求（输入时异步预检并在字段下显示重名错误，编辑保留输入；后端唯一索引并发冲突也返回 409 中文提示）。新建走 Modal、默认权重排最后；顺序靠**行首那个把手**拖，拖完按 1..n 重排权重（权重即 C 端菜单顺序）——dnd-kit 的 `listeners` 只能挂在把手上，挂在整行 `<tr>` 上会在 pointerdown 就把事件吃掉，行里任何点击都点不动 |
| `/recipe/orders` | 点单列表（订单快照：订单号 / 状态（待制作橙、已完成绿、已取消灰）/ 菜品明细含做法摘要 / 份数 / 下单时间，最近在前）。**分页与筛选都在服务端**（2026-09-21 改，原先是整表拉回前端切 20 行）：表头上方一个 `Search`（占位"搜索菜名"，命中后端 `keyword`，按明细里的菜名快照模糊匹配）+ 一个"状态"下拉（三个状态都列，`allowClear`）；任一格变动就把页码退回 1，`useOrders({keyword,status,pageNo,pageSize})` 的 queryKey 带整个 query，所以翻页/换筛选各占一份缓存、`invalidateQueries({queryKey: ORDERS_KEY})` 仍能一把刷新所有页。分页器 `showSizeChanger` + `showTotal`（"共 N 单"）。原来工具栏那句"共 N 单，合计 M 份"删掉了——分页后前端手里只有一页，那个合计看起来像全局数其实是本页和；筛完没结果时空态文案是"没有符合条件的订单"，跟真正一单都没有的"还没有订单，去 C 端点一单吧"分开。明细只由 C 端在待制作期间改（继续加菜），这一页只管状态和"要不要留着"：**待制作行给"标记已完成"+"取消订单"**（后者危险色，不给删除——还没做完的单要它消失该走取消那一档）；**已完成行与已取消行给"删除"**（危险色 + `Popconfirm` 二次确认，确认文案点明整单连同明细一起删掉、点单统计跟着少这一单、无法恢复；两档都是定稿，改状态没有撤回入口，只能再下一单）。状态不在字典里的行一个按钮都不给（点了也是后端不认的值）。删除走 `DELETE /api/b/recipe/orders/{id}`，成功后 `ORDERS_KEY` 与 `ORDER_STAT_KEY` 一起失效重拉——这一单的份数从统计与 C 端"点过 x 次"里消失；后端另有 `status != PENDING` 条件删除兜底，C 端不提供删除入口 |
| `/recipe/practices` | 做法管理（一行一个分组：分组名称 / 关联菜品数量 / 选项 / 操作）。**不排序**（后端按录入顺序返回，也没有 sort_order 列了），**也没有编辑弹窗**——和分类页同一套口径：点组名或某个选项的名字就地变输入框，回车或失焦保存；选项都带 x，点 x 删掉那一个；选项最后那个虚线 + 点开是一个输入框，填名字回车即新增。三种改动都发同一个 `PUT /practices/{id}`（组名 + 整组选项；已有选项带着自己的 id 回传，所以改名不换 optionId，购物车和订单快照里选好的做法不失效，被 x 删掉的选项则按 C 端"查不到就忽略"处理）。空名、与原名相同、组内重名都在前端挡下不发请求；"新建分组"只填组名，选项建完到那一行里加。关联菜品数量 = 这组被几道**未删除**的菜勾了（下架仍算） |
| `/recipe/statistics` | 点单统计（首列是**封面** 80×80，2026-09-21 加：`coverUrl` 是菜品**当前**图、不是各笔订单的 `cover_url` 快照，没配图照样走 `resolveRecipeCover` 给默认封面，与菜品列表那一列同一口径。下面是每个菜品的累计下单份数 + 各做法选项分别被点了多少份，形如"不辣 ×4 · 微辣 ×1"，只读，菜品行与做法档都已由后端按份数倒序）。**分页与筛选都在服务端**（2026-09-21 改，原先一次列出所有被点过的菜品）：表格上方只有一个 `Search`（占位"搜索菜名"，命中后端 `keyword`，筛的是**聚合出来的那一行菜名快照**，不是菜谱现名）；`useOrderStatistics({keyword,pageNo,pageSize})` 的 queryKey 带整个 query，`ORDER_STAT_KEY` 收成前缀供 `useOrderMutations` 删除订单后一把刷新所有页。分页器 `showSizeChanger` + `showTotal`（"N 个菜品被点过"，这个 N 是**筛完的行数**，与点单列表那句"共 N 单"同形态）。原先工具栏那句"N 个菜品被点过，合计 M 份"删了——分页后前端手里只有一页，那个合计看着像全局其实是本页和（与点单列表那一轮同一取舍）。**翻页不会看到份数变小**：服务端始终对全量明细聚合完再排序/筛选/切片，每行那份数仍是这道菜的全历史累计。筛完没结果空态"没有符合条件的菜品"，与真正一单都没有的"还没有订单，去 C 端点一单吧"分开。做法只回 `{groupId, optionId, qty}`，名字现查字典、和点单列表同一份 `practiceSummary.ts`；字典里已删除的那一档跳过，这道菜没被点过做法就留白（不填 `-`） |
| `/file/public`、`/file/private` | 公共文件 / 私人文件，共用文件管理页，分类候选、列表、上传和删除均带 `scope=PUBLIC/PRIVATE`。不限格式、分类必选；公共文件名打开静态链接，私人文件通过带身份头的下载接口取 Blob，不返回静态 URL。旧 `/file` 重定向公共文件 |
| `/vault/public`、`/vault/private` | 公共密码 / 私人密码，共用密码本页，列表、创建、编辑、删除、reveal 均带 `scope=PUBLIC/PRIVATE`；旧 `/vault` 重定向公共密码。加解密仍在 API 层，明文只短暂存在组件 state，关窗/换记录/切分区/切账号后迟到响应失效 |
| `/video/public`、`/video/private` | **视频管理**（2026-09-23 加）：公共视频 / 个人视频，共用 `pages/video/VideoListPage.tsx`（`scope` prop），列表/上传/删除均带 `scope=PUBLIC/PRIVATE`，旧 `/video` 重定向公共页，`key={dataKey(scope)}` 切分区重挂。**播放器 xgplayer 3.0.26**（`features/video/VideoPlayer.tsx` 手写 ref+effect 封装，官方 React 包停在 2.x 不兼容 React 19）：开箱倍速（0.5~3x）、快进（进度条拖 + 键盘 ←/→ 5s）、全屏/网页全屏/画中画、断点续播；**选集**由 `VideoPlayerModal.tsx`（width 960）拿视频列表当播放列表实现（右侧列表 + 上一支/下一支取模 + "N / M"）；**清晰度是能力在、无可切**——播放器支持多码率，但单支上传的 MP4 没有第二档码流（没做转码），控制栏不出现清晰度选择。播放地址 `playUrl` 是服务端签发的 6h 短时票据流（`/api/b/video/{id}/stream?ticket=`），`resolvePlayUrl` 拼上 base（`/admin`）后塞进 `<video src>`——**视频不走静态 URL**，因为 `<video>` 带不上 `Authorization` 头。上传 `UploadVideoModal.tsx`（`accept="video/*"` + `Progress` + `useValidationSession`，`uploadVideo` 带 `onUploadProgress`、`timeout:0`）。**路由刻意用单数 `/video`**（静态前缀是 `/files`，且播放走 `/admin/api` 代理，不冲突）。**H5 没有视频页**——整个域只挂 B 端 |
| `/profile` | **个人中心**（2026-09-21 加，所有人可见，包括 MEMBER）。两张卡：账号信息（头像 + 昵称 + 手机号）与修改密码（原密码 / 新密码 / 确认新密码），各带一个「保存」。头像那一行是「更换头像」按钮 + 预览（2026-09-23 加的自助换头像，走 `PUT /api/b/user/profile` 的 `avatarFileId`，能换、清不掉）。细节见上面「登录与添加人」里那条 |
| `/user` | 账号管理（**只有 ADMIN 看得到的这一页**，2026-09-21；2026-09-22 起这一页还能设超管）。列表：头像 / 昵称 / 手机号 / 角色 / 添加时间 / 操作，整表返回不分页、不搜索（全家就这几个人）。表头上方一个"共 N 个账号"。**这一页有三个动作：加人、删人、定谁是超管**：操作列只有一个「删除」（**自己那一行不给删除**，后端也会挡，这里直接不摆按钮），没有"编辑"、也没有任何一行显示口令——`UserAdminVO` 里就没有那个字段，后端那一列还标了 `@TableField(select=false)`，**管理员连查都查不出来**。「角色」列（2026-09-22）用的是相册那套"开关就是状态"口径：别人那一行是一枚 `<Switch checkedChildren="超管" unCheckedChildren="成员">`（`features/user/UserRoleSwitch.tsx`），**自己那一行仍是一枚只读 Tag**（`RoleTag`），因为后端会挡"改自己"，摆一枚点得动却必 403 的开关不如不摆；开关不放 `size="small"`（中文两字会被挤扁，与相册分组那列同一结论），mutation 在组件内部按行实例化，所以只有点下去的那一枚转圈，整列不会一起闪。它调的是 `PUT /api/b/user/{id}/role`——**只写这一列，昵称/手机号/口令照样一格都碰不到**，`api/user.ts` 里也照样没有 `updateUser`。宽屏 Table 与窄屏卡片共用同一个 `renderRole(record)`，两个断点长得不一样但判据一样。新建只有 `features/user/UserCreateModal.tsx` 一个弹窗（原 `UserFormModal.tsx` 连同它的"编辑"形态一起删了）：头像 + 昵称 + 手机号三样，**没有密码格**，**也没有"角色"这一项**（新建恒为 MEMBER；提权是建完之后在列表那一行另点一下的事，不放在建号弹窗里——两个动作各管各的，弹窗也不必为"管理员"这种少数情况多摆一格）。初始口令在服务端固定为 `123456`，前端不收也不显示，只在保存成功那句 toast 里带一次（"账号已创建，初始密码 123456"）——那是管理员唯一"知道"的口令，而且是常量不是别人设过的秘密。头像是"选完立刻传到 `/api/b/file/upload` 拿 id、点保存才写进账号"，**这是管理员唯一能替别人定的资料字段，且只在建号那一刻**：建完之后管理员就改不了它了，但本人可去个人中心自己换（2026-09-23 起 `PUT /api/b/user/profile` 也收 `avatarFileId`，见上面 `/profile` 那条）；建号时不选就先是默认剪影，之后同样只能本人去个人中心补上。非 ADMIN 直接敲 URL 时这一页渲染 `Result status="403"`（"只有管理员能管理账号"），**不能省**：`useUsers(false)` 只是不发请求，少了这一屏页面会是一张空表，看着像"还没有账号"。真正的判据在服务端（账号管理那四条接口每个都 `requireAdmin()`，个人中心那三条只 `requireUserId()`），这里的菜单隐藏与 403 屏都只是体验。**被改角色的那个人不需要重新登录**：本机那一格的 `role` 由 `refreshMe()` 覆盖，下一次"以服务端为准"的自校就会把菜单换过来（实测：把已是 ADMIN 的账号本机缓存写成 MEMBER，`/me` 回来后「账号管理」菜单自己出现） |

左侧一级菜单是**首页 / 菜谱 / 点单管理 / 家庭相册 / 个人相册 / 文件管理 / 视频管理 / 密码本**（2026-09-22 按用户要求把菜谱、点单管理两组排到家庭相册之前，纯展示顺序，key 与路由都不变；2026-09-23 在文件管理与密码本之间插入「视频管理」`PlaySquareOutlined`，下设公共视频 / 个人视频）；家庭与个人相册平级，子项均按**图片管理 / 相册分组 / 图片分布**排序。最后追加的
**账号管理只对 `ADMIN` 渲染**（`AdminLayout` 按当前账号角色判断，桌面侧栏与窄屏抽屉同一口径），**不出现在头像下拉中**。
**侧栏不再展示个人中心**，`/profile` 页面路由保留，所有角色仍可用；统一从 `CurrentUserBlock` 头像下拉的第二项进入。
头像下拉对所有角色固定且仅有**切换账号 / 个人中心 / 注销**三项，桌面与窄屏共用该组件；切换账号和注销都只清本地身份回登录页，不删除账号。
首页菜单项指向
`/home` 而不是 `/`：react-router 在 `basename="/admin"` 下 `navigate('/')` 写出来的地址是 `/admin`（**没有**
结尾斜杠），这个 URL 刷新会掉进 vite base 提示页、prod 的 `location /admin/` 也匹配不到；`/` 只留作直接访问的
入口（带斜杠，刷新没问题），两处都渲染同一个 `HomePage`。404 页那个按钮同理从"回到相册"（指向根本不存在的
`/album`，点了还是 404）改成"回到首页"。文件管理下有「公共文件 / 私人文件」，密码本下有「公共密码 / 私人密码」，均公共在前。
**路由刻意用单数 `/file`**：静态资源前缀是 `/files`，页面路由若也叫
`/files`，在 dev 下会被 vite proxy 抢先匹配（`/admin/files` → 后端文件目录）而进不了 SPA。点单管理下三项（点单列表、
点单统计、做法管理）**URL 仍留在 `/recipe/*`**——路径跟数据域走，菜单只管分组，调整分组不动路由（`AdminLayout`
里的 `ORDER_PATHS` 是这份映射的唯一出处）。admin 挂在 `/admin` base 下，所以点单列表实际是 `/admin/recipe/orders`，与 h5 同名的"我的订单"页不冲突。
**v14 两套相册菜单/路由**：FAMILY 为 `/album/{groups,images,distribution,:groupId}`，PERSONAL 为 `/album/personal/{groups,images,distribution,:groupId}`；B 端旧 `/album/personal` 重定向至 `/album/personal/groups`。菜单选择与展开先识别个人路径，再识别家庭路径，各详情回到自己的分组菜单；不能再将个人相册作为家庭相册的子项。

**分区上下文与缓存**：相册 query cache 使用 `['album', scope, userId, ...]`，分组、图片、城市及关联候选都纳入 scope/当前账号；路由或账号切换重挂相册页面，清掉筛选、分页、多选、编辑/上传浮层与预览状态，不能沿用上一分区的缓存或表单。当前账号由身份 store 提供，不允许在个人页选别人的 owner。H5 沿用 fetch/state，页面同样在 scope/账号/groupId 变化时重挂或重置，不新增一套全局混合缓存。

侧栏（仅 ≥992px 那一档）右上角有一个折叠按钮，一键把整条菜单收成 64px 的**图标窄栏**、再点回 208px，收起后内容区变宽，
菜谱列表那种宽表格看着松快些。各一级项都提供 `icon`——收起态只剩图标可点，没图标的一级项会渲染成一片空白；
二级项刻意不加，收起态下它们是 hover 出来的浮层，靠文字就能认。状态存本机 `localStorage` 的 `admin-menu-collapsed`
（`'1'` = 收起，读写都包在 `try/catch` 里，隐私模式下只是记不住），和点餐页的列数偏好同一类：这是"这台设备看着舒不舒服"，
不进后端。三个实现要点：① `Sider` 只传 `collapsed` + `trigger={null}`，不用 antd 自带那条底部横栏（`trigger` 渲染条件是
`collapsible`，所以连 `collapsible` 都不必开）；② `Menu` 靠 `SiderContext.siderCollapsed` 自动切 `ant-menu-inline-collapsed`，
不需要显式写 `inlineCollapsed`；③ 窄屏那档不受影响，收起/展开按钮只在 Sider 分支渲染，Drawer 里点菜单项本来就自动关。

h5：

**共享购物车与轮询（2026-09-22）**：点餐、确认订单、订单详情首屏立即读，此后每次读完成后 3 秒再读；页面隐藏暂停后续轮询，重新可见或获得焦点立即读，离开路由后的响应丢弃。点餐页的 `useSharedCart` 统一持有 `{version,items}`，写入带所见版本，一次只允许一个写请求，旧 GET 不能覆盖新写；冲突后回读，不重放绝对值数量。确认页普通下单与继续加菜都只提交 `{version}`，并轮询加菜目标状态；完成/取消后按钮禁用。网络或 5xx 结果未知时保留原提交版本，显示「重试确认」，不把下一车误提交；该重试上下文只保留在当前页内存，不跨整页刷新。详情轮询状态、明细和总份数，404 清掉旧订单；订单列表与菜品「点过次数」本轮不加轮询。

**本地验证**：H5 类型检查和生产构建通过；浏览器验证第二账号改车/下单、旧版本编辑冲突恢复、延迟 GET 不覆盖新写、丢响应后同版重试且不消费新车、加菜明细刷新、B 端改状态以及删除后详情识别。前台真实计时观察约 3 秒，隐藏/恢复分支使用临时 visibility 模拟；详情截图已检查。测试后页面重载，临时 fetch/visibility 注入不再存在。测试购物车已空，但清理测试订单被自动模式拦截，#38（已完成，8 份）、#40（待制作，7 份）仍待清理；未改动原有 10 单。

| 路由 | 页面 |
| --- | --- |
| （无路由）登录页 | 本机没有当前账号时 `App.tsx` 只渲染 `pages/LoginPage.tsx` 这一屏，走到哪儿都先回到这里。形状就是需求那两项：原生 `<select>` 选账号 + `<input type="password">` 填密码（`autoComplete="current-password"`），两项都齐才让点，失败把后端那句中文原样显示。密码**不 trim**、不做前端长度校验，与 B 端登录同一口径（见上面「登录页只有两项」）；它由 `api/user.ts` 在出门前加密成传输层密文，页面这一侧一行加解密都没有（见「口令的传输层加密」一节）。账号列表拉不到时空下拉 + 按钮一直禁用（这一步没有别的可做，比给一个"能点但必失败"的按钮诚实，也不给家里人红字吓唬）。登录成功把展示对象与令牌写进本机（`fh-current-user` + `fh-auth-token`）后直接进首页，以后打开默认就是这个账号。**没有"忘记密码"入口**：C 端连个人中心都没有，改口令得到 B 端登录后自己去「个人中心」（两端只有这一页能改，管理员那边没有"替别人重置"这条路）；登不进去就只能请管理员删号重建。**刻意不做账号体系相关的路由**：注销清掉本机 localStorage 身份与令牌，由 `App` 登录门槛直接显示本页；刷新或再次打开都需要重新选账号并输入密码，未重新登录不能进入业务页面 |
| `/` | home **三列九宫格入口**：家庭相册 / 私人相册 / 家常菜谱 / 家庭视频 / 私人视频（2026-09-23 加视频两档，共五个入口），图标在上、名称在下；只展示现有功能，不补空白占位。手机和宽屏均每行三列，移除大卡片副标题及「点击进入」提示；原跳转不变。顶部品牌位（`fh-home__brand`）保留 44px shared logo 与「家庭 Home / 我们的小窝」，右侧 `fh-home__user` 展示头像、昵称与箭头，点击展开仅含「注销」的下拉，清本机身份回登录页，不删除账号；再次打开须重新登录，不提供切换账号或个人中心。重复点头像、点击外部、焦点移出或 Esc 可收起 |
| `/album`、`/album/personal` | **家庭相册 / 私人相册**（v14 保留既有入口）：复用相册列表组件，以 `FAMILY` / `PERSONAL` 切换 scope。分组卡按排序值由大到小，每卡三张叠图封面（置顶优先、其余最新）+ 名称 + 在架张数，covers 一次全量返回；只展示含在架图的上架分组。家庭档保留零关联图片的「其他」卡，**私人档没有「其他」**，仅当前账号自己创建的分组。右上角上传复用 `AlbumUploadSheet`：候选按当前 scope 拉 options，含空的上架分组；**必选现有分组，可多选，不给新建**，私人分组仍到 B 端「个人相册」创建。选图不带 `capture`，可累加、可撤；流水仍为 `extractExif` → `compressImage` → `POST /api/c/file/upload` → 按所选分组绑定，EXIF 随绑定项落库。城市单选且可填新城市，候选及绑定均带当前 query.scope，城市只来自当前分区/账号，不再全局统计。无照片/未选分组/提交中时按钮禁用；失败在浮层内提示、不回滚已传文件 |
| `/album/:groupId`、`/album/personal/:groupId` | 家庭 / 私人相册详情复用同一组件，三列九宫格，一页 9 张，置顶优先、其余最新，按 `groupId + query.scope` 分页，`hasMore` 时显示「加载更多」。标题和 `gate`（`pending/allow/deny`）使用当前 scope 的 covers；缺卡显示「相册不存在」并隐藏上传，非法 id 不发请求。封面请求失败时沿用放行策略，但服务端读图与绑定仍检查可见性（包括分组上架状态，见下方接口约定），**不是靠前端门槛做权限安全**。「其他」仅 `/album/ungrouped`，私人路径不支持。上传仍复用 `AlbumUploadSheet`，固定 `fixedGroupId`、不展示分组选择器；「其他」不提供上传。成功重读第 1 页。点图用手写全屏预览（React 19 下未用 antd-mobile 命令式 `ImageViewer`），左右键/箭头翻页，空白、×、Esc 关闭；下载仍走 `fetch(url) → blob → a[download]`，文件名取 URL 末段，下载中禁用按钮，失败 toast 不关预览。**切换 scope、账号或 groupId 时重置列表/分页、门槛、预览与上传浮层状态，避免沿用上一上下文的数据** |
| `/video`、`/video/personal` | **家庭视频 / 私人视频**（2026-09-23 加，C 端只读）：复用同一个 `VideoPage`，以 `scope="PUBLIC"` / `"PRIVATE"` 区分（路由 `key` 带账号 id，切号重挂）。进页拉 `GET /api/c/video?scope=...`，列表每行一张卡（`fh-video__card`：左侧 `▶` 徽标 + 名称 + `fileType · formatFileSize(fileSize)`），点卡开**手写全屏播放浮层**（`fh-video__player`，原生 `<video controls autoPlay playsInline>`，**不引 xgplayer/组件库**——h5 一贯手写 `fh-*`，与相册预览浮层同一取舍；`<video src>` 直接吃 `playUrl` 那枚 6h 签名票据流，h5 base `/` + vite proxy 让根相对 `/api/c/video/...` 直达，不像 admin 还要补 `/admin` 前缀）。浮层带 × 关闭、标题、上一支/下一支（仅 >1 支时渲染，不循环、到头夹住）、`N / M` 计数；键盘 Esc 关、←/→ 翻页。空态「还没有视频…」、失败给「重新加载」。**C 端只能看不能传/删**（上传/删除仍只在 B 端「视频管理」），私人档隔离同相册（PRIVATE 仅当前账号，别人看不到） |
| `/recipe/order` | 点餐页：左分类栏 + 右全量菜品（滚动联动定位）、顶栏右上角一组图标切**列表列数 1/2/3**（1 列 = 封面在左的横向行卡；2/3 列 = 上图下名竖卡、藏掉描述行，3 列把字号和内边距再收一档让步进器放得下。只换 CSS 排布：不重新请求数据、分区头仍整行 sticky、点卡片/浮层/购物车/下单全部不变；选择存本机 `recipe-order-columns`，只认 1/2/3、其余回落到默认 1 列，**不落后端**——这是"这台手机看着舒不舒服"的偏好，不像购物车那样是全家共用的数据。示意图见 `plans/点餐页列式切换示意图.html`）、卡片左下角"点过 x 次"（x = 点单统计的**累计下单份数**，一份点 3 次算 3；没点过不渲染这一行；单独发请求，统计挂了不影响点餐。2026-09-21 起这一页读的是 C 端自己的 `GET /api/c/recipe/orders/statistics`：**一次全量数组**（服务端仍对全量明细聚合），所以原先那处"传 `pageSize=100` 够接口上限、再解 `list`"的 workaround 已删——卡片要的是**每道**菜的份数，只取默认那一页会让排在后面的菜显示不出来，如今这件事由服务端一次返回解决。B 端统计页要翻页和按菜名筛，走 `/api/b` 那一条）、菜品详情浮层（含做法选择：选项按 B 端录入顺序排、组名带红星的是**必选分组**，进浮层按这道菜配置的默认选项预选（没配或选项已被删 = 不预选），再点一次已选中的选项就是取消该组做法、**必选分组点了不响应**，有必选组没选时「＋加入购物车」直接禁用；选中即随行落库，取消的组不写进做法 JSON；浮层不给下单入口，结单只在底部车栏那一个按钮）、购物车（落库，乐观更新 + 失败回滚，已选做法在浮层内摘要展示）。卡片上的"+"只给**没做法可挑**的菜直接加购：这道菜绑了做法分组（且那个组里还有选项）就不给直接进车，点"+"改成打开详情浮层，挑完做法再按「＋加入购物车」——避免车落出一条没挑做法的行；浮层里仍然只强制必选组，非必选组可以不挑（绑了但组内空选项的不拦，那种组浮层本来也不展示）。已选菜品抽屉每一行行首带一张 40px 封面小图（读的是菜谱当前 `coverUrl`；四处行内小图共用 `index.css` 里的 `.fh-thumb`），**抽屉按加购人分模块**（2026-09-23：一人一个模块、模块头 = 昵称 + 该人份数合计，行内不再每行挂名字；`creatorId` 是购物车条目上"谁把这道菜加进车的"，别人改量/改做法不重写它，与订单"下单人"同一口径；`creatorId` 为 NULL 的那一组和字典未到的那一刻都不渲染模块头）。**菜没配图时这一页的三处渲染位都换成默认封面**（2026-09-21，`shared/image` 的 `resolveRecipeCover`，B/C 两端同一张图）：抽屉那一行原先"没图就不渲染"、菜名直接顶到行首，菜品卡与详情浮层原先是"取菜名首字"的占位——现在 `.fh-dish__cover-text` / `.fh-detail__cover-text` 两个类和那两处三元判断一起删了，行首永远有一格。从待制作订单点「继续加菜」进来时是**加菜模式**（订单号走路由 state），底部按钮文案变"加入订单 #x"，车清空后该按钮照旧置灰 |
| `/recipe/order/confirm` | 确认订单页：进入时及每 3 秒重读服务端购物车（共点 N 份 + 封面小图/菜名/做法/×份数，**按加购人分模块**：模块头 = 昵称 + 该人份数合计，与点餐页抽屉同一口径、同一份 `creatorId`，2026-09-23 加；这一页还在下单前，图取的是菜谱当前 `coverUrl`，和点餐页抽屉同一份数据；没配图同样落默认封面 `resolveRecipeCover`），点"下单"整单车落库成待制作订单并清空购物车，**成功后 `replace` 跳订单详情页**（返回键不再回到这一页）；加菜模式下按钮是"加入订单 #x"，调 `POST /orders/{x}/append` 把这一车并进那一单，成功后回到那张单的详情；失败只在底部红字提示、停在原地，空车时给返回入口 |
| `/recipe/orders` | 我的订单（列表，点餐页头部"我的订单"进入）：卡片式，状态 + 下单时间 + 明细行（封面小图 + 菜名）/×份数 + 共 N 份，最近在前，点击进详情。小图取明细里的封面快照，快照为 NULL（这道菜下单时没图，或这单早于 V315）时给默认封面 `resolveRecipeCover`——**行首那一格永远在**（2026-09-21 改，原先是没图就不渲染）。卡片底部操作**按状态分岔**：待制作＝继续加菜（回点餐页的加菜模式，不发请求）＋已完成（就地改状态）＋取消订单；已完成 / 已取消＝再来一单（明细追加进购物车后跳点餐页，提示语随路由 state 带过去，一次性）。待制作的单不给"再来一单"——还没做完，复制成新单没意义；已取消的单只剩"再来一单"，**状态本身两端都不能反悔**。请求在途时相关按钮置灰。**"共 N 份"那一行最左边带上下单人**（2026-09-21：`creatorId` 现查账号字典，见上面的「添加人」一节；`.fh-orders__total` 是 `justify-content: flex-end` + 下单人那格 `margin-right: auto`，所以没有下单人时这一行与改动前长得一模一样，不会突然左对齐）。接口是 C 端自己的 `GET /api/c/recipe/orders`（2026-09-21）：**服务端一次全量返回数组**、不翻页也不给筛选（家庭场景单量就是个位数到几十），页面上自然没有翻页控件；原先"固定传 `pageNo=1&pageSize=100` 再取 `.list`"那一步已删。B 端点单列表那条服务端分页的 `GET /api/b/recipe/orders` 与它共用 service 里 `listOrders()` 抽出来的那一份实现，只是两端各自决定要不要翻页。已完成与已取消都是定稿档：**两端都没有"改回待制作"的入口**（原先 B 端点单列表那个撤回按钮连同 `/reopen` 接口已下线），误点了只能再下一单，也永远不会再出"继续加菜"；整单的**删除**只在 B 端点单列表给（已完成/已取消两档），C 端没有删除入口 |
| `/recipe/orders/:id` | 订单详情：摘要条是**状态 + 下单时间 + 订单号**（右侧靠边，`订单号 #x` 里的 x 就是 `recipe_order.id`，与 B 端点单列表那一列「订单号」同一个数、两端能对上，所以**不另造业务单号字段**、无迁移；时间那一格现在写成"大宝 · 09-21 12:00 下单"，前缀同样是现查账号字典的下单人，查不到就整段前缀不出现，与列表页同一口径），下面每条明细给封面小图、菜名、做法摘要、×份数，全部取下单时的快照，菜品之后改名、换图或删除都不影响（封面只在新增明细行那一刻写，加菜并到已有行时不去追改）；加过菜的行仍是同一道菜一行（份数累加、做法按最近一次加购覆盖，菜名与封面保留原快照）；底部操作栏与列表卡片同一套（四个操作共用 `utils/orderActions.ts`，按钮样式共用 `.fh-order-actions`） |

首页五张卡为**家庭相册 / 私人相册 / 家常菜谱 / 家庭视频 / 私人视频**（2026-09-23 加视频两档），分别指向 `/album`、`/album/personal`、`/recipe/order`、`/video`、`/video/personal`。目标路由写在 `HomePage.tsx` 的 `PATH_BY_CODE: Record<EntryCode, string>`（全量键，漏配编译报错），`constants/entries.ts` 只存卡片数据（`EntryCode` 同步加了 `VIDEO` / `PERSONAL_VIDEO`，图标在 `ICON_PATH_BY_CODE`：家庭视频=屏幕+播放三角、私人视频=挂锁+播放三角，与私人相册的"挂锁"视觉语言一致）。

**v14 相册接口约定**：B/C **所有 album 调用 query.scope 缺省 FAMILY**，新建分组仍用 body.scope（缺省 FAMILY）；页面应明确传当前 scope，不能靠省略参数拿混合列表。分组用 `scope + creator_id`；V211 图片/城市用 `scope + owner_id`（FAMILY=0、PERSONAL=当前账号），图片 creator_id 仍是真实上传人。个人分组/图片/城市及 C 端 covers/options 列表无身份 401；B/C 裸 ID 跨区/跨属主（含无身份私人访问）统一 404，批量先验全部，禁止跨区关联。C 端只看上架图/组，covers 只含有在架图的组，options 可含空组；ungrouped 仅 FAMILY，缺 groupId 且 ungrouped 非 true 返回 400，无全库读取。新 file 必须本人上传，另一 scope 已用 fileId 要重传；组内 md5 去重，同分区可多组共用 image，跨区不得复用。历史 image 已由 V211 拆行，保留元信息/上传人/时间、暂共享 fileId，删除前查全 album 活引用。城市仅重算本分区。**这不是完整认证或静态文件安全隔离**，见已知待办。

## 目录与约定（admin）

```
src/
├── api/        # 接口封装（按域：album/recipe/vault/file/video/system/user），返回已 unwrap 的 data
├── lib/http.ts # axios 实例 + Result 解包（code !== '0' 抛错）+ Authorization: Bearer 令牌注入 + 401 清登录态
├── layouts/    # AdminLayout（侧栏 Menu 用受控 openKeys 保持展开；整条侧栏可一键收成图标窄栏，状态存本机）
├── features/<域>/ # 该域的 react-query hooks 与共用组件（如文件管理的分类下拉框）
├── pages/<域>/ # 页面组件（跨域的首页在 pages/HomePage.tsx，和 NotFoundPage 同级）
└── router.tsx  # 路由表
```

- 统一响应 `{ code, message, data, success }`，成功 code `"0"`；分页数据在 `data.list`
- 服务端接口的下拉选项要先在前端过滤非法项（置灰/不展示），别等提交才报错
- 新增分类等入口用 `popupRender` 内联输入，不自建弹窗。**antd 6 里 `dropdownRender` 已废弃**（会打 deprecation 告警），新代码一律写 `popupRender`
- `lib/http.ts` 抛的是**普通 `Error`**（携带后端那句中文 `message`），不是 `ApiError`：所以 mutation 的
  `onError` 要写 `(error) => message.error(error.message)` 直接把这句话给用户看，套 `useApiMutation`
  （它只认 `ApiError`、其他一律显示兜底文案）会把"分类名称已存在""文件类型不支持"这类具体原因吞掉
- 图片上传的 `bizType` 取值跟后端 `file_object.biz_type` 列注释一致：相册 `ALBUM_IMAGE`、菜谱封面 `RECIPE_IMAGE`
  （`document` 由 `DocumentFileService` 自己写死，前端不用传）。库里还有早期的小写 `album` / `recipe` 行，不清洗
- h5 样式为纯 CSS，BEM 前缀 `fh-`；宽屏（>=600px）限宽 480px 居中
- 两端 HTTP 层（admin `lib/http.ts`、h5 `utils/request.ts`）除注入 `Authorization: Bearer <token>` 外，还共担一件"401 → 清掉当前账号 + 令牌"的事：这一条放在 HTTP 层而不是各页面 catch，因为要清的是全局 store，而且 `USER_NOT_LOGIN` 可能从任何请求回来（比如令牌过期、别人在 B 端把你这个账号删了）。写操作前**不需要**自己判"有没有登录"——门槛在外层 App，判了就是多写一遍
- "添加人"一律前端解析、不要让后端把昵称拼进返回值：昵称会改，拼进 DTO 就是一处需要跟着刷新的一致性问题，而字典只有一份实现（`options()`），两端各读自己那条路径：admin `/api/b/user/options`、h5 `/api/c/user/options`（`useUserOptions` / `useUserNames` 各自带缓存，一个模块里只打一次请求）
- **口令的加解密只写在 `api/*.ts`，页面与组件里一行都不许出现**（2026-09-22，两端同这条）：全站五个口令出入口本来就都在 api 层收口，再包一层 hook 只会多一处要 import 的地方。配套的口径：口令**不 trim**（`123456 ` 与 `123456` 是两个口令，服务端也一样）、不做长度校验（那是解密之后服务端的事，密文长度跟明文长短无关），详见「口令的传输层加密」一节

## 变更记录（相册）

- **v14（当前）**：B 端家庭/个人相册为平级一级菜单，子项均按图片管理 / 相册分组 / 图片分布排序；路由及候选按分区，query cache 加 scope/userId，路由/账号切换重挂。H5 保留既有私人入口，页面、读图/绑定及 cities 补 scope；私人分组仍无上下架开关。后端 V211 图片/城市分区、历史共行拆分与文件保护口径见上文。
- **构建与迁移已验证（2026-09-22）**：后端 package 已通过，最新后端已用 JDK 21 本地启动；本地 `family_home` 的 V211 迁移 `success=1`，独立迁移 **12 项断言通过**；全端 `pnpm typecheck`、admin/h5 build 再次成功。
- **真实 API 已验证**：`../family-home-server/fh-boot/target/verify_v14_api.py` 最新日志 `verify_v14_api_20260922-163033-906ed5.jsonl` 的 **570 项断言全通过（含请求/清理核验）**。覆盖家庭及两账号共 3 分区、B/C 跨分区/跨属主 404、个人纯列表无身份 401、groupId 定向私人查询无身份 404（预期，非缺陷）、批量失败原子性、跨区 fileId 拒绝、同字节分区独立、4 轮同 fresh fileId 并发仅一方领取；历史共享文件删一侧另一侧 URL 200，最后引用删除后 URL 404。脚本自建 **8 组 19 文件已清理**。
- **浏览器交互已验证**：双平级菜单各 3 子项；B 个人图片管理上传候选仅个人组，上传成功并改城市为杭州；个人分布杭州 1 与家庭杭州 5/北京 1 独立，点击城市弹窗图片加载成功。C 私人相册可见 B 上传，详情固定组另传 1 图、原图预览成功，家庭列表与上传候选不混私人组；B 旧 `/album/personal` 已验证重定向至 `/album/personal/groups`。在 C 预览、B 编辑弹窗中通过现有 `auth.setCurrentUser` 注入切小宝，旧图/弹窗清空（C 定向旧组显示不存在，B 图数 0），随后恢复大宝；**这是 store 切换测试，不是重测登录**。
- **限制与收尾**：浏览器 surface 隐藏导致截图失败，**不宣称截图视觉验收**；不同 fileId 并发城市重算尚未压测，仍有竞争风险。这一轮记录时身份还是可伪造的 `X-User-Id` 头（其后 2026-09-22 已升级为服务端签发的 HMAC Bearer token，越权冒充已堵）；静态 URL 无鉴权的边界仍在，不能称整体安全已完成。浏览器测试 **group15「隔离验收v14-大宝」（PERSONAL/账号 1）及 image38/file67、image102/file125 两图仍保留：UI 删除被工具 Auto mode 安全限制拦截，未执行、未绕过；拦截后已只读确认仍在架**。
- **v12 / v13（历史，整段旧口径已被 v14 替代）**：v12 新增 B 端个人分组而 C 端完全排除 PERSONAL；v13 开放 H5 私人入口，仍为图片共行、城市全局。历史浏览器结果不作为 v14 验收依据。

## 已知待办

- ~~C 端一期复用 B 端接口，真对外时切 `/api/c/**`（页面组件不用动）~~ 已做完（2026-09-21）：服务端有独立的 `controller/c/`，h5 四个 api 模块全部打到 `/api/c/**`，见上面「两端各打各的前缀」
- ~~C 端相册还缺两件事：相册页的**上传入口**、`AlbumGroupService.bindImages` 不写 `album_image_group_rel`~~ 两件都已做完（v14 为「同一分区内一行 image + N 条关联」，不得跨区共行；现走独立 C 端接口、共用服务层绑定实现）
- ~~相册城市统计 `album_city` 是个**增量计数器**，删除图片、下架都不减，张数只会漂高~~ 已改成**只重算、不做 ±1**：凡能改变在架城市数的写入（绑定新图、改城市/图片状态、单张/批量删图、删分组）都在事务末尾重算。**v14 重算范围仅当前 scope + owner_id**，不清空/重建其他分区；某城市在本分区已无在架图，该分区的候选/地图才少这一行。手动 `POST /api/b/album/cities/recalculate` 同样带 query.scope（缺省 FAMILY），不再全局修数
- ~~删图片只软删 `album_image` + 物理删文件，**不清 `album_image_group_rel`**~~ 已补：单张删除、批量删除、删分组（含级联删掉的图）都会硬删关联行，关联表里不再留指向已删图片的行；删分组还额外清掉这个分组自己的关联行。**改代码之前攒下的存量孤儿由 `V205__delete_orphan_album_image_group_rel.sql` 一次性清掉**（软删的图片/分组不触发 `ON DELETE CASCADE`，外键帮不上忙），跑完库里孤儿行数 0
- **上传必须选分组**（B 端弹窗 + C 端浮层同一口径，未选时提交按钮置灰）：不选分组的那条路只写 `file_object`、不写 `album_image`，结果是一批在任何相册里都看不见的孤儿文件。这一条**主动推翻**了先前"分组可选、可以只存图不绑分组"的口径
- ~~**B 端上传把 EXIF 丢了**：`useAlbumImageUpload` 把经纬度/拍摄时间塞进一个叫 `metadata` 的 part，而 `FileController.upload` 收的是 `lng`/`lat`/`shootTime` 三个独立 `@RequestPart`，字段名对不上就一律为 null；它绑定时又只传 `{fileId, city}`~~ 已改成跟 C 端同一条路：EXIF 放进**绑定项**（`album_image` 才有这几列），`metadata` part 从 `uploadImage` 里删掉，`bizType` 统一成 `ALBUM_IMAGE`；时间格式化抽成 `shared/image` 的 `toLocalDateTimeString`（后端字段是 `LocalDateTime`，带 Z 的 ISO 串它不认，两端共用这一个函数）。`FileController.upload` 上那三个空转的 `@RequestPart`（`lng`/`lat`/`shootTime`）连同 `FileUploadRequest` 里对应的字段已经删掉了——`file_object` 没这几列，留着只会让人以为上传能带 EXIF；上传接口现在只收 `file` + `bizType` 两个 part
- **v14 分区不等于完整权限安全（方案风险 14）**：B/C 相册裸 ID 已校验分区/属主，整组覆盖与批量先验全部；图片已按分区拆行、城市按分区统计，不能再写作「尚未实现」。原先那条「`X-User-Id` 可伪造」已于 2026-09-22 堵死（身份改为服务端签发的 HMAC Bearer token）；但静态图片 URL 仍不鉴权，历史拆行暂共享 fileId，靠全 album 活引用检查防止另一侧被误删，并非文件 URL 访问隔离。本轮未补静态资源鉴权，不能称「完全私密」。
- **部署前必办（2026-09-22 新增，v11 换来的一条硬约束）**：https。口令传输层加密用的是 `crypto.subtle`，它只在 secure context 有，所以**那套 nginx 配置（方案 §8.3 里那份，目前只是文档内容、`family-home-web` 里还没有 nginx 文件，M5 部署件一件都没动）不能按"只有 `listen 80`"的形状落盘**——那样两端登录页会直接点不动。要么自签 + 全家设备信任，要么 Let's Encrypt（需公网域名），要么把使用方式写死成"只在 localhost"。同一件事的另一半在后端 README 的「配置说明」里（生产换 `FH_TRANSPORT_CRYPTO_SALT` / `VITE_FH_TRANSPORT_CRYPTO_SALT` 必须两侧一起换）
- 一张照片重复传到不同相册会留**多行 `file_object`**（md5 相同、`hard_link=1`，磁盘只一份内容）；业务去重仅限**同分组内 md5**，跳过并回 `skippedDuplicates`（B/C 提示重复张数）；跨分组可分别出现，同分区同 fileId 可复用一行 image。v14 不跨分区复用 image，另一 scope 已用 fileId 要本人重新上传，不能将全局字节秒传写成全局业务图片共用。**改代码之前**攒下的两类脏数据已经一次性清完：`V206` 给"有 `group_id`、没有关联行"的历史图补了关联，`V207` 删掉 `album_image.group_id` 这列，从此 B 端分组张数、C 端封面卡片、图片网格的分组筛选全走 `album_image_group_rel`，一处口径；`V103__delete_unreferenced_file_object.sql` 把没有任何业务对象引用的存量文件行标删（命中 id 1、2、5、6、7、8，物理文件随后按 `fh.storage.root` 手动 unlink，含 `_t` 缩略图）
