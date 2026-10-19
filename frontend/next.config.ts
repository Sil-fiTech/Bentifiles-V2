import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  reactCompiler: true,
  allowedDevOrigins: ["192.168.15.5"],
  // A documentação (/docs) é escrita em MDX: src/content/docs/<secao>/<pagina>.mdx
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // A landing responde na raiz ("/") em vez de redirecionar: o Google indexa a URL principal do site,
  // não um 307 para /landing. /landing segue funcionando (anúncios antigos), mas com 308 para "/".
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/landing" }], afterFiles: [], fallback: [] };
  },
  async redirects() {
    return [{ source: "/landing", destination: "/", permanent: true }];
  },
};

// remark-gfm: tabelas e demais extensões do GitHub Markdown. Como string, para funcionar com Turbopack.
const withMDX = createMDX({
  options: { remarkPlugins: ["remark-gfm"] },
});

export default withMDX(nextConfig);
