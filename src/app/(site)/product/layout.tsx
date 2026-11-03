import "@/components/site/product/product.css";

/** The product pages share the (site) layout's nav and footer; this layer only adds their stylesheet. */
export default function ProductLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
