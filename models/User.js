const bcrypt = require("bcryptjs");
const userCollection = require("../db").db().collection("users");
const validator = require("validator");
const md5 = require("md5");
let User = function (data, getAvatar = false) {
  this.data = data;
  this.errors = [];
  if (getAvatar) {
    this.getAvatar();
  }
};

User.prototype.cleanUp = function () {
  if (typeof this.data.username != "string") this.data.username = "";
  if (typeof this.data.password != "string") this.data.password = "";
  if (typeof this.data.email != "string") this.data.email = "";

  this.data = {
    username: this.data.username.trim().toLowerCase(),
    email: this.data.email.trim().toLowerCase(),
    password: this.data.password.trim(),
  };
};

User.prototype.validate = function () {
  return new Promise(async (resolve, reject) => {
    console.log(this.data);
    console.log("validate gets called");
    if (this.data.username == "") {
      this.errors.push("You must provide a valid username");
    }
    if (this.data.email == "") {
      this.errors.push("You must provide a valid email");
    }
    if (this.data.password == "") {
      this.errors.push("You must provide a valid password");
    }
    if (this.data.username.length < 3) {
      this.errors.push("Your username must contain at least 3 characters");
    }
    if (this.data.password.length < 6) {
      this.errors.push("Password must contain at least 6 characters");
    }
    if (this.data.username.length > 99) {
      this.errors.push("Your username must be less than 100 characters");
    }
    if (!validator.isAlphanumeric(this.data.username)) {
      this.errors.push("Your username must only contain numbers or letters");
    }
    if (this.data.password.length > 50) {
      this.errors.push("Your password must be less than 50 characters");
    }
    if (!validator.isEmail(this.data.email)) {
      this.errors.push("You must provide a valid email address");
    }
    if (
      this.data.username.length > 2 &&
      this.data.username.length < 50 &&
      validator.isAlphanumeric(this.data.username)
    ) {
      let usernameExists = await userCollection.findOne({
        username: this.data.username,
      });
      if (usernameExists) {
        this.errors.push("That username is already taken");
      }
    }

    if (
      this.data.email.length > 2 &&
      this.data.email.length < 50 &&
      validator.isEmail(this.data.email)
    ) {
      let emailExists = await userCollection.findOne({
        email: this.data.email,
      });
      if (emailExists) {
        this.errors.push("That email is already being used");
      }
    }
    resolve();
    console.log(this.errors);
  });
};

User.prototype.login = function () {
  return new Promise((resolve, reject) => {
    this.cleanUp();
    userCollection
      .findOne({ username: this.data.username })
      .then((attemptedUser) => {
        if (
          attemptedUser &&
          bcrypt.compareSync(this.data.password, attemptedUser.password)
        ) {
          this.data = attemptedUser;
          this.getAvatar();
          resolve("Gratzi!");
        } else {
          reject("Invalid username / password");
        }
      })
      .catch((err) => console.log(err));
  });
};

User.prototype.register = function () {
  return new Promise(async (resolve, reject) => {
    this.cleanUp();
    await this.validate();
    if (!this.errors.length) {
      let salt = bcrypt.genSaltSync(10);
      this.data.password = bcrypt.hashSync(this.data.password, salt);
      console.log(this.data.password);
      await userCollection.insertOne(this.data);
      this.getAvatar();
      resolve();
    } else {
      reject(this.errors);
    }
  });
};

User.prototype.getAvatar = function () {
  this.avatar = `https://gravatar.com/avatar/${md5(this.data.email)}`;
};

User.findByUsername = function (username) {
  return new Promise((resolve, reject) => {
    if (typeof username != "string") {
      reject();
      return;
    }
    userCollection
      .findOne({ username: username })
      .then((userDoc) => {
        if (userDoc) {
          userDoc = new User(userDoc, true);
          userDoc = {
            _id: userDoc.data._id,
            username: userDoc.data.username,
            avatar: userDoc.avatar,
          };
          resolve(userDoc);
        } else {
          reject();
        }
      })
      .catch(() => reject());
  });
};

User.doesEmailExist = function (email) {
  console.log(email);
  return new Promise((resolve, reject) => {
    if (typeof email != "string") {
      console.log("inside resolve");
      reject();
      return;
    }
    console.log(email);
    //correct
    userCollection
      .findOne({ email: email })
      .then((user) => {
        if (user) {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .catch(() => {
        reject();
      });
  });
};

module.exports = User;
