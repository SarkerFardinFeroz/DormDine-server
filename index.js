const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
// middleware
app.use(cors());
app.use(express.json());


app.get("/", (req, res) => {
    res.send("DormDine is running");
  });
  
  app.listen(port, () => {
    console.log(`DormDine is running on port ${port}`);
  });
