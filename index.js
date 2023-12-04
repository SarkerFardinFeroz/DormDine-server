require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.frd0xwu.mongodb.net/?retryWrites=true&w=majority`;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// middleware
app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // collections
    const userCollection = client.db("DormDineDB").collection("users");
    const mealsCollection = client.db("DormDineDB").collection("meals");
    const reviewsCollection = client.db("DormDineDB").collection("reviews");
    const cartsCollection = client.db("DormDineDB").collection("carts");
    const paymentCollection = client.db("DormDineDB").collection("payments");

    const membershipCollection = client
      .db("DormDineDB")
      .collection("membership");
    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // user related api
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.get("/user/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded?.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
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
    app.put("/users/:id", verifyToken, async (req, res) => {
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
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    // make admin
    app.patch("/users/admin/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // meals related api
    app.get("/meals", async (req, res) => {
      const result = await mealsCollection.find().toArray();
      res.send(result);
    });
    app.get("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealsCollection.findOne(query);
      res.send(result);
    });
    app.patch("/menu/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          title: item.title,
          category: item.category,
          price: item.price,
          ingredients: item.ingredients,
          image: item.image,
        },
      };

      const result = await mealsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.post("/meals", verifyToken, verifyAdmin, async (req, res) => {
      const newMeal = req.body;
      const result = await mealsCollection.insertOne(newMeal);
      res.send(result);
    });
    app.put("/like/:id", async (req, res) => {
      const body = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const update = {
        $inc: { like: 1 },
        $set: { likesBy: body.likesBy },
      };
      const options = { upsert: true };
      const result = await mealsCollection.updateOne(filter, update, options);
      res.json(result);
    });
    app.put("/menu/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const updatedReview = req.body.review;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          review: updatedReview,
        },
      };
      const result = await mealsCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send([result, { status: 200 }]);
    });
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });
    app.delete("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reviewsCollection.deleteOne(query);
      res.send(result);
    });
    app.get("/reviews/:menuId", async (req, res) => {
      const menuId = req.params.menuId;
      const result = await reviewsCollection.find({ menuId: menuId }).toArray();
      res.send(result);
    });
    app.post("/reviews", async (req, res) => {
      const newReview = req.body;
      const result = await reviewsCollection.insertOne(newReview);
      res.send(result);
    });
    app.get("/meal-details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealsCollection.findOne(query);
      res.send(result);
    });

    app.put("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const updatedReview = req.body.details;
      const filter = { _id: new ObjectId(id) };

      console.log(updatedReview);
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          details: updatedReview,
        },
      };
      const result = await reviewsCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    // Request related meal  api
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/carts/allCarts", async (req, res) => {
      const result = await cartsCollection.find().toArray();
      res.send(result);
    });
    app.put("/carts/requestedMeals/serve/:id", async (req, res) => {
      const mealId = req.params.id; // Retrieve the meal ID from the request params
      const { mealStatus } = req.body; // Assuming you're sending 'mealStatus' in the request body

      // Update the meal in the cartCollection by ID
      const result = await cartsCollection.updateOne(
        { _id: new ObjectId(mealId) }, // Assuming mealId is the correct MongoDB ObjectId
        { $set: { mealStatus: mealStatus } } // Update the mealStatus field
      );

      if (result.modifiedCount === 0) {
        return res
          .status(404)
          .json({ message: "Meal not found or not modified" });
      }

      res.send(result);
    });
    // membership related api
    app.get("/membership", async (req, res) => {
      const result = await membershipCollection.find().toArray();
      res.send(result);
    });
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartsCollection.insertOne(cartItem);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    });
    //stripe

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };

      const deleteResult = await cartCollection.deleteMany(query);

      res.send({ paymentResult, deleteResult });
    });

    app.get("/payments", async (req, res) => {
      const userEmail = req.query.email;

      if (!userEmail) {
        return res.status(400).json({ error: "Email parameter is missing" });
      }

      const query = { email: userEmail };

      try {
        const result = await paymentCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // TODO: make payments things in last

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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
