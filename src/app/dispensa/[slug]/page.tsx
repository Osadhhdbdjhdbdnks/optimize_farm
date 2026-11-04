import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findProduct, products } from "@/data/products";
import { PRODUCT_DETAILS, DEFAULT_DETAIL } from "@/data/product-details";
import { ProductViewer } from "@/components/product-viewer";
import { ProductHeroScroll } from "@/components/product-hero-scroll";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = findProduct(slug);
  if (!p) return {};
  return { title: `${p.name} | Agrumea Farm`, description: p.description };
}

/* ---------- 平台图标（内联 SVG，零素材依赖） ---------- */
function IconWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
function IconTikTok() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
    </svg>
  );
}
function IconShopee() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm4 0h-2v-6h2v6z" />
    </svg>
  );
}

const ICONS = { whatsapp: IconWhatsApp, tiktok: IconTikTok, shopee: IconShopee };

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = findProduct(slug);
  if (!product) notFound();
  const d = PRODUCT_DETAILS[slug] ?? DEFAULT_DETAIL;

  return (
    <div className="pdm">
      {/* ============ HERO（滚动旋转交互，复刻 caponata 页 product-hero） ============ */}
      <ProductHeroScroll>
      <section className="pdm__hero">
        <h1 className="pdm__title">{product.name}</h1>
        <div className="pdm__media">
          {d.heroArt ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={d.heroArt} alt={product.fruit} fetchPriority="high" decoding="async" />
          ) : (
            <ProductViewer src={product.model} alt={product.fruit} scrollTurns={1.0} scrollRange={1.6} />
          )}
        </div>
        <p className="pdm__cat">{d.category}</p>
        <p className="pdm__origin">
          {d.origin[0]}
          <br />
          {d.origin[1]}
        </p>
      </section>

      {/* ============ 故事段 ============ */}
      <section className="pdm__story">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="pdm__wordmark"
          src="/assets/agrumea/brand-wordmark.svg"
          alt="AGRUMEA Farm — Pure fruits, natural goodness, from our farm"
        />
        <span className="pdm__wordmark-diamond" aria-hidden="true" />
        <p className="pdm__lead">
          {d.lead} {d.ingredients}
        </p>
        <p className="pdm__note">{d.mayContain}</p>
        <span className="pdm__diamond" aria-hidden="true" />
      </section>

      {/* ============ 四栏信息（新增 BUY FROM） ============ */}
      <section className="pdm__grid">
        <div className="pdm__col">
          <h2 className="pdm__label">Useful tips</h2>
          <p className="pdm__text">{d.tips}</p>
        </div>
        <div className="pdm__col">
          <h2 className="pdm__label">Available weights</h2>
          <div className="pdm__weights">
            {d.weights.map((w) => (
              <span key={w} className="pdm__weight">{w}</span>
            ))}
          </div>
        </div>
        <div className="pdm__col">
          <h2 className="pdm__label">Shelf life</h2>
          <p className="pdm__shelf">{d.shelfLife}</p>
        </div>
        {/* 新增：BUY FROM 栏 */}
        <div className="pdm__col pdm__col--buy">
          <h2 className="pdm__label">Buy from</h2>
          <div className="pdm__buy">
            {(d.buyFrom ?? []).map((b) => {
              const Icon = ICONS[b.icon];
              return (
                <a
                  key={b.label}
                  className="pdm__buy-link"
                  href={b.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Buy on ${b.label}`}
                >
                  <Icon />
                </a>
              );
            })}
          </div>
        </div>
      </section>
       
    </div>
  );
}