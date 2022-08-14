const express = require("express");
const app = express();
app.get("/", (req, res) => {
  res.send("LET'S DO THIS");
});
app.listen(3000, () => console.log("Server running on port 3000"));
