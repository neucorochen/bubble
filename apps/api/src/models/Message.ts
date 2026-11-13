import { Schema, model } from "mongoose";

const messageSchema = new Schema({
  conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
  sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, default: "", maxlength: 1000 },
  musicTrackIds: {
    type: [{ type: Schema.Types.ObjectId, ref: "MusicTrack" }],
    validate: {
      validator: (ids: unknown[]) => ids.length <= 10 && new Set(ids.map(String)).size === ids.length,
      message: "Music attachments must contain at most 10 distinct tracks",
    },
  },
  imageIds: { type: [{ type: Schema.Types.ObjectId, ref: "MessageImage" }], default: [] },
  clientMessageId: { type: String },
  createdAt: { type: Date, default: Date.now },
});

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ imageIds: 1 });

export const Message = model("Message", messageSchema);
