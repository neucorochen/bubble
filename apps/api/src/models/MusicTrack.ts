import { Schema, model } from "mongoose";

const musicTrackSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    artist: { type: String, required: true, trim: true, maxlength: 200 },
    storageKey: { type: String, required: true, unique: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 1 },
    duration: { type: Number, default: null, min: 0 },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

musicTrackSchema.index({ title: 1 });
musicTrackSchema.index({ artist: 1 });
musicTrackSchema.index({ title: "text", artist: "text" });

export const MusicTrack = model("MusicTrack", musicTrackSchema);
