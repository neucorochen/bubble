import { Schema, model } from "mongoose";

const schema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  storageKey: { type: String, required: true },
}, { timestamps: true });

export const MessageImage = model("MessageImage", schema);
