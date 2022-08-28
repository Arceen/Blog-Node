const dotenv = require("dotenv");
dotenv.config();
const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.CONNECTIONSTRING);

client.connect((err) => {
  module.exports = client;
  const app = require("./app");
  app.listen(process.env.PORT);
});
