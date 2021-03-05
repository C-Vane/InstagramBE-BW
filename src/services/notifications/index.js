const express = require("express");

const mongoose = require("mongoose");

const { authorize } = require("../auth/middleware");

const UserSchema = require("../users/schema");

const Notification = require("./schema");

const route = express.Router();

const q2m = require("query-to-mongo");

route.post("/acceptFollow/:id", authorize, async (req, res, next) => {
  try {
    //user that requested the follow and add to his following list and also add to current user followers listEndpoints
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { viewed: true },
      {
        new: true,
        useFindAndModify: false,
      }
    );

    if (notification && notification.action === "asked to follow you") {
      const from = await UserSchema.findByIdAndUpdate(
        notification.from,
        {
          $push: { following: req.user._id },
        },
        {
          new: true,
          useFindAndModify: false,
        }
      );
      if (from) {
        req.user.followers = [...req.user.followers, from._id];
        await req.user.save();
        const newNotification = new Notification({ from: req.user._id, to: from._id, action: "accepted your follow request" });
        await newNotification.save();
        console.log(req.user, from);
        res.status(201).send({ ok: true });
      } else {
        const err = new Error("User not found");
        err.status = 404;
        next(err);
      }
    } else {
      const err = new Error("Wrong notification Provided");
      err.status = 404;
      next(err);
    }
  } catch (error) {
    next(error);
  }
});
route.get("/", authorize, async (req, res, next) => {
  try {
    const query = q2m(req.query);
    const total = await Notification.countDocuments({ to: req.user._id });
    const notification = await Notification.find({ to: req.user._id })
      .sort({ createdAt: -1 })
      .skip(query.options.skip)
      .limit(query.options.limit)
      .populate("from", "-password -refreshTokens -email -followers -following -saved -puts -tagged -posts")
      .populate("post");

    const links = query.links("/notification", total);
    res.status(200).send({ notification, total, links });
  } catch (error) {
    next(error);
  }
});

route.post("/view/:id", authorize, async (req, res, next) => {
  try {
    //set viewd true and return ok true
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { viewed: true },
      {
        new: true,
        useFindAndModify: false,
      }
    );
    notification && res.status(201).send({ notification, ok: true });
  } catch (error) {
    next(error);
  }
});
module.exports = route;
