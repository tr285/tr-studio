import React from "react";
import { ProjectStoryLoader } from "@/components/studio/project-story-loader";

interface StudioScreenplayPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function StudioScreenplayPage({
  params,
}: StudioScreenplayPageProps) {
  const { projectId } = await params;
  return (
    <ProjectStoryLoader projectId={projectId} defaultSection="screenplay" />
  );
}
