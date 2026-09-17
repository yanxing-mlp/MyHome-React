import { useNavigate } from 'react-router';
import { HOME_ENTRIES } from '../constants/entries';

/**
 * C 端 home 页。
 *
 * 一期只有两张卡片，数据来自前端静态常量（方案 §5.4），点击跳占位页。
 * 卡片内容（真实计数、封面图）等二期做内页时再接 /api/c/home/entries。
 */
export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="fh-home">
      <h1 className="fh-home__title">家庭 Home</h1>
      <p className="fh-home__subtitle">我们的小窝</p>

      <div className="fh-home__grid">
        {HOME_ENTRIES.map((entry) => (
          <div
            key={entry.code}
            className="fh-entry-card"
            style={{ background: entry.gradient }}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/coming-soon?from=${entry.code}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(`/coming-soon?from=${entry.code}`);
              }
            }}
          >
            <h2 className="fh-entry-card__title">{entry.title}</h2>
            <p className="fh-entry-card__subtitle">{entry.subTitle}</p>
            <span className="fh-entry-card__hint">点击进入</span>
          </div>
        ))}
      </div>
    </div>
  );
}
