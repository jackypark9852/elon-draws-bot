const Twit = require('twit')
const fs = require('fs');
const Lodash = require('lodash');
const { type } = require('os');

const config_file = fs.readFileSync('./config.json');
const config = JSON.parse(config_file);

var T = new Twit({
  consumer_key: config.TWITTER_API.CONSUMER_KEY, 
  consumer_secret: config.TWITTER_API.CONSUMER_KEY_SECRET, 
  access_token: config.TWITTER_API.ACCESS_TOKEN, 
  access_token_secret: config.TWITTER_API.ACCESS_TOKEN_SECRET, 
  timeout_ms: 60*1000  // optional HTTP request timeout to apply to all requests.
});




function tweetResult(err, data, response) {
    console.log(data)
    var tweetMsgs = data.statuses;
    for (let i = 0; i < tweetMsgs.length; i++) {
        console.log(tweetMsgs[i]?.text)
        console.log(tweetMsgs[i]?.id_str);
    }
    // console.log(tweetMsgs[0])
}

async function GetElonTweets() {
    const params = {
    q: 'from:@elonmusk AND -filter:replies AND -filter:retweets AND -filter:media -filter:threads',    
    count: 3
    }
    const properties = ['text', 'created_at']

    const {data} = await T.get('search/tweets', params)
    const result = data.statuses.map(object => Lodash.pick(object, properties)) // Extract useful properties
    
    return result
}

// Determines if tweet has been process by creation time 
// Not using id because edited tweet gets a new id,, making it seem like two posts 
function FilterNewTweets(tweets, processed_tweets) {
    return tweets.filter(tweet => !processed_tweets.includes(tweet.created_at))
}

async function RecordTweets(filename, new_tweets, processed_tweets) {
    combined_tweets = processed_tweets.concat(new_tweets)
    combined_created_at = combined_tweets.map(object => object.created_at)
    fs.writeFileSync(filename, JSON.stringify(combined_created_at))
}

// Don't create art for tweeets that are edited
async function Run() {
    ELON_TWEETS_JSON_NAME = "elon_tweets.json"

    const processed_tweets = JSON.parse(fs.readFileSync(ELON_TWEETS_JSON_NAME))
    // console.log(processed_tweets)
    // Get tweets 
    const tweets = await GetElonTweets()
    // Check if there are new tweets 
    const filtered_tweets = FilterNewTweets(tweets,processed_tweets)
    // Ask for chatgpt to reformat 
    // Ask for Dall-E to generate image 
    // Post 
    RecordTweets(ELON_TWEETS_JSON_NAME, filtered_tweets, processed_tweets)
}

Run()
