const User = require("../models/User");
const Post = require("../models/Post");
const Follow = require("../models/Follow");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");

exports.apiGetPostsByUsername = function (req, res) {
  console.log("APIGETPOSTSBYUSERNAME");
  console.log(req.params.username);
  User.findByUsername(req.params.username)
    .then((authorDoc) => {
      console.log(authorDoc);
      Post.findByAuthorId(authorDoc._id)
        .then((posts) => {
          console.log(posts);
          res.json(posts);
        })
        .catch(() => {
          console.log("Could not get posts");
          res.json("Could not get posts");
        });
    })
    .catch(() => {
      console.log("Invalid user");
      res.json("Sorry, invalid user requested.");
    });
};

exports.apiMustBeLoggedIn = function (req, res, next) {
  console.log("You going to api login");
  try {
    req.apiUser = jwt.verify(req.body.token, process.env.JWTSECRET);
    next();
  } catch {
    res.json("Sorry you must provide a valid token");
  }
};
exports.doesUsernameExist = function (req, res) {
  User.findByUsername(req.body.username)
    .then(() => {
      res.json(true);
    })
    .catch(() => {
      res.json(false);
    });
};

exports.doesEmailExist = function (req, res) {
  User.doesEmailExist(req.body.email)
    .then((bool) => {
      res.json(true);
    })
    .catch(() => {
      res.json(false);
    });
};

exports.sharedProfileData = function (req, res, next) {
  let isVisitorsProfile = false;
  let isFollowing = false;
  if (req.session.user) {
    isVisitorsProfile = req.profileUser._id.equals(req.session.user._id);
    Follow.isVisitorFollowing(req.profileUser._id, req.visitorId)
      .then((following) => {
        isFollowing = following;
      })
      .catch(() => {})
      .finally(async () => {
        req.isFollowing = isFollowing;
        req.isVisitorsProfile = isVisitorsProfile;
        let postCountPromise = Post.countPostsByAuthor(req.profileUser._id);
        let followerCountPromise = Follow.countFollowersById(
          req.profileUser._id
        );
        let followingCountPromise = Follow.countFollowingById(
          req.profileUser._id
        );
        let [postCount, followerCount, followingCount] = await Promise.all([
          postCountPromise,
          followerCountPromise,
          followingCountPromise,
        ]);
        req.postCount = postCount;
        req.followerCount = followerCount;
        req.followingCount = followingCount;
        next();
      });
  } else {
    next();
  }
};
exports.mustBeLoggedIn = function (req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.flash("errors", "You must be logged in to perform this action");
    req.session.save(function () {
      res.redirect("/");
    });
  }
};

exports.home = (req, res) => {
  if (req.session.user) {
    // fetch feed of posts for current user
    Post.getFeed(req.session.user._id)
      .then((posts) => {
        console.log("ate leas");
        res.render("home-dashboard", { posts: posts });
      })
      .catch(() => res.render("404"));
  } else {
    res.render("home-guest", {
      errors: req.flash("errors"),
      regErrors: req.flash("regErrors"),
    });
  }
};
exports.register = (req, res) => {
  let user = new User(req.body);
  user
    .register()
    .then(() => {
      req.session.user = {
        avatar: user.avatar,
        username: user.data.username,
        _id: user.data._id,
      };
      res.redirect("/");
    })
    .catch((regErrors) => {
      regErrors.forEach(function (error) {
        req.flash("regErrors", error);
      });
      req.session.save(function () {
        res.redirect("/");
      });
    });
};
exports.login = (req, res) => {
  let user = new User(req.body);
  user
    .login()
    .then((result) => {
      req.session.user = {
        avatar: user.avatar,
        username: user.data.username,
        _id: user.data._id,
      };
      req.session.save(function () {
        res.redirect("/");
      });
    })
    .catch((e) => {
      req.flash("errors", e);
      req.session.save(function () {
        res.redirect("/");
      });
    });
};
exports.logout = (req, res) => {
  req.session.destroy(function () {
    res.redirect("/");
  });
};

exports.ifUserExists = function (req, res, next) {
  User.findByUsername(req.params.username)
    .then((userDocument) => {
      req.profileUser = userDocument;

      next();
    })
    .catch(() => res.render("404"));
};
exports.profilePostsScreen = (req, res) => {
  Post.findByAuthorId(req.profileUser._id)
    .then((posts) => {
      res.render("profile", {
        title: `Profile for ${req.profileUser.username}`,
        currentPage: "posts",
        posts: posts,
        profileUsername: req.profileUser.username,
        profileAvatar: req.profileUser.avatar,
        isFollowing: req.isFollowing,
        isVisitorsProfile: req.isVisitorsProfile,
        counts: {
          postCount: req.postCount,
          followerCount: req.followerCount,
          followingCount: req.followingCount,
        },
      });
    })
    .catch(() => {
      res.render("404");
    });
  console.log(req.profileUser);
};

exports.profileFollowersScreen = function (req, res) {
  Follow.getFollowersById(req.profileUser._id)
    .then((followers) => {
      res.render("profile-followers", {
        currentPage: "followers",
        followers: followers,
        profileUsername: req.profileUser.username,
        profileAvatar: req.profileUser.avatar,
        isFollowing: req.isFollowing,
        isVisitorsProfile: req.isVisitorsProfile,
        counts: {
          postCount: req.postCount,
          followerCount: req.followerCount,
          followingCount: req.followingCount,
        },
      });
    })
    .catch(() => {
      res.render("404");
    });
};

exports.profileFollowingScreen = function (req, res) {
  Follow.getFollowingsById(req.profileUser._id)
    .then((following) => {
      res.render("profile-following", {
        currentPage: "following",
        following: following,
        profileUsername: req.profileUser.username,
        profileAvatar: req.profileUser.avatar,
        isFollowing: req.isFollowing,
        isVisitorsProfile: req.isVisitorsProfile,
        counts: {
          postCount: req.postCount,
          followerCount: req.followerCount,
          followingCount: req.followingCount,
        },
      });
    })
    .catch(() => {
      res.render("404");
    });
};

exports.apiLogin = function (req, res) {
  let user = new User(req.body);
  user
    .login()
    .then((result) => {
      res.json(
        jwt.sign({ _id: user.data._id }, process.env.JWTSECRET, {
          expiresIn: "7d",
        })
      );
    })
    .catch((e) => {
      res.json(e);
    });
};
