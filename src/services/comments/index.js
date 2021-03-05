const express = require("express");
const mongoose = require("mongoose");
const { authorize } = require("../auth/middleware");

const Notification = require("../notifications/schema");

const Comment = require("./schema");
const route = express.Router();

const q2m = require("query-to-mongo");
const PostModel = require("../posts/schema");

route.post("/:post", authorize, async (req, res, next) => {
  try {
    //when posting a comment get the post and add notification to the post owner
    const newComment = new Comment({ ...req.body, post: req.params.post, user: req.user._id });
    const { _id } = await newComment.save();
    const post = await PostModel.findByIdAndUpdate(req.params.post, { $push: { comments: _id } }, { runValidators: true, new: true }).populate(
      "user",
      "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts"
    );

    const notification = new Notification({ from: req.user._id, to: post.user._id, post: req.params.post, action: "left a comment" });
    await notification.save();

    res.status(201).send(post);
  } catch (error) {
    next(error);
  }
});

route.get("/:post", authorize, async (req, res, next) => {
  try {
    const comments = await Comment.find({ post: req.params.post }).sort({ createdAt: -1 }).populate("user", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts");
    res.status(201).send(comments);
  } catch (error) {
    next(error);
  }
});

route.put("/:id", authorize, async (req, res, next) => {
  try {
    const updatedComment = await Comment.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, {
      runValidators: true,
      new: true,
      useFindAndModify: false,
    }).populate("user", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts");
    if (updatedComment) res.status(201).send(updatedComment);
    else res.status(401).send("User not Authorized");
  } catch (error) {
    next(error);
  }
});
route.post("/:id/like", authorize, async (req, res, next) => {
  try {
    const comment = await Comment.findOne({ _id: req.params.id, likes: req.user._id });
    const modifiedComment = comment
      ? await Comment.findByIdAndUpdate(
          req.params.id,
          {
            $pull: { likes: req.user._id },
          },
          {
            new: true,
            useFindAndModify: false,
          }
        ).populate("user", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts")
      : await Comment.findByIdAndUpdate(
          req.params.id,
          {
            $push: { likes: req.user._id },
          },
          {
            new: true,
            useFindAndModify: false,
          }
        ).populate("user", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts");
    res.status(201).send(modifiedComment);
  } catch (error) {
    next(error);
  }
});

/* route.get("/:id", async (req, res, next) => {
  try {
    const sigleComment = await Comment.findById(req.params.id);

    res.status(200).send(sigleComment);
  } catch (error) {
    next(error);
  }
}); */

/* route.put("/:id", async (req, res, next) => {
  try {
    const modifiedComment = await Comment.findByIdAndUpdate(req.params.id, req.body, {
      runValidators: true,
      new: true,
      useFindAndModify: false,
    });

    res.status(200).send(modifiedComment);
  } catch (error) {
       next(error);
  }
});
 */
route.delete("/:id", authorize, async (req, res, next) => {
  try {
    await Comment.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.status(200).send("DELETED");
  } catch (error) {
    next(error);
  }
});
module.exports = route;
