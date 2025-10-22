/**
 * Test endpoint to verify AI actually works
 */
import { Hono } from 'hono';

const app = new Hono();

/**
 * Extract JSON from AI response that may be wrapped in markdown code blocks
 */
function extractJSON(text) {
  // Try to find JSON in markdown code blocks (```json ... ```)
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim());
  }

  // Try to find JSON object directly (starts with { and ends with })
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  // Last resort: try parsing the whole thing
  return JSON.parse(text);
}

app.get('/test-ai', async (c) => {
  try {
    console.log('[TEST-AI] Testing AI binding...');
    
    const response = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Respond with exactly: AI WORKS' }
      ]
    });
    
    return c.json({
      success: true,
      response: response
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, 500);
  }
});

app.get('/test-coordination-ai', async (c) => {
  try {
    console.log('[TEST-AI] Testing Cognitive-Coordination AI...');

    const prompt = `Analyze this task and determine its complexity:

Task: {"description":"Create database, upload 5 files, send notifications, generate report","type":"complex"}

Provide:
1. Complexity level (simple, moderate, complex)
2. Required subtasks
3. Dependencies between subtasks
4. Estimated execution time
5. Potential risks

Respond in JSON format: {
  "complexity": "simple|moderate|complex",
  "subtasks": [{"description": "...", "dependencies": [], "priority": 1}],
  "estimatedTime": 1000,
  "risks": ["..."]
}`;

    const response = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are a task analysis expert. Analyze tasks and provide structured decomposition in valid JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    let parsed = null;
    let parseError = null;

    try {
      parsed = extractJSON(response.response);
    } catch (e) {
      parseError = e.message;
    }

    return c.json({
      success: true,
      rawResponse: response.response,
      parsed: parsed,
      parseError: parseError
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, 500);
  }
});

export { app as testAI };
