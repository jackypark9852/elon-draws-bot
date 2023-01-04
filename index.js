import Twit from "twit";
import axios from "axios";
import { Configuration, OpenAIApi } from "openai";
import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

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
  try {
    const ELONS_LAST_POST_2022 = "1609254628113420290";
    const params = {
      query: "from:elonmusk -is:retweet -is:reply -has:media",
      max_results: 10,
      since_id: ELONS_LAST_POST_2022,
      expansions: ["edit_history_tweet_ids"],
    };

    const { data } = await T.get(
      "https://api.twitter.com/2/tweets/search/recent",
      params
    );
    return data.data;
  } catch (err) {
    throw err;
  }
}
// Determines if tweet has been process by creation time
// Not using id because edited tweet gets a new id,, making it seem like two posts
function FilterNewTweets(tweets, processed_tweet_ids) {
  return tweets
    .filter((tweet) => !processed_tweet_ids.includes(tweet.id))
    .filter((tweet) => tweet.edit_history_tweet_ids[0] == tweet.id);
}
async function GenerateArtPrompt(text) {
  try {
    const art_prompt_prompt = `Using the following tweet enclosed in single quotation marks '${text}', generate a prompt for ai art generator to pair with the content in the tweet. Do not include anything but the prompt itself in the response. Do not put an quotation marks around the response.`;
    const { data } = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: art_prompt_prompt,
      max_tokens: 100,
      temperature: 0.9,
    });
    const prompt = data.choices[0].text.trim(); // Select the first prompt that API returns
    return prompt;
  } catch (err) {
    throw err;
  }
}
async function GenerateAIImage(prompt) {
  try {
    const { data } = await openai.createImage({
      prompt: prompt,
      n: 1,
      size: "1024x1024",
    });
    const image_url = data.data[0].url;
    return image_url;
  } catch (err) {
    throw err;
  }
}
async function GenerateTweetText(text) {
  try {
    const TWEET_CHAR_LIMIT = 280;
    const ATTEMPTS_LIMIT = 5;
    const text_prompt = `Generate a short tweet annoucing that I created an image inspired by a new tweet from Elon Musk that includes a short opinion on Elon's tweet provided here: ${text}, and also talk about the significance of art in one short sentence.`;
    let attempts_count = 0;
    while (attempts_count < ATTEMPTS_LIMIT) {
      attempts_count += 1;
      const { data } = await openai.createCompletion({
        // Iteratively call GPT-3 API on every input text to get an art prompt
        model: "text-davinci-003",
        prompt: text_prompt,
        max_tokens: 60,
        temperature: 1,
      });

      const prompt = data.choices[0].text
        .trim()
        .replace(/(?:https?|ftp):\/\/[\n\S]+/g, ""); // Select the first prompt that API returns, remove whitespaces and links
      if (prompt.length <= TWEET_CHAR_LIMIT) {
        return prompt;
      } else {
        console.log(`Generated tweet is too long (length: ${prompt.length}):`);
        console.log(prompt);
      }
    }
    throw new Error("Failed to generate tweet text shorter than 280 chars");
  } catch (err) {
    throw err;
  }
}
async function GenerateTweet(src_tweet) {
  /* 
  src_tweet example: 
  {
    edit_history_tweet_ids: [ '1609631955003518977' ],
    id: '1609631955003518977',
    text: 'Hope you’re having a great day 1 2023!\n' +
      '\n' +
      'One thing’s for sure, it won’t be boring.'
  }
  */
  try {
    const text_req = GenerateTweetText(src_tweet.text);
    const art_prompt = await GenerateArtPrompt(src_tweet.text);
    const image_url_req = GenerateAIImage(art_prompt);
    const attachment_url = `https://twitter.com/twitter/status/${src_tweet.id}`;

    const [text, image_url] = await Promise.all([text_req, image_url_req]); // Wait for promises to be resolved

    return {
      source_tweet: src_tweet,
      tweet: {
        text: text,
        attachment_url: attachment_url,
        image_url: image_url,
      },
      art_prompt: art_prompt,
    };
  } catch (err) {
    throw err;
  }
}
async function ImageUrl2B64File(image_url) {
  try {
    const imageResponse = await axios({
      url: image_url,
      method: "GET",
      responseType: "arraybuffer",
    });
    const file = Buffer.from(imageResponse.data, "binary");
    const base64EncodedFile = file.toString("base64");
    return base64EncodedFile;
  } catch (err) {
    throw err;
  }
}
async function PostTweet(tweet, mongo_client) {
  try {
    const image = await ImageUrl2B64File(tweet.tweet.image_url);
    const text = tweet.tweet.text;
    const attachment_url = tweet.tweet.attachment_url;

    // Upload image to twitter and retrieve media_id used to embed image in a post
    const {
      data: { media_id_string },
    } = await T.post("media/upload", {
      media_data: image,
    });

    // Post a new status and retrieve info about the post, so that it can be recorded in mongo database
    const { data } = await T.post("statuses/update", {
      status: text,
      media_ids: media_id_string,
      attachment_url: attachment_url,
    });

    // Create object to be recorded in mongo db
    const posted_tweet = {
      ...tweet,
      tweet: {
        id: data.id_str,
        created_at: data.created_at,
        ...tweet.tweet,
      },
    };

    await RecordTweet(mongo_client, posted_tweet);
    return posted_tweet;
  } catch (err) {
    throw err;
  }
}
async function RecordTweet(client, posted_tweet) {
  try {
    const response = await client
      .db("elon-art-bot")
      .collection("tweets")
      .insertOne(posted_tweet);
    return response;
  } catch (err) {
    throw err;
  }
}
async function Run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    console.log("Connected to Mongo server successfully");
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

    // Abort if there are no new tweets
    if (filtered_tweets.length == 0) {
      console.log("No new tweets were found!");
      return;
    }

    // Generate tweets
    const generate_tweet_promises = filtered_tweets.map(GenerateTweet);
    const generated_tweets = await Promise.all(generate_tweet_promises);

    // Post Tweets
    const post_tweet_promises = generated_tweets.map((tweet) =>
      PostTweet(tweet, client)
    );
    const posted_tweets = await Promise.all(post_tweet_promises);

    // Give debug message
    console.log("Post succesful!");
    console.log(`Number of tweet(s) posted: ${posted_tweets.length}`);
  } catch (err) {
    console.log(err);
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
    console.log("Disconnected from Mongo server");
  }
}

export {
  Run,
  GenerateArtPrompt,
  GenerateAIImage,
  GenerateTweetText,
  GenerateTweet,
  GetElonTweets,
  PostTweet,
};
