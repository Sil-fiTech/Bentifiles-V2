import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  reactCompiler: true,
  allowedDevOrigins: ["192.168.15.5"],
  // A documentação (/docs) é escrita em MDX: src/content/docs/<secao>/<pagina>.mdx
  pageExtensions: ["ts", "tsx", "md", "mdx"],
};

// remark-gfm: tabelas e demais extensões do GitHub Markdown. Como string, para funcionar com Turbopack.
const withMDX = createMDX({
  options: { remarkPlugins: ["remark-gfm"] },
});

export default withMDX(nextConfig);
