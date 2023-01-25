const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const validator = require('validator');
const cors = require('cors');

require('dotenv').config();

const app = express();
const mongodb_url = process.env.MONGO_URL;
const port = process.env.PORT;

app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(mongodb_url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const Schema = mongoose.Schema;
const user = new Schema({
  email: String,
  category: String,
  createdAt: Date,
  deletedAt: Date,
}).index({ email: 1, category: 1 });

// Subscription Schema
const User = mongoose.model('subscribers', user);

const validCategories = [
  'sports', 'entertainment', 'boycott', 'hollywood', 'bollywood', 'politics', 'crime', 'religious', 'automobile', 'education', 'health', 'war', 'business', 'fashion', 'environment', 'accidents'
];

// Middleware for validation
const validateInputs = (req, res, next) => {
  const { email, category } = req.body;
  if (!validator.isEmail(email)) {
    return res.status(400).send({ error: 'Invalid email address' });
  }
  if (!validCategories.includes(category)) {
    return res.status(400).send({ error: `Invalid category and should be one of ${validCategories}` });
  }
  next();
};

// Check if user is already subscribed
const checkIfSubscribed = async (req, res, next) => {
  try {
    const subscription = await User.findOne({ email: req.body.email, category: req.body.category, deletedAt: { $exists: false } });
    if (subscription) {
      return res.status(400).send({ error: 'User already subscribed to the category' });
    }
    next();
  } catch (err) {
    res.status(500).send(err);
  }
};

const checkIfUnSubscribedOrNotSubscribed = async (req, res, next) => {
  try {
    const aggregation = await User.aggregate([
      {
        $match: {
          email: req.body.email, category: req.body.category,
        }
      },
      {
        $sort: {
          createdAt: -1,
        }
      },
      {
        $project: {
          deletedAt: 1,
        }
      },
      {
        $limit: 1
      }
    ]);
    if (aggregation.length === 0){
      return res.status(400).send({ error: 'No user subscribed to the category' });
    }
    else if (aggregation[0].deletedAt) {
      return res.status(400).send({ error: 'User already unsubscribed to the category' });
    }
    else next();
  } catch (err) {
    res.status(500).send(err);
  }
};

// Use CORS middleware
app.use(cors());

// Or specify allowed origin
app.use(cors({ origin: '*' }));

// Subscribe Route
app.post('/subscribe', validateInputs, checkIfSubscribed, async (req, res) => {
  try {
    console.log('Subscribe api - ', req.body)
    const subscription = new User({ ...req.body, createdAt: new Date() });
    await subscription.save();
    res.send(subscription);
  } catch (err) {
    res.status(400).send(err);
  }
});

// Unsubscribe Route
app.delete('/unsubscribe', validateInputs, checkIfUnSubscribedOrNotSubscribed, async (req, res) => {
  try {
    console.log('unsubscribe api - ', req.body)
    const unsubscription = await User.findOneAndUpdate({ email: req.body.email, category: req.body.category, deletedAt: { $exists: false } }, { deletedAt: new Date() }, { upsert: false });
    res.send(unsubscription);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.listen(port, () => {
  console.log('Server started on port ', port);
});
