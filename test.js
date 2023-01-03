import {
  GenerateArtPrompt,
  GenerateAIImage,
  GenerateTweetText,
} from "./index.js";
console.log("Started");
// const prompt = await GenerateArtPrompt("Hello");
// console.log(prompt);
// const image_url = await GenerateAIImage(prompt);
// console.log(image_url);
const src_text = "Hello World!";
const generated_text = await GenerateTweetText(src_text);
console.log(generated_text);
