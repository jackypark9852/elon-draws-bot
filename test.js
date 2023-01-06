import {
  Run,
  GenerateArtPrompt,
  GenerateAIImage,
  GenerateTweetText,
  GetElonTweets,
  GenerateTweet,
  PostTweet,
} from "./index.js";
import { MongoClient, ServerApiVersion } from "mongodb";

const uri = `mongodb+srv://jackypark9852:${process.env.MONGO_USER_PW}@elon-art-cluster.hybi4ca.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const tweets = await GetElonTweets();
console.log(tweets);
const text = await GenerateArtPrompt(tweets[4].text);
console.log(text);
const image_url = await GenerateAIImage(text);
console.log(image_url);
