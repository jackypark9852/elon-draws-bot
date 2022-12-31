let Twit = require('twit')
const fs = require('fs');

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
    var tweetMsgs = data.statuses;
    for (let i = 0; i < tweetMsgs.length; i++) {
        console.log(tweetMsgs[i]?.text)
        console.log(tweetMsgs[i]?.id_str);
    }
    // console.log(tweetMsgs[0])
}

async function GetElonTweets() {
    // Query using since 
    var params = {
    q: 'from:@elonmusk AND -filter:replies AND -filter:retweets AND -filter:media -filter:threads',    
    count: 3
    }
  // download first file
    const result = await T.get('search/tweets', params)
    // console.log(result)
    return result; 
}

function FilterNewTweets(tweets) {

}

async function RecordTweets(filename, tweets) {
    
}

// Don't create art for tweeets that are edited
async function Run() {
    // Get tweets 
    // Check if there are new tweets 
    // Ask for chatgpt to reformat 
    // Ask for Dall-E to generate image 
    // Post 
    const tweets = await GetElonTweets()
    console.log(tweets)
}

Run()