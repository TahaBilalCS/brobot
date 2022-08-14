const express = require("express");

const appBase = express();
const expressWs = require('express-ws')(appBase)

const app = expressWs.app;

app.get("/", (req, res) => {
  res.send("LET'S DO THIS");
});

app.ws('/', (ws, req) => {
  console.log("SOMEONE HERE")
  ws.on('message', (msg) => {
    console.log(msg)
  })
})

app.listen(3000, () => console.log("Server running on port 3000"));
