import { Schema, model } from "mongoose";

const userMusicSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    trackId: {
      type: Schema.Types.ObjectId,
      ref: "MusicTrack",
      required: true,
    },
  },
  { timestamps: true },
);

// Один пользователь не может добавить один трек в библиотеку дважды.
userMusicSchema.index({ userId: 1, trackId: 1 }, { unique: true });

// Получение личной библиотеки с сортировкой по дате добавления.
userMusicSchema.index({ userId: 1, createdAt: -1 });

export const UserMusic = model("UserMusic", userMusicSchema);
