const express = require("express");
const mongoose = require("mongoose");
const { authorize } = require("../auth/middleware");

const Story = require("./schema");
const route = express.Router();

const cloudinary = require("cloudinary").v2;

const { CloudinaryStorage } = require("multer-storage-cloudinary");

const multer = require("multer");

const uniqid = require("uniqid");

const q2m = require("query-to-mongo");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Instagram",
    format: async (req, file) => "png" || "jpg",
    public_id: (req, file) => uniqid(req.user.username, "_stories"),
  },
});
const storageVideo = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Instagram",
    resource_type: "video",
    public_id: (req, file) => uniqid(req.user.username, "_stories"),
  },
});

const parserVideo = multer({ storage: storageVideo });
const parserImage = multer({ storage: storage });

route.post("/", authorize, async (req, res, next) => {
  try {
    const newStory = new Story({ ...req.body, user: req.user._id });
    await newStory.save();
    res.status(201).send(newStory._id);
  } catch (error) {
    next(error);
  }
});
route.put("/:id/media", authorize, parserVideo.single("video"), parserImage.single("image"), async (req, res, next) => {
  try {
    const modifiedStory = await Story.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { image: req.file.fieldname === "image" && req.file.path, video: req.file.fieldname === "video" && req.file.path },
      {
        runValidators: true,
        new: true,
        useFindAndModify: false,
      }
    );
    res.status(201).send(modifiedStory.populate("user", "-password -refreshTokens -email -followers -following -saved -puts -tagged"));
  } catch (error) {
    next(error);
  }
});

route.get("/", authorize, async (req, res, next) => {
  try {
    const query = req.user.following.map((followed_user) => {
      return { user: followed_user };
    });

    const stories = await Story.find({ exclude: { $nin: [req.user._id] }, $or: [...query, { _id: null }] })
      .sort({ createdAt: -1 })
      .populate("user", "-password -refreshTokens -email -followers -following -saved -posts -tagged");
    res.status(201).send(stories);
  } catch (error) {
    next(error);
  }
});

route.get("/:userId", authorize, async (req, res, next) => {
  try {
    const stories = await Story.find({ user: req.params.userId, exclude: { $nin: [req.user._id] } }).populate("user", "-password -refreshTokens -email -followers -following -saved -posts -tagged");
    res.status(200).send(stories);
  } catch (error) {
    next(error);
  }
});

route.put("/:id", authorize, async (req, res, next) => {
  try {
    const modifiedStory = await Story.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, {
      runValidators: true,
      new: true,
      useFindAndModify: false,
    });

    res.status(200).send(modifiedStory.populate("user", "-password -refreshTokens -email -followers -following -saved -puts -tagged"));
  } catch (error) {
    next(error);
  }
});

route.delete("/:id", authorize, async (req, res, next) => {
  try {
    await Story.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.status(200).send("DELETED");
  } catch (error) {
    next(error);
  }
});
module.exports = route;
