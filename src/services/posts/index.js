const express = require("express");
const PostModel = require("./schema");
const UserSchema = require("./schema");
const postRouter = express.Router();
const multer = require("multer");
const cloudinary = require("../../cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const Notification = require("../notifications/schema");

const q2m = require("query-to-mongo");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Instagram",
    public_id: (req, res) => `${req.user.username}_${req.params.id}`,
  },
});
const cloudinaryMulter = multer({ storage: storage });
const { authorize } = require("../auth/middleware");

postRouter.post("/", authorize, async (req, res, next) => {
  try {
    const newPost = new PostModel({ ...req.body, user: req.user._id });
    const savedPost = await newPost.save();
    /* if (req.body.tags) {
      let notification;
      req.body.tags.forEach(async (userID) => {
        //create notification for each user
        notification = new Notification({ from: req.user._id, to: userID, post: savedPost._id, action: "tagged you" });
        await notification.save();
        await UserSchema.findByIdAndUpdate(
          userID,
          {
            $push: { tagged: sevedPost._id },
          },
          {
            new: true,
            useFindAndModify: false,
          }
        );
      });
    } */

    res.status(201).send({ post: savedPost, ok: true });
  } catch (error) {
    console.log(error);
    next(error);
  }
});

postRouter.get("/home", authorize, async (req, res, next) => {
  try {
    const following = req.user.following;
    const follow = following.map((followed_user) => {
      return { user: followed_user };
    });
    const query = q2m(req.query);
    const total = await PostModel.countDocuments({ $or: [...follow, { user: req.user._id }] });
    const allPosts = await PostModel.find({ $or: [...follow, { user: req.user._id }] })
      .sort({ createdAt: -1 })
      .skip(query.options.skip)
      .limit(query.options.limit)
      .populate("comments.user", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts")
      .populate("tags", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts")
      .populate("user", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts");
    const links = query.links("/posts/home", total);
    res.status(200).send({ posts: allPosts, total, links });
  } catch (error) {
    next(error);
  }
});
postRouter.get("/explore", authorize, async (req, res, next) => {
  try {
    const following = req.user.following;
    const follow = following.map((followed_user) => {
      return { user: { $ne: followed_user } };
    });
    const query = q2m(req.query);
    const total = await PostModel.countDocuments({ $and: [...follow, { user: { $ne: req.user._id } }] });
    const allPosts = await PostModel.find({ $and: [...follow, { user: { $ne: req.user._id } }] })
      .sort({ createdAt: -1 })
      .skip(query.options.skip)
      .limit(query.options.limit)
      .populate("comments.user", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts")
      .populate("tags", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts")
      .populate("user", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts");
    const links = query.links("/posts/explore", total);
    res.status(200).send({ posts: allPosts, total, links });
  } catch (error) {
    next(error);
  }
});
postRouter.get("/:id", authorize, async (req, res, next) => {
  try {
    const post = await PostModel.findById(req.params.id)
      .populate("comments.user", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts")
      .populate("tags", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts")
      .populate("user", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts");
    if (post._id) {
      console.log(post);
      if (post.user.private) {
        res.status(200).send(post);
      } else {
        res.send.status(201).send(post);
      }
      res.status(403).send(`@${post.user.username}'s posts are private`);
    } else {
      const error = new Error("Post not found");
      error.status = 404;
      next(error);
    }
  } catch (error) {
    next(error);
  }
});

postRouter.delete("/:id", authorize, async function (req, res, next) {
  try {
    await PostModel.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.status(201).send({ ok: true });
  } catch (error) {
    next(error);
  }
});
postRouter.put("/:id", authorize, async function (req, res, next) {
  try {
    const updated = await PostModel.findOneAndUpdate({ _id: req.params.id, user: req.user }, req.body);

    if (req.body.tags && req.body.tags.length > 0 && updated) {
      req.body.tags.forEach(async (userID) => {
        const user = await UserSchema.findOne({ _id: userID, tagged: req.params.id });
        user
          ? await UserSchema.findByIdAndUpdate(
              userID,
              {
                $pull: { tagged: sevedPost._id },
              },
              {
                new: true,
                useFindAndModify: false,
              }
            )
          : await UserSchema.findByIdAndUpdate(
              userID,
              {
                $push: { tagged: sevedPost._id },
              },
              {
                new: true,
                useFindAndModify: false,
              }
            );
        if (!user) {
          notification = new Notification({ from: req.user._id, to: userID, post: updated._id, action: "tagged you" });
          await notification.save();
        }
      });
    }
    res.send(updated);
  } catch (error) {
    next(error);
  }
});
postRouter.put("/:id/picture", authorize, cloudinaryMulter.single("image"), async (req, res, next) => {
  try {
    console.log(req.file);
    const updatedPost = await PostModel.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { images: req.file.path }, { runValidators: true, new: true })
      .populate("comments.user", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts")
      .populate("tags", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts")
      .populate("user", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts");

    res.send(updatedPost);
  } catch (error) {
    next(error);
  }
});

postRouter.post("/:id/like", authorize, async (req, res, next) => {
  try {
    const post = await PostModel.findOne({ _id: req.params.id, likes: req.user._id });

    const modifiedPost = post
      ? await PostModel.findByIdAndUpdate(
          req.params.id,
          {
            $pull: { likes: req.user._id },
          },
          {
            new: true,
            useFindAndModify: false,
          }
        )
      : await PostModel.findByIdAndUpdate(
          req.params.id,
          {
            $push: { likes: req.user._id },
          },
          {
            new: true,
            useFindAndModify: false,
          }
        );

    if (!post && modifiedPost) {
      notification = new Notification({ from: req.user._id, to: modifiedPost.user._id, post: req.params._id, action: "liked your post" });
      await notification.save();
    }
    res
      .status(201)
      .send(
        modifiedPost
          .populate("comments.user", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts")
          .populate("tags", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts")
          .populate("user", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts")
      );
  } catch (error) {
    next(error);
  }
});
module.exports = postRouter;
