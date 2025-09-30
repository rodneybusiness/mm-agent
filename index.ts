import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Echo tool schema
const echoSchema = z.object({ 
  text: z.string() 
});

// Simple echo function
async function echo(params: z.infer<typeof echoSchema>) {
  return `You said: ${params.text}`;
}

async function run() {
  try {
    // Simple Claude conversation
    const response = await client.messages.create({
      model: "claude-3-sonnet-20241022",
      max_tokens: 100,
      messages: [{ 
        role: "user", 
        content: "Say hello and introduce yourself as a helpful agent!" 
      }],
    });

    console.log("Agent Response:");
    console.log(response.content[0].type === "text" ? response.content[0].text : "");

    // Test the echo functionality
    const echoResult = await echo({ text: "Hello from mm-agent!" });
    console.log("\nEcho Test:");
    console.log(echoResult);

  } catch (error) {
    console.error("Error:", error);
  }
}

run();