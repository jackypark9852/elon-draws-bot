import { GenerateArtPrompt } from "./index.js";
console.log("Started");
const prompt = await GenerateArtPrompt("Hello");
console.log(prompt);
