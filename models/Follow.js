const { ObjectId } = require("mongodb");

const usersCollection = require("../db").db().collection("users");
const followsCollection = require("../db").db().collection("follows");
const User = require("./User");
let Follow = function (followedUsername, authorId) {
  this.followedUsername = followedUsername;
  this.authorId = authorId;
  this.errors = [];
};

Follow.prototype.cleanUp = function () {
  if (typeof this.followedUsername != "string") {
    this.followedUsername = "";
  }
};
Follow.prototype.validate = function (action) {
  return new Promise((resolve, reject) => {
    usersCollection
      .findOne({ username: this.followedUsername })
      .then((followedAccount) => {
        if (followedAccount) {
          this.followedId = followedAccount._id;
          followsCollection
            .findOne({
              followedId: this.followedId,
              authorId: new ObjectId(this.authorId),
            })
            .then((doesFollowAlreadyExist) => {
              console.log("comes to check");
              console.log(doesFollowAlreadyExist);
              console.log(action);
              if (doesFollowAlreadyExist && action == "create") {
                console.log("error created");
                this.errors.push("This account is already followed");
                reject();
              } else if (!doesFollowAlreadyExist && action == "delete") {
                this.errors.push("You don't follow this person");
                reject();
              } else if (this.followedId.equals(this.authorId)) {
                this.errors.push("You cannot follow yourself");
                reject();
              } else {
                resolve();
              }
            })
            .catch(() => {
              if (action == "delete") {
                this.errors.push("You don't follow this person");
                reject();
              }
            });
        } else {
          this.errors.push("You cannot follow user that doesn't exist");
          reject();
        }
      })
      .catch(() => {
        this.errors.push("You cannot follow user that doesn't exist");
        reject();
      });
  });
};
Follow.prototype.create = function () {
  return new Promise((resolve, reject) => {
    this.cleanUp();
    this.validate("create")
      .then(() => {
        if (!this.errors.length) {
          followsCollection
            .insertOne({
              followedId: this.followedId,
              authorId: new ObjectId(this.authorId),
            })
            .then(() => {
              resolve();
            })
            .catch(() => {
              this.errors.push("There was a problem with the database");
              reject(this.errors);
            });
        } else {
          reject(this.errors);
        }
      })
      .catch(() => {
        reject(this.errors);
      });
  });
};

Follow.prototype.delete = function () {
  return new Promise((resolve, reject) => {
    this.cleanUp();
    this.validate("delete")
      .then(() => {
        if (!this.errors.length) {
          followsCollection
            .deleteOne({
              followedId: this.followedId,
              authorId: new ObjectId(this.authorId),
            })
            .then(() => {
              resolve();
            })
            .catch(() => {
              this.errors.push("There was a problem with the database");
              reject(this.errors);
            });
        } else {
          reject(this.errors);
        }
      })
      .catch(() => {
        reject(this.errors);
      });
  });
};

Follow.isVisitorFollowing = function (followedId, visitorId) {
  return new Promise((resolve, reject) =>
    followsCollection
      .findOne({
        followedId: followedId,
        authorId: new ObjectId(visitorId),
      })
      .then((followDoc) => {
        console.log(followDoc);
        if (followDoc) {
          resolve(true);
        } else {
          reject(false);
        }
      })
      .catch(() => {
        reject(false);
      })
  );
};

Follow.getFollowersById = function (id) {
  return new Promise((resolve, reject) => {
    followsCollection
      .aggregate([
        {
          $match: { followedId: id },
        },
        {
          $lookup: {
            from: "users",
            localField: "authorId",
            foreignField: "_id",
            as: "userDoc",
          },
        },
        {
          $project: {
            username: { $arrayElemAt: ["$userDoc.username", 0] },
            email: { $arrayElemAt: ["$userDoc.email", 0] },
          },
        },
      ])
      .toArray()
      .then((followers) => {
        followers = followers.map((follower) => {
          //Create a user
          let user = new User(follower, true);
          return { username: follower.username, avatar: user.avatar };
        });
        resolve(followers);
      })
      .catch(() => {
        reject();
      });
  });
};

Follow.getFollowingsById = function (id) {
  return new Promise((resolve, reject) => {
    followsCollection
      .aggregate([
        {
          $match: { authorId: id },
        },
        {
          $lookup: {
            from: "users",
            localField: "followedId",
            foreignField: "_id",
            as: "userDoc",
          },
        },
        {
          $project: {
            username: { $arrayElemAt: ["$userDoc.username", 0] },
            email: { $arrayElemAt: ["$userDoc.email", 0] },
          },
        },
      ])
      .toArray()
      .then((following) => {
        following = following.map((follower) => {
          //Create a user
          let user = new User(follower, true);
          return { username: follower.username, avatar: user.avatar };
        });
        resolve(following);
      })
      .catch(() => {
        reject();
      });
  });
};

Follow.countFollowersById = function (id) {
  return new Promise((resolve, reject) => {
    followsCollection
      .countDocuments({ followedId: id })
      .then((count) => {
        resolve(count);
      })
      .catch(() => reject());
  });
};

Follow.countFollowingById = function (id) {
  return new Promise((resolve, reject) => {
    followsCollection
      .countDocuments({ authorId: id })
      .then((count) => {
        resolve(count);
      })
      .catch(() => reject());
  });
};

module.exports = Follow;
