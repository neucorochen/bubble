import { useMutation } from "@tanstack/react-query";
import type { CreateReportInput, WallpaperDTO } from "@commune/shared";
import { api } from "../lib/api";
import { ReportFields } from "./ReportForm";

export default function WallpaperReport({
  item,
  onClose,
}: {
  item: WallpaperDTO;
  onClose: () => void;
}) {
  const report = useMutation({
    mutationFn: (body: CreateReportInput) =>
      api(`/wallpapers/${item.id}/report`, { method: "POST", body }),
  });
  return <ReportFields report={report} subject="фон" onClose={onClose} />;
}
