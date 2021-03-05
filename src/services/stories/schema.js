const mongoose = require("mongoose");
const { Schema } = require("mongoose");

const StorySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    text: {
      type: String,
    },
    image: {
      type: String,
      required: false,
    },
    video: {
      type: String,
      required: false,
    },
    duration: {
      type: Number,
      min: 10,
      max: 30,
      default: 10,
    },
    exclude: [
      {
        type: Schema.Types.ObjectId,
        ref: "Users",
        required: true,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Story", StorySchema);
