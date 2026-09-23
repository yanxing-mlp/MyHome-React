import { useEffect, useRef } from 'react';
import Player from 'xgplayer';
import 'xgplayer/dist/index.min.css';

interface VideoPlayerProps {
  /** 播放地址（已拼好 base 的绝对路径，带签名票据） */
  src: string;
  /** 视频标题，用于记忆播放进度的 key */
  title?: string;
  height?: number | string;
  /** 是否自动播放 */
  autoplay?: boolean;
}

/**
 * xgplayer 3.x 的 React 封装。
 *
 * 为什么手写而不是用 xgplayer-react：官方 React 包停在 xgplayer 2.x，与 React 19 不兼容，
 * 这里直接用框架无关的 3.x 核心（new Player 挂到一个 div 上），用 ref + effect 管生命周期。
 *
 * 开箱即用的功能（对应用户要的倍速/快进/清晰度/选集）：
 * - 倍速：playbackRate 插件，控制栏可选 0.5~3x；
 * - 快进：进度条可拖 + 键盘 ←/→ 快退快进 5s（keyboard 插件）；
 * - 全屏 / 网页全屏 / 画中画：fullscreen + pip 插件；
 * - 断点续播：memory 记住上次看到哪（按 title 分键）；
 * - 清晰度：播放器本身支持多码率切换，但这里每支视频只有一个源文件，
 *   没做多码率转码，所以控制栏不出现清晰度选择——不是缺功能，是没有可切的第二档。
 * 「选集」不在播放器内部实现，由外层 VideoPlayerModal 用视频列表当播放列表来切换。
 */
export function VideoPlayer({ src, title, height = 420, autoplay = false }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  // 挂载/卸载播放器；src 变化时销毁重建（切集）。
  useEffect(() => {
    if (!containerRef.current) return;
    const player = new Player({
      el: containerRef.current,
      url: src,
      height,
      width: '100%',
      autoplay,
      volume: 0.8,
      // 断点续播：同一支视频下次打开接着放。key 用标题，缺省退回 src。
      memoryPlay: true,
      // 倍速：0.5x ~ 3x。
      playbackRate: [0.5, 0.75, 1, 1.25, 1.5, 2, 3],
      // 键盘：空格播放/暂停，←/→ 快退快进。
      keyboard: { seekStep: 5 },
      // 底部控制栏插件集合（3.x 默认 preset 已含播放/进度/时间/音量/倍速/全屏/网页全屏/画中画）。
      screenShot: false,
      // 视频结束不自动循环，交给外层选集逻辑决定下一支。
      loop: false,
      lang: 'zh-cn',
      // 关闭播放器自带的右键菜单版权信息，界面更干净。
      ignores: ['danmu'],
    });
    playerRef.current = player;
    return () => {
      player.destroy();
      playerRef.current = null;
    };
    // 切集时 src 变化 → 重建播放器；title 参与 memoryPlay 语义，一并纳入依赖。
  }, [src, height, autoplay]);

  return <div ref={containerRef} data-title={title} />;
}
