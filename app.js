const express = require("express");
const router = require("./router.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const markdown = require("marked");
const csrf = require("csurf");
const app = express();
const sanitizeHTML = require("sanitize-html");

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use("/api", require("./router-api"));

let sessionOptions = session({
  secret: "JavaScript is soooooooooo cool",
  store: new MongoStore({ client: require("./db") }),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24, httpOnly: true },
});

app.use(sessionOptions);
app.use(flash());
app.set("views", "views");
app.set("view engine", "ejs");
app.use(function (req, res, next) {
  res.locals.filterUserHTML = (content) => {
    return sanitizeHTML(markdown.parse(content), {
      allowedTags: ["p", "br", "ul", "ol", "li", "strong", "bold", "i"],
    });
  };

  //make all error and success flash messages available from all routes
  res.locals.errors = req.flash("errors");
  res.locals.success = req.flash("success");
  res.locals.csrfErrors = req.flash("csrfErrors");

  if (req.session.user) {
    req.visitorId = req.session.user._id;
  } else {
    req.visitorId = 0;
  }

  // make usr session data available from within view templates
  res.locals.user = req.session.user;
  next();
});
app.use(express.static("public"));
app.use(csrf());
app.use(function (req, res, next) {
  res.locals.csrfToken = req.csrfToken();
  next();
});
app.use("/", router);

app.use(function (err, req, res, next) {
  console.log("comes to middleware");
  if (err) {
    console.log(err);
    if (err.code == "EBADCSRFTOKEN") {
      // console.log(err);

      req.flash("csrfErrors", "Cross site request forgery detected.");
      req.session.save(() => {
        res.redirect("/");
      });
    } else {
      res.render("404");
    }
  }
});

const server = require("http").createServer(app);
const io = require("socket.io")(server);

io.use(function (socket, next) {
  sessionOptions(socket.request, socket.request.res, next);
});

io.on("connection", (socket) => {
  if (socket.request.session.user) {
    let user = socket.request.session.user;
    socket.emit("welcome", { username: user.username, avatar: user.avatar });
    socket.on("chatMessageFromBrowser", function (data) {
      socket.broadcast.emit("chatMessageFromServer", {
        message: sanitizeHTML(data.message, {
          allowedTags: [],
          allowedAttributes: {},
        }),
        username: user.username,
        avatar: user.avatar,
      });
    });
  }
});
module.exports = server;
