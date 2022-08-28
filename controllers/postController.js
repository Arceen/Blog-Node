const Post = require("../models/Post");
exports.viewCreateScreen = function (req, res) {
  res.render("create-post");
};

exports.create = (req, res) => {
  let post = new Post(req.body, req.session.user._id);
  post
    .create()
    .then((data) => {
      req.flash("success", "New post successfully created.");
      console.log("=-----------------------");
      console.log(data);
      req.session.save(() => res.redirect(`/post/${data.insertedId}`));
    })
    .catch((err) => {
      errors.forEach((error) => req.flash("errors", error));
      req.session.save(() => res.redirect("/create-post"));
    });
};

exports.viewSingle = function (req, res) {
  Post.findSingleById(req.params.id, req.visitorId)
    .then((post) => {
      res.render("single-post-screen", { post: post, title: post.title });
    })
    .catch((err) => {
      res.render("404");
    });
};

exports.viewEditScreen = function (req, res) {
  Post.findSingleById(req.params.id, req.visitorId)
    .then((post) => {
      console.log("view Edit screen");
      console.log(req.visitorId);
      console.log(post);
      console.log(post.authorId);
      if (post.isVisitorOwner) {
        res.render("edit-post", { post: post });
      } else {
        req.flash(
          "errors",
          "You do not have permission to perform this action"
        );
        req.session.save(() => res.redirect("/"));
      }
    })
    .catch(() => res.render("404"));
};

exports.edit = (req, res) => {
  let post = new Post(req.body, req.visitorId, req.params.id);
  post
    .update()
    .then((status) => {
      if (status == "success") {
        req.flash("success", "Post successfully updated.");
        req.session.save(() => {
          res.redirect(`/post/${req.params.id}/edit`);
        });
      } else {
        post.errors.forEach(function () {
          req.flash("errors", error);
        });
        req.session.save(() => {
          res.redirect(`post/${req.params.id}/edit`);
        });
      }
    })
    .catch(() => {
      req.flash("errors", "You do not have permission to perform that action.");
      res.redirect("/");
    });
};

exports.delete = function (req, res) {
  Post.delete(req.params.id, req.visitorId)
    .then(() => {
      req.flash("success", "Post successfully deleted.");
      req.session.save(() => {
        res.redirect(`/profile/${req.session.user.username}`);
      });
    })
    .catch(() => {
      req.flash("errors", "You do not have permission to perform that action");
      req.session.save(() => res.redirect("/"));
    });
};

exports.search = function (req, res) {
  Post.search(req.body.searchTerm)
    .then((posts) => {
      res.json(posts);
    })
    .catch(() => {
      res.json([]);
    });
};

exports.apiCreate = (req, res) => {
  console.log("API user id");
  console.log(req.apiUser._id);
  let post = new Post(req.body, req.apiUser._id);
  post
    .create()
    .then((data) => {
      res.json("Congrats. Your post has been created.");
    })
    .catch((err) => {
      res.json(err);
    });
};

exports.apiDelete = function (req, res) {
  Post.delete(req.params.id, req.apiUser._id)
    .then(() => {
      res.json("Success. You deleted the post");
    })
    .catch(() => {
      res.json("Sorry could not delete the post");
    });
};
