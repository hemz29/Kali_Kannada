import type { NextConfig } from "next";

const FOURTEEN_DAYS = 14 * 24 * 60 * 60;

const nextConfig: NextConfig = {
  // The ready-made worksheet PDFs are kept for 14 days by browsers and Vercel's CDN. Links to them carry the app version
  // (?v=…, see api/download), so a new deploy with rebuilt worksheets is fetched once and then cached again.
  async headers() {
    return [
      {
        source: "/worksheets/:file*",
        headers: [{ key: "Cache-Control", value: `public, max-age=${FOURTEEN_DAYS}, s-maxage=${FOURTEEN_DAYS}, stale-while-revalidate=86400` }],
      },
    ];
  },
};

export default nextConfig;
