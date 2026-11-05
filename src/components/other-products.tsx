import Link from "next/link";
import { products } from "@/data/products";

/**
 * OtherProducts — 复刻 agrumeafarm.it 产品详情页底部 "THE OTHER PRODUCTS" 区块
 * （target_site/en/dispensa/caponata.html: .other-products / .product-slider / .product-slide）。
 *
 * 逆向结论（hover 交互核心是 CSS :hover，JS 只负责横向拖拽滚动）：
 * 1. 每张卡片通过内联 style 携带自己的背景色变量 --slide-bg（如 #E6FFC7、#F8C8D0）；
 *    静态背景为奶油色 #ffe9d7，transition background-color/transform .6s var(--ease-soft)。
 * 2. 悬停时原站给卡片加 is-active 类：
 *      .product-slide.is-active { background: var(--slide-bg); transform: scale(.96) rotate(2deg); }
 *      .product-slide.is-active .product-slide__jar { transform: scale(1.1) rotate(4deg); }
 *    —— 即「背景图案淡入 + 罐子放大」的反向缩放：整卡微缩并倾斜，内容反而放大突出。
 * 3. .product-slide__stage（水果图案层）默认 opacity:0，就绪后淡入（transition opacity .4s ease），
 *    z-index 低于图片，形成「背景图案切换」。
 * 4. 文字徽章 .op-badge 用双层字符 + overflow:hidden mask，hover 时上层 translate3d(0,-100%,0)
 *    滑出、下层滑入，delay = calc(var(--i) * 18ms)，实现逐字滚动的滑入徽章
 *    （对应原站 [data-text-reveal].rvl-ink 与 .fp-nav__reveal 的 roll-hover 逻辑）。
 * 这里把 is-active 改挂在纯 CSS :hover / :focus-visible 上，零 JS 即可复现视觉交互。
 */

/* 每个产品的专属 slide-bg（对照原站按口味取色的做法），当前页自动跳过 */
const SLIDE_BG: Record<string, string> = {
  durian: "#FFE9D7", // 奶油橙 — 榴莲
  papaya: "#FFC6B8", // 蜜桃粉 — 木瓜
  hamimelon: "#E6FFC7", // 蜜瓜绿 — 哈密瓜
  potato: "#F0D6C5", // 大地棕 — 土豆
  passionfruit: "#F8C8D0", // 百香果粉 —  passion fruit
};

/* 内联装饰 SVG（对应原站 .product-slide__decor 的图案层），零外部素材依赖 */
function SlideDecor({ slug }: { slug: string }) {
  return (
    <span className="op-decor" aria-hidden="true">
      {slug === "potato" ? (
        /* 土丘 + 芽眼圆点 */
        <svg viewBox="0 0 368 481" fill="none">
          <circle cx="70" cy="80" r="26" fill="currentColor" opacity=".14" />
          <circle cx="300" cy="60" r="14" fill="currentColor" opacity=".18" />
          <path d="M0 400 Q 92 330 184 392 T 368 360 V 481 H 0 Z" fill="currentColor" opacity=".12" />
          <path d="M0 436 Q 120 380 240 430 T 368 410 V 481 H 0 Z" fill="currentColor" opacity=".16" />
          <circle cx="120" cy="150" r="6" fill="currentColor" opacity=".25" />
          <circle cx="250" cy="200" r="4" fill="currentColor" opacity=".25" />
        </svg>
      ) : slug === "passionfruit" ? (
        /* 半切百香果：放射籽粒 */
        <svg viewBox="0 0 368 481" fill="none">
          <circle cx="184" cy="120" r="86" stroke="currentColor" strokeWidth="3" opacity=".22" />
          <circle cx="184" cy="120" r="60" stroke="currentColor" strokeWidth="2" opacity=".18" />
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <circle
                key={i}
                cx={184 + Math.cos(a) * 38}
                cy={120 + Math.sin(a) * 38}
                r="7"
                fill="currentColor"
                opacity=".2"
              />
            );
          })}
          <circle cx="60" cy="380" r="30" fill="currentColor" opacity=".12" />
          <circle cx="320" cy="430" r="18" fill="currentColor" opacity=".14" />
        </svg>
      ) : slug === "hamimelon" ? (
        /* 网纹瓜：交叉网纹弧线 */
        <svg viewBox="0 0 368 481" fill="none">
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={`a${i}`}
              d={`M ${-40 + i * 110} 481 Q ${60 + i * 110} 240 ${-40 + i * 110} 0`}
              stroke="currentColor"
              strokeWidth="2.5"
              opacity=".16"
            />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={`b${i}`}
              d={`M 0 ${-30 + i * 120} Q 184 ${40 + i * 120} 368 ${-30 + i * 120}`}
              stroke="currentColor"
              strokeWidth="2.5"
              opacity=".14"
            />
          ))}
        </svg>
      ) : slug === "papaya" ? (
        /* 木瓜剖面 + 籽 */
        <svg viewBox="0 0 368 481" fill="none">
          <ellipse cx="184" cy="150" rx="70" ry="100" stroke="currentColor" strokeWidth="3" opacity=".2" />
          <ellipse cx="184" cy="150" rx="34" ry="60" fill="currentColor" opacity=".1" />
          <circle cx="168" cy="120" r="6" fill="currentColor" opacity=".3" />
          <circle cx="196" cy="150" r="6" fill="currentColor" opacity=".3" />
          <circle cx="176" cy="182" r="6" fill="currentColor" opacity=".3" />
          <circle cx="80" cy="420" r="24" fill="currentColor" opacity=".12" />
          <circle cx="300" cy="450" r="14" fill="currentColor" opacity=".14" />
        </svg>
      ) : (
        /* 榴莲：尖刺轮廓 */
        <svg viewBox="0 0 368 481" fill="none">
          <path
            d="M40 210 L70 150 L96 205 L132 128 L158 198 L200 118 L226 196 L262 138 L286 206 L328 160 L340 224 L280 260 L184 250 L90 262 Z"
            stroke="currentColor"
            strokeWidth="3"
            opacity=".18"
          />
          <circle cx="60" cy="420" r="26" fill="currentColor" opacity=".12" />
          <circle cx="310" cy="400" r="16" fill="currentColor" opacity=".14" />
        </svg>
      )}
    </span>
  );
}

export function OtherProducts({ currentSlug }: { currentSlug: string }) {
  const others = products.filter((p) => p.slug !== currentSlug);

  return (
    <section className="op" aria-labelledby="op-title">
      <div className="op__head">
        <h2 id="op-title" className="op__title">
          {"The other products".split("").map((ch, i) => (
            <span key={i} className="op__char" style={{ "--i": i }}>
              <span className="op__char-top">{ch === " " ? "\u00A0" : ch}</span>
              <span className="op__char-bot" aria-hidden="true">
                {ch === " " ? "\u00A0" : ch}
              </span>
            </span>
          ))}
        </h2>
      </div>

      <div className="op__slider">
        <ul className="op__track" data-lenis-prevent-horizontal="">
          {others.map((p) => (
            <li key={p.slug}>
              <article
                className="op-card"
                style={{ "--slide-bg": SLIDE_BG[p.slug] ?? "#FFE9D7" } as React.CSSProperties}
              >
                {/* 背景图案层：hover 淡入（对应 .product-slide__stage opacity 0→1） */}
                <span className="op-stage" aria-hidden="true">
                  <SlideDecor slug={p.slug} />
                </span>

                {/* 产品图：hover 放大+旋转（对应 .product-slide__jar scale(1.1) rotate(4deg)） */}
                <figure className="op-jar">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image}
                    alt={p.name}
                    width={367}
                    height={481}
                    loading="lazy"
                    decoding="async"
                  />
                </figure>

                {/* 文字徽章：hover 从底部滑入（rvl-ink 双层字符滚动） */}
                <span className="op-badge" aria-hidden="true">
                  {p.fruit.toUpperCase().split("").map((ch, i) => (
                    <span key={i} className="op-badge__char" style={{ "--i": i }}>
                      <span className="op-badge__mask">
                        <span className="op-badge__top">{ch === " " ? "\u00A0" : ch}</span>
                        <span className="op-badge__bot">{ch === " " ? "\u00A0" : ch}</span>
                      </span>
                    </span>
                  ))}
                </span>

                <Link
                  className="op-link"
                  href={`/dispensa/${p.slug}`}
                  aria-label={`${p.name} — view product`}
                />
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
