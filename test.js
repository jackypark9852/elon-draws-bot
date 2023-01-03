import { GenerateArtPrompt, GenerateAIImage } from "./index.js";
console.log("Started");
const prompt = await GenerateArtPrompt("Hello");
console.log(prompt);
const image_url = await GenerateAIImage(prompt);
console.log(image_url);
