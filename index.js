const express = require("express");
const addComponent = require("./components/add");

const app = express();
app.use(express.json());
const port = 4000;

const asyncMiddleware = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

app.get("/", (req, res) => res.send("🤔insightfulDB 🤔"));
app.post("/add", asyncMiddleware(addComponent));

app.listen(port, () => console.log(`insightfulDB listening on port ${port}!`));
