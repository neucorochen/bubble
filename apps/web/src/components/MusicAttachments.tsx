import type { MusicAttachmentDTO, MusicTrackDTO } from "@commune/shared";
import MusicTrackList from "./MusicTrackList";

export default function MusicAttachments({ attachments, source }: { attachments: MusicAttachmentDTO[]; source: string }) {
  const tracks: MusicTrackDTO[] = attachments.flatMap((item) => item.unavailable ? [] : [{ ...item, mimeType: "", size: 0, addedAt: null, addedByMe: false }]);
  return <div className="music-attachments"><MusicTrackList tracks={tracks} source={source} order={attachments.map((item) => item.id)} /></div>;
}
