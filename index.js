require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.frd0xwu.mongodb.net/?retryWrites=true&w=majority`;

console.log(uri);
// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middleware

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  // console.log({ token });
  //no token available
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};
async function run() {
  try {
    // collections
    const userCollection = client.db("DormDineDB").collection("users");
    const mealsCollection = client.db("DormDineDB").collection("meals");
    const membershipCollection = client
      .db("DormDineDB")
      .collection("membership");

    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log("user for token", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: false,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // user related api
    app.get("/users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.put("/users/:id", async (req, res) => {
      const id = req.params.id;
      const subscription = req.body.subscription;
      const lowercaseSubscription = subscription.toLowerCase();
      console.log(lowercaseSubscription);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          subscription: lowercaseSubscription,
        },
      };
      const result = await userCollection.updateOne(filter,updateDoc,options)
      res.send(result)
    });
    // meals related api
    app.get("/meals", async (req, res) => {
      const result = await mealsCollection.find().toArray();
      res.send(result);
    });
    app.get("/meal-details/:id", async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await mealsCollection.findOne(query);
        res.send(result);
      
    });




    
    // membership related api
    app.get("/membership", async (req, res) => {
      const result = await membershipCollection.find().toArray();
      res.send(result);
    });
    // TODO: make payments things in last




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("DormDine is running");
});

app.listen(port, () => {
  console.log(`DormDine is running on port ${port}`);
});
