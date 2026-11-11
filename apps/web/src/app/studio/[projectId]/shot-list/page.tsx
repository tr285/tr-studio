import React from "react";
import { ShotListStudio } from "@/components/studio/shot-list-studio";

export default async function StudioShotListPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ShotListStudio projectId={projectId} />;
}
