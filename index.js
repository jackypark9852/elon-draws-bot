import Twit from "twit";
import axios from "axios";
import { Configuration, OpenAIApi } from "openai";
import { MongoClient, ServerApiVersion } from "mongodb";
// import dotenv from "dotenv";
// dotenv.config();

const openAI_configuration = new Configuration({
  apiKey: process.env.OPENAI_SECRET_KEY,
});
const openai = new OpenAIApi(openAI_configuration);
var T = new Twit({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_KEY_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  timeout_ms: 60 * 1000, // optional HTTP request timeout to apply to all requests.
});

const uri = `mongodb+srv://jackypark9852:${process.env.MONGO_USER_PW}@elon-art-cluster.hybi4ca.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function GetElonTweets() {
  const ELONS_LAST_POST_2022 = "1609254628113420290";
  const params = {
    query: "from:elonmusk -is:retweet -is:reply -is:quote -has:media",
    max_results: 10,
    since_id: ELONS_LAST_POST_2022,
    expansions: ["edit_history_tweet_ids"],
  };

  const { data } = await T.get(
    "https://api.twitter.com/2/tweets/search/recent",
    params
  );
  return data.data;
}

// Determines if tweet has been process by creation time
// Not using id because edited tweet gets a new id,, making it seem like two posts
function FilterNewTweets(tweets, processed_tweet_ids) {
  return tweets
    .filter((tweet) => !processed_tweet_ids.includes(tweet.id))
    .filter((tweet) => tweet.edit_history_tweet_ids[0] == tweet.id);
}

async function RecordTweets(
  client,
  filtered_tweets,
  posted_tweets,
  art_prompts
) {
  const documents = posted_tweets.map((tweet, i) => ({
    source_tweet: filtered_tweets[i],
    tweet: tweet,
    art_prompt: art_prompts[i],
  }));
  if (documents.length != 0) {
    await client.db("elon-art-bot").collection("tweets").insertMany(documents);
  }
}

async function GenerateArtPrompts(texts) {
  const prompts = await texts.map(async (text) => {
    // Iteratively call GPT-3 API on every input text to get an art prompt
    const { data } = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: CreateGPTArtPrompt(text),
      max_tokens: 100,
      temperature: 0.9,
    });
    const prompt = data.choices[0].text.trim(); // Select the first prompt that API returns
    return prompt;
  });
  return Promise.all(prompts);
}

function CreateGPTArtPrompt(text) {
  return `Using the following tweet enclosed in single quotation marks '${text}', generate a prompt for ai art generator to pair with the content in the tweet. Do not include anything but the prompt itself in the response. Do not put an quotation marks around the response.`;
}

async function GenerateAIImages(prompts) {
  const image_urls = await prompts.map(async (prompt) => {
    const { data } = await openai.createImage({
      prompt: prompt,
      n: 1,
      size: "1024x1024",
    });
    // console.log(data);
    const image_url = data.data[0].url;
    return image_url;
  });
  return Promise.all(image_urls);
}

async function GenerateTweetTexts(texts) {
  const prompts = await texts.map(async (text) => {
    // Iteratively call GPT-3 API on every input text to get an art prompt
    const { data } = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: CreateGPTTweetTextPrompt(text),
      max_tokens: 70,
      temperature: 1,
    });
    const prompt = data.choices[0].text.trim(); // Select the first prompt that API returns
    return prompt;
  });
  return Promise.all(prompts);
}

function CreateGPTTweetTextPrompt(text) {
  return `Write an exciting tweet announcing that I drew something inspired by the following tweet by Elon Musk: '${text}'. Make sure to include a random opinion about art. Keep the quote itself in the tweet" Make sure to be very emotoinal and expressive. Do not include '@elonmusk'. Make sure to include '#ElonMusk' at the end.`;
}

async function PostTweet(text, image_url) {
  const imageResponse = await axios({
    url: image_url,
    method: "GET",
    responseType: "arraybuffer",
  });
  const file = Buffer.from(imageResponse.data, "binary");
  const base64EncodedFile = file.toString("base64");
  const { data } = await T.post("media/upload", {
    media_data: base64EncodedFile,
  });
  const media_id_string = data.media_id_string;

  const response = await T.post("statuses/update", {
    status: text,
    media_ids: media_id_string,
  });
  return response;
}

// Don't create art for tweeets that are edited
async function Run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    console.log("Connected successfully to server");
    // Tweets posted by the bot are stored here

    const processed_tweets = await client
      .db("elon-art-bot")
      .collection("tweets")
      .find()
      .toArray();
    const processed_tweet_ids = processed_tweets.map(
      (tweet) => tweet.source_tweet.id
    );

    // Get tweets
    const tweets = await GetElonTweets();

    // Check if there are new tweets
    const filtered_tweets = FilterNewTweets(tweets, processed_tweet_ids);

    //   Ask for chatgpt to reformat texts into prompts for ai art
    const art_prompts = await GenerateArtPrompts(
      filtered_tweets.map((tweet) => tweet.text)
    );

    // Generate texts
    const tweet_texts = await GenerateTweetTexts(
      filtered_tweets.map((tweet) => tweet.text)
    );

    // Generate images
    const image_urls = await GenerateAIImages(art_prompts);

    try {
      // Post tweets
      const promises = tweet_texts.map((text, i) =>
        PostTweet(text, image_urls[i])
      );
      const responses = await Promise.all(promises);

      // Compile info about posted tweets
      const posted_tweets = responses.map((response) => ({
        created_at: response.data.created_at,
        id: response.data.id_str,
        text: response.data.text,
      }));

      await RecordTweets(client, filtered_tweets, posted_tweets, art_prompts);

      if (posted_tweets.length == 0) {
        console.log(`No new tweets found! ${new Date().toJSON()}`);
      } else {
        // RecordTweets(client, filtered_tweets);
        console.log(
          `${posted_tweets.length} tweets posted! ${new Date().toJSON()}`
        );
      }
    } catch (err) {
      console.log(err);
      return err;
    }
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
    console.log("Disconnected from server");
  }
}

export default Run;
