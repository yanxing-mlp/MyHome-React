/**
 * 从 shared/src/brand/logo.ts 里把 SVG 源码抠出来，生成一张 logo 预览页。
 *
 * 为什么用脚本而不是手抄一份 SVG 进 HTML：预览页里的图必须和线上用的那张完全一样，
 * 手抄就成了第二份源，以后改图形时预览页悄悄不更新，看到的全是废图。
 *
 * 用法：node tools/gen-logo-preview.mjs（产出 plans/logo-preview.html）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'packages/shared/src/brand/logo.ts'), 'utf8');

// 结束符必须吃到 `.trim()`：模板串自己以反引号 + .trim() 收尾，
// 只写 "`;" 会一路匹配到文件末尾那个 data URI 常量，把注释和代码当图形抠出来。
const match = src.match(/const FH_LOGO_SVG = `([\s\S]*?)`\s*\.trim\(\);/);
if (!match) {
  throw new Error('没在 logo.ts 里找到 FH_LOGO_SVG，预览页不能生成');
}
if (!match[1].trimStart().startsWith('<svg')) {
  throw new Error(`抠出来的不是 SVG 开头，logo.ts 的模板串写法变了：${match[1].slice(0, 40)}`);
}
// 同一段 SVG 要在页内出现多次，先抠掉 xmlns（内联时多余），id 由 render() 逐个改名，避免撞 id
const bare = match[1].trim().replace(/\s+xmlns="[^"]*"/, '');

/**
 * 出一份指定像素尺寸的图形。
 *
 * 只改 <svg> 上的 width/height，viewBox 与里面所有坐标保持 64 画布 ——
 * 图形靠 viewBox 缩放，坐标跟着改会把内容切出画布外。
 * 顺带把渐变 id 换名：同一页内联多份完全相同的 SVG 时，重复 id 会互相抢引用。
 */
function render(size, seed) {
  return bare
    .replace(/^<svg([^>]*)>/, (_, attrs) =>
      `<svg${attrs.replace(/width="64" height="64"/, `width="${size}" height="${size}"`)}>`,
    )
    .replace(/fhLogoGradient/g, `g${seed}`);
}

function tile(label, size, seed, bg) {
  return `<figure class="tile" style="--bg:${bg}">
    <div class="tile__box">${render(size, seed)}</div>
    <figcaption>${label}</figcaption>
  </figure>`;
}

const sizes = [
  ['16 px · favicon', 16],
  ['24 px · B 端侧栏/顶栏', 24],
  ['32 px', 32],
  ['44 px · C 端首页', 44],
  ['64 px · 原始画布', 64],
  ['128 px', 128],
];

const light = sizes.map(([l, s], i) => tile(l, s, `L${i}`, '#fff')).join('\n');
const page = sizes.map(([l, s], i) => tile(l, s, `P${i}`, '#f5f6fa')).join('\n');
const dark = sizes.map(([l, s], i) => tile(l, s, `D${i}`, '#1f2329')).join('\n');
const grad = sizes
  .map(([l, s], i) => tile(l, s, `G${i}`, 'linear-gradient(135deg,#f7971e,#ff5858)'))
  .join('\n');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>家庭 Home · logo 预览</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 32px; background: #fff; color: #1f2329;
    font: 14px/1.6 -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 32px 0 12px; color: #52585f; }
  .note { color: #8a9099; font-size: 13px; max-width: 760px; }
  .row { display: flex; flex-wrap: wrap; gap: 16px; }
  .tile { margin: 0; text-align: center; }
  .tile__box { display: flex; align-items: center; justify-content: center;
    width: 152px; height: 104px; border-radius: 12px; border: 1px solid #eceef2; background: var(--bg); }
  .tile figcaption { margin-top: 6px; font-size: 12px; color: #8a9099; }
  svg { display: block; }
  /* --- 两端实装的样子 --- */
  .mock { display: flex; gap: 24px; flex-wrap: wrap; align-items: flex-start; }
  .sider { width: 208px; border: 1px solid #f0f0f0; border-radius: 8px; overflow: hidden; background: #fff; }
  .sider--narrow { width: 64px; }
  .sider__head { height: 56px; display: flex; align-items: center; gap: 8px; padding: 0 8px 0 16px;
    border-bottom: 1px solid #f0f0f0; font-weight: 600; font-size: 16px; }
  .sider--narrow .sider__head { justify-content: center; gap: 4px; padding: 0; }
  .sider__menu { padding: 8px 0; font-size: 14px; color: #52585f; }
  .sider__menu div { padding: 9px 16px; }
  .sider__menu .on { color: #2f54eb; background: #f0f5ff; font-weight: 500; }
  .dot { width: 32px; height: 32px; border-radius: 6px; border: 1px dashed #d7dbe0;
    display: flex; align-items: center; justify-content: center; color: #b6bcc4; font-size: 15px; }
  .cpage { width: 340px; border-radius: 20px; border: 1px solid #eceef2; background: #f5f6fa; padding: 24px 16px; }
  .cbrand { display: flex; align-items: center; gap: 12px; margin: 8px 0 24px; }
  .cbrand h3 { margin: 0 0 4px; font-size: 26px; font-weight: 600; letter-spacing: .5px; }
  .cbrand p { margin: 0; font-size: 14px; color: #8a9099; }
  .ccard { height: 96px; border-radius: 16px; padding: 18px; color: #fff; box-sizing: border-box;
    box-shadow: 0 6px 18px rgba(31,35,41,.12); }
  .ccard b { display: block; font-size: 20px; font-weight: 600; }
  .ccard span { font-size: 13px; opacity: .86; }
  .ccard + .ccard { margin-top: 16px; }
  .topbar { display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 12px;
    background: #fff; border: 1px solid #f0f0f0; border-radius: 8px; font-weight: 600; font-size: 16px; }
  .tab { display: inline-flex; align-items: center; gap: 8px; max-width: 260px; height: 34px;
    padding: 0 12px; border-radius: 8px 8px 0 0; background: #dee1e6; color: #1f2329; font-size: 13px;
    white-space: nowrap; overflow: hidden; }
</style>
</head>
<body>
  <h1>家庭 Home · 跨端 logo</h1>
  <p class="note">
    图形 = 圆角徽牌 + 白色房子 + 心形门（心形透出底色）。三个色标全部取自现有主题，没有新造颜色：
    <code>#2f54eb</code> 是 B 端 antd 的 colorPrimary，<code>#ff5858</code> 是 C 端主色，
    中间 <code>#8e54e9</code> 取自相册卡渐变 —— 蓝到珊瑚直连中段会发灰，所以垫一档紫。
    唯一的源是 <code>packages/shared/src/brand/logo.ts</code>，本页由 <code>node tools/gen-logo-preview.mjs</code> 从它生成。
  </p>

  <h2>白底</h2>
  <div class="row">${light}</div>

  <h2>C 端页面底色 #f5f6fa</h2>
  <div class="row">${page}</div>

  <h2>深色底（对照用，本产品没有深色场景）</h2>
  <div class="row">${dark}</div>

  <h2>压在渐变上（C 端卡片那种背景，验证不糊）</h2>
  <div class="row">${grad}</div>

  <h2>B 端 · 侧栏展开 / 收起</h2>
  <div class="mock">
    <div class="sider">
      <div class="sider__head">${render(24, 'Bx')}<span style="flex:1">家庭 Home</span><span class="dot">⇤</span></div>
      <div class="sider__menu"><div class="on">首页</div><div>相册</div><div>菜谱</div><div>点单管理</div></div>
    </div>
    <div class="sider sider--narrow">
      <div class="sider__head">${render(24, 'Bc')}<span class="dot">⇥</span></div>
      <div class="sider__menu" style="padding:8px 14px">🏠 🖼 🍴 🛒</div>
    </div>
    <div style="width:340px">
      <div class="topbar"><span class="dot">☰</span>${render(24, 'Bm')}<span>家庭 Home</span></div>
      <p class="note" style="margin-top:10px">&lt; 992px 时 B 端走顶部这条，与 C 端同为图形 + 文字。</p>
    </div>
  </div>

  <h2>C 端 · 首页品牌位</h2>
  <div class="mock">
    <div class="cpage">
      <div class="cbrand">
        ${render(44, 'Ch')}
        <div><h3>家庭 Home</h3><p>我们的小窝</p></div>
      </div>
      <div class="ccard" style="background:linear-gradient(135deg,#5b7cfa,#8e54e9)"><b>家庭相册</b><span>记录每一个瞬间</span></div>
      <div class="ccard" style="background:linear-gradient(135deg,#f7971e,#ff5858)"><b>家常菜谱</b><span>今天吃什么</span></div>
    </div>
  </div>

  <h2>标签页图标（favicon 实际大小）</h2>
  <div class="tab">${render(16, 'Fv')} 家庭 Home</div>
</body>
</html>
`;

// 产出物是给人看的示意图，落在仓库根的 plans/（与前端工程同级、本地 git 忽略）
writeFileSync(join(root, '..', 'plans', 'logo-preview.html'), html);
console.log('plans/logo-preview.html 已生成');
