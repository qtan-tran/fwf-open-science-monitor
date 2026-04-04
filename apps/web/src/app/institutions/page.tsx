import type { Metadata } from "next";
import { getInstitutionRankings } from "@/lib/api-client";
import { InstitutionsView } from "@/components/institutions/InstitutionsView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Institutions" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function sp(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export default async function InstitutionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search  = sp(params.search);
  const country = sp(params.country);

  const institutions = await getInstitutionRankings({
    sortBy: "project_count",
    limit:  300,
    country: country || undefined,
  }).catch(() => []);

  return (
    <InstitutionsView
      institutions={institutions}
      currentSearch={search}
      currentCountry={country}
    />
  );
}
