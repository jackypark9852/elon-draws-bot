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
const text = await GenerateTweetText(tweets[4].text);
console.log(text);

// const prompt =
//   "I just created an image inspired by @elonmusk's latest tweet - highlighting that art can help us interpret world events. US govt's suspension of 250k accounts is an important one! #freedomofexpression #artsignificance https://t.co/Yxxxxx";
// const link_removed = prompt
// console.log(link_removed);
