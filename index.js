const Twit = require("twit");
const fs = require("fs");
const Lodash = require("lodash");
const { type } = require("os");
const { Configuration, OpenAIApi } = require("openai");

const config_file = fs.readFileSync("./config.json");
const config = JSON.parse(config_file);
const openAI_configuration = new Configuration({
  apiKey: config.OPENAI_API.SECRET_KEY,
});
const openai = new OpenAIApi(openAI_configuration);

var T = new Twit({
  consumer_key: config.TWITTER_API.CONSUMER_KEY,
  consumer_secret: config.TWITTER_API.CONSUMER_KEY_SECRET,
  access_token: config.TWITTER_API.ACCESS_TOKEN,
  access_token_secret: config.TWITTER_API.ACCESS_TOKEN_SECRET,
  timeout_ms: 60 * 1000, // optional HTTP request timeout to apply to all requests.
});

function tweetResult(err, data, response) {
  console.log(data);
  var tweetMsgs = data.statuses;
  for (let i = 0; i < tweetMsgs.length; i++) {
    console.log(tweetMsgs[i]?.text);
    console.log(tweetMsgs[i]?.id_str);
  }
}

async function GetElonTweets() {
  const params = {
    q: "from:@elonmusk AND -filter:replies AND -filter:retweets AND -filter:media -filter:threads",
    count: 3,
  };
  const properties = ["text", "created_at"];

  const { data } = await T.get("search/tweets", params);
  const result = data.statuses.map((object) => Lodash.pick(object, properties)); // Extract useful properties

  return result;
}

// Determines if tweet has been process by creation time
// Not using id because edited tweet gets a new id,, making it seem like two posts
function FilterNewTweets(tweets, processed_tweets) {
  return tweets.filter((tweet) => !processed_tweets.includes(tweet.created_at));
}

async function RecordTweets(filename, new_tweets, processed_tweets_created_at) {
  new_tweets_created_at = new_tweets.map((object) => object.created_at);
  combined_created_at = processed_tweets_created_at.concat(
    new_tweets_created_at
  ); // Array of only created_date fields
  fs.writeFileSync(filename, JSON.stringify(combined_created_at));
}

async function GenerateArtPrompts(texts) {
  const prompts = await texts.map(async (text) => { // Iteratively call GPT-3 API on every input text to get an art prompt
    const { data } = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: CreateGPTPrompt(text), 
      max_tokens: 100,
      temperature: 0.7,
    });
    const prompt = data.choices[0].text.trim(); // Select the first prompt that API returns 
    return prompt;
  });
  return Promise.all(prompts); 
}

function CreateGPTPrompt(text) {
    return ("Using the following tweet enclosed in single quotation marks `" +
        text +
        "`, generate a prompt for ai art generator to visualize the message the tweet. Do not include anything but the prompt itself in the response. Do not put an quotation marks around the response.",)
}

// Don't create art for tweeets that are edited
async function Run() {
  ELON_TWEETS_JSON_NAME = "elon_tweets.json";

  const processed_tweets = JSON.parse(fs.readFileSync(ELON_TWEETS_JSON_NAME));
  // Get tweets
  const tweets = await GetElonTweets();
  // Check if there are new tweets
  const filtered_tweets = FilterNewTweets(tweets, processed_tweets);
  // Ask for chatgpt to reformat
  const art_prompts = await GenerateArtPrompts(
    filtered_tweets.map((tweet) => tweet.text)
  );
  //   console.log(art_prompts);
  console.log(art_prompts);

  // Ask for Dall-E to generate image
  // Post
  //   RecordTweets(ELON_TWEETS_JSON_NAME, filtered_tweets, processed_tweets);
}

Run();
