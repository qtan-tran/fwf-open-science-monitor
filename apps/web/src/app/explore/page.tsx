import type { Metadata } from "next";
import { ExploreView } from "@/components/explore/ExploreView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Explore" };

export default function ExplorePage() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Explore</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Browse 10 pre-computed metric views across the FWF dataset.
        </p>
      </div>
      <ExploreView />
    </div>
  );
}
