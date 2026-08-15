const ALLOWED_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite"
];

const SYSTEM_INSTRUCTIONS = `
You are ShopSathi AI, a professional shopping assistant for Indian users.

Your job:
1. Understand the user's shopping requirement.
2. Identify the product/category.
3. Understand budget if the user gives one.
4. Understand important preferences.
5. Give practical and concise shopping advice.
6. Never invent Amazon prices, ratings, reviews or product specifications.
7. Do not claim that a product is the cheapest unless the data proves it.
8. Create one clean Amazon India search query.
9. Keep the answer easy to understand.
10. If the user gives a budget, respect it in the search query.

Return ONLY valid JSON in this exact format:

{
  "reply": "short helpful shopping advice",
  "searchQuery": "clean Amazon India product search query"
}
`;

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const {
      message,
      model
    } = req.body || {};

    if (!message) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const selectedModel =
      ALLOWED_MODELS.includes(model)
        ? model
        : "gemini-3.6-flash";

    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "GEMINI_API_KEY is missing in Vercel."
      });
    }

    const response =
      await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },

          body: JSON.stringify({

            systemInstruction: {
              parts: [
                {
                  text: SYSTEM_INSTRUCTIONS
                }
              ]
            },

            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: message
                  }
                ]
              }
            ],

            generationConfig: {
              temperature: 0.3,
              responseMimeType: "application/json"
            }

          })
        }
      );

    const data =
      await response.json();

    if (!response.ok) {

      console.error(
        "Gemini error:",
        data
      );

      return res.status(500).json({
        error:
          data?.error?.message ||
          "Gemini API request failed."
      });
    }

    const text =
      data?.candidates?.[0]
      ?.content?.parts?.[0]
      ?.text;

    if (!text) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    let result;

    try {
      result = JSON.parse(text);
    } catch {

      result = {
        reply: text,
        searchQuery: message
      };

    }

    return res.status(200).json({

      reply:
        result.reply ||
        "Here are products matching your requirement.",

      searchQuery:
        result.searchQuery ||
        message,

      model:
        selectedModel

    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error:
        error.message ||
        "AI service failed."
    });
  }
}
