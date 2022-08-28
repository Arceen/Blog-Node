const { ObjectId } = require("mongodb");
const { version } = require("webpack");
const User = require("./User");
const sanitizeHTML = require("sanitize-html");
const postsCollection = require("../db").db().collection("posts");
const followsCollection = require("../db").db().collection("follows");

let Post = function (data, userid, requestedPostId) {
  console.log(userid);
  this.data = data;
  this.errors = [];
  this.userid = userid;
  this.requestedPostId = requestedPostId;
};

Post.prototype.cleanUp = function () {
  if (typeof this.data.title != "string") {
    this.data.title = "";
  }
  if (typeof this.data.body != "string") {
    this.data.body = "";
  }
  this.data = {
    title: sanitizeHTML(this.data.title.trim(), {
      allowedTags: [],
      allowedAttributes: [],
    }),
    body: sanitizeHTML(this.data.body.trim(), {
      allowedTags: [],
      allowedAttributes: [],
    }),
    createdDate: new Date(),
    author: new ObjectId(this.userid),
  };
};

Post.prototype.validate = function () {
  if (this.data.title == "") {
    this.errors.push("You must provide a title");
  }
  if (this.data.body == "") {
    this.errors.push("You must provide post content.");
  }
};

Post.prototype.create = function () {
  return new Promise((resolve, reject) => {
    this.cleanUp();
    this.validate();
    if (!this.errors.length) {
      postsCollection
        .insertOne(this.data)
        .then((data) => {
          resolve(data);
        })
        .catch(() => {
          this.errors.push("Please try again later");
          reject(this.errors);
        });
    } else {
      reject(this.errors);
    }
  });
};

Post.prototype.update = function () {
  return new Promise(async (resolve, reject) => {
    Post.findSingleById(this.requestedPostId, this.userid)
      .then((post) => {
        if (post.isVisitorOwner) {
          this.actuallyUpdate()
            .then((status) => {
              resolve(status);
            })
            .catch(() => {
              reject();
            });
        } else {
          reject();
        }
      })
      .catch(() => {
        reject();
      });
  });
};

Post.prototype.actuallyUpdate = function () {
  return new Promise(async (resolve, reject) => {
    this.cleanUp();
    this.validate();
    if (!this.errors.length) {
      postsCollection
        .findOneAndUpdate(
          { _id: new ObjectId(this.requestedPostId) },
          { $set: { title: this.data.title, body: this.data.body } }
        )
        .then(() => {
          resolve("success");
        })
        .catch(() => {
          resolve("failure");
        });
    } else {
      resolve("failure");
    }
  });
};

Post.reusablePostQuery = (
  uniqueOperations,
  visitorId,
  finalOperations = []
) => {
  return new Promise(async function (resolve, reject) {
    let aggOperations = uniqueOperations
      .concat([
        {
          $lookup: {
            from: "users",
            localField: "author",
            foreignField: "_id",
            as: "authorDocument",
          },
        },
        {
          $project: {
            title: 1,
            body: 1,
            createdDate: 1,
            authorId: "$author",
            author: { $arrayElemAt: ["$authorDocument", 0] },
          },
        },
      ])
      .concat(finalOperations);
    postsCollection
      .aggregate(aggOperations)
      .toArray()
      .then((posts) => {
        posts = posts.map((item) => {
          console.log("Here in reusablePostQuery0");
          console.log(item.authorId);
          console.log(visitorId);
          item.isVisitorOwner = item.authorId.equals(visitorId);
          item.authorId = undefined;
          item.author = {
            username: item.author.username,
            avatar: new User(item.author, true).avatar,
          };
          return item;
        });
        resolve(posts);
      });
  });
};

Post.findSingleById = function (id, visitorId) {
  return new Promise(async function (resolve, reject) {
    if (typeof id != "string" || !ObjectId.isValid(id)) {
      reject();
      return;
    }
    console.log("here in findSingle");
    console.log(visitorId);
    Post.reusablePostQuery(
      [{ $match: { _id: new ObjectId(id) } }],
      visitorId
    ).then((posts) => {
      console.log(posts[0]);
      if (posts.length) {
        resolve(posts[0]);
      } else {
        reject();
      }
    });
  });
};

Post.findByAuthorId = (authorId) => {
  return Post.reusablePostQuery([
    { $match: { author: authorId } },
    { $sort: { createdDate: -1 } },
  ]);
};

Post.delete = function (postIdToDelete, currentUserId) {
  return new Promise(async (resolve, reject) => {
    Post.findSingleById(postIdToDelete, currentUserId)
      .then((post) => {
        if (post.isVisitorOwner) {
          postsCollection
            .deleteOne({ _id: new ObjectId(postIdToDelete) })
            .then(() => resolve())
            .catch(() => reject());
        } else {
          reject();
        }
      })
      .catch(() => {
        reject();
      });
  });
};

Post.search = function (searchTerm) {
  return new Promise((resolve, reject) => {
    if (typeof searchTerm == "string") {
      Post.reusablePostQuery(
        [{ $match: { $text: { $search: searchTerm } } }],
        undefined,
        [{ $sort: { score: { $meta: "textScore" } } }]
      )
        .then((posts) => {
          resolve(posts);
        })
        .catch(() => {
          reject();
        });
    } else {
      reject();
    }
  });
};

Post.countPostsByAuthor = function (id) {
  return new Promise((resolve, reject) => {
    postsCollection
      .countDocuments({ author: id })
      .then((count) => {
        resolve(count);
      })
      .catch(() => reject());
  });
};

Post.getFeed = function (id) {
  //create an array the user ids that the current user follows
  return new Promise((resolve, reject) => {
    followsCollection
      .find({ authorId: new ObjectId(id) })
      .toArray()
      .then((followings) => {
        console.log("comes to find followings");
        followings = followings.map((followDoc) => followDoc.followedId);
        Post.reusablePostQuery([
          { $match: { author: { $in: followings } } },
          { $sort: { createdDate: -1 } },
        ])
          .then((posts) => {
            resolve(posts);
          })
          .catch(() => {
            reject();
          });
      })
      .catch(() => {
        reject();
      });
  });
};

module.exports = Post;
