const Twit = require("twit");
const fs = require("fs");
const Lodash = require("lodash");
const download = require("image-downloader");
const uuid = require("uuid");
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

async function GetElonTweets() {
  ELONS_LAST_POST_2022 = "1609254628113420290";
  const params = {
    query: "from:elonmusk -is:retweet -is:reply -is:quote -has:media",
    max_results: 10,
    since_id: ELONS_LAST_POST_2022,
    expansions: ["edit_history_tweet_ids"],
  };
  const properties = ["text", "edit_history_tweet_ids", "id"];

  const { data } = await T.get(
    "https://api.twitter.com/2/tweets/search/recent",
    params
  );
  return data.data;
}

// Determines if tweet has been process by creation time
// Not using id because edited tweet gets a new id,, making it seem like two posts
function FilterNewTweets(tweets, processed_tweets) {
  return tweets
    .filter((tweet) => !processed_tweets.includes(tweet.id))
    .filter((tweet) => tweet.edit_history_tweet_ids[0] == tweet.id);
}

async function RecordTweets(filename, new_tweets, processed_tweets_ids) {
  const new_tweets_ids = new_tweets.map((tweet) => tweet.id);
  const combined_ids = processed_tweets_ids.concat(new_tweets_ids); // Array of only created_date fields
  fs.writeFileSync(filename, JSON.stringify(combined_ids));
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
      max_tokens: 1000,
      temperature: 1,
    });
    const prompt = data.choices[0].text.trim(); // Select the first prompt that API returns
    return prompt;
  });
  return Promise.all(prompts);
}

function CreateGPTTweetTextPrompt(text) {
  return `Write an exciting tweet announcing that I drew something inspired by the following quote by @elonmusk: '${text}'. Make sure to include a random opinion about art. Keep the quote itself in the tweet" Make sure to be very emotoinal and expressive`;
}

async function PostTweet(text, image_url) {
  download_params = {
    url: image_url,
    dest: "../../images",
  };
  const { filename } = await download.image(download_params);
  console.log(`Saved to ${filename}`);

  const image = fs.readFileSync(filename, { encoding: "base64" }); // Load image in b64 encoding
  const { data } = await T.post("media/upload", {
    media_data: image,
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
  ELON_TWEETS_JSON_NAME = "elon_tweets.json";
  const processed_tweets = JSON.parse(fs.readFileSync(ELON_TWEETS_JSON_NAME));

  // Get tweets
  const tweets = await GetElonTweets();

  // Check if there are new tweets
  const filtered_tweets = FilterNewTweets(tweets, processed_tweets);

  //   Ask for chatgpt to reformat texts into prompts for ai art
  const art_prompts = await GenerateArtPrompts(
    filtered_tweets.map((tweet) => tweet.text)
  );

  // Generate texts
  const tweet_texts = await GenerateTweetTexts(
    filtered_tweets.map((tweet) => tweet.text)
  );
  // Generate images
  //   const image_urls = await GenerateAIImages(art_prompts);

  //   console.log(filtered_tweets);
  //   console.log(art_prompts);
  //   console.log(tweet_texts);
  const DUMMY_IMAGE_URL =
    "https://appadvice.com/cdn-cgi/mirage/eaec890b32ee033953d1542683469dcff009881bb0833aa6a0a8b9f19c50cef4/1280/https://is1-ssl.mzstatic.com/image/thumb/Purple122/v4/85/03/65/8503655a-c5d9-c189-f5a9-ad7cd931fbef/AppIcon-0-0-1x_U007emarketing-0-0-0-7-0-0-sRGB-0-0-0-GLES2_U002c0-512MB-85-220-0-0.png/256x256bb.jpg";

  PostTweet(tweet_texts[0], DUMMY_IMAGE_URL);
}

Run();
