require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');

const app = express();
const port = process.env.PORT || 5001;

// Check if API key is loaded
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in environment variables');
  process.exit(1);
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(bodyParser.json());

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Server is running' });
});

function analyzeTimeComplexity(code, language) {
  const lines = code.split('\n');
  let complexity = 'O(1)';
  let nestedLoops = 0;
  let maxNestedLevel = 0;
  let currentNestedLevel = 0;
  let hasRecursion = false;

  for (const line of lines) {
    // Check for recursion
    if (line.includes('return') && line.includes('(') && line.includes(')')) {
      hasRecursion = true;
    }

    // Check for nested loops
    if (line.includes('for') || line.includes('while')) {
      currentNestedLevel++;
      maxNestedLevel = Math.max(maxNestedLevel, currentNestedLevel);
    } else if (line.includes('}')) {
      currentNestedLevel = Math.max(0, currentNestedLevel - 1);
    }
  }

  // Attach hasRecursion to function for external use
  analyzeTimeComplexity.hasRecursion = hasRecursion;

  // Determine complexity based on nested loops and recursion
  if (hasRecursion) {
    complexity = 'O(2^n)'; // Exponential for recursion
  } else if (maxNestedLevel === 2) {
    complexity = 'O(n²)';
  } else if (maxNestedLevel === 1) {
    complexity = 'O(n)';
  }

  return complexity;
}

function analyzeSpaceComplexity(code, language) {
  const lines = code.split('\n');
  let complexity = 'O(1)';
  let hasArray = false;
  let hasDynamicAllocation = false;
  let hasRecursion = false;
  let hasStackUsage = false;

  // Check for recursion first
  for (const line of lines) {
    if (line.includes('return') && line.includes('(') && line.includes(')')) {
      hasRecursion = true;
      break;
    }
  }

  // Attach hasRecursion to function for external use
  analyzeSpaceComplexity.hasRecursion = hasRecursion;

  // If no recursion, check for data structures
  if (!hasRecursion) {
    for (const line of lines) {
      // Check for array declarations
      if (line.includes('[]') || line.includes('ArrayList') || line.includes('List')) {
        hasArray = true;
      }
      
      // Check for dynamic memory allocation
      if (line.includes('new') || line.includes('malloc')) {
        hasDynamicAllocation = true;
      }

      // Check for stack usage in recursion
      if (line.includes('return') && line.includes('(') && line.includes(')')) {
        hasStackUsage = true;
      }
    }
  }

  // Determine space complexity
  if (hasRecursion || hasStackUsage) {
    complexity = 'O(n)'; // Recursion uses stack space
  } else if (hasArray || hasDynamicAllocation) {
    // Only count array allocations that are not temporary
    if (lines.some(line => line.includes('new') && !line.includes('System.out'))) {
      complexity = 'O(n)';
    }
  }

  return complexity;
}

async function getAIAnalysis(code, language) {
  try {
    console.log('Starting AI analysis...');
    const prompt = `Analyze this ${language} code and provide:
1. A brief explanation of what the code does
2. Potential optimizations
3. Best practices that could be applied
4. Common pitfalls to avoid

Code:
${code}`;

    console.log('Sending request to OpenAI...');
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert code reviewer and software engineer. Provide concise, practical advice."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500
    });

    console.log('Received response from OpenAI');
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error in getAIAnalysis:', error);
    console.error('Error details:', error.response?.data || error.message);
    throw error; // Propagate the error
  }
}

app.post('/analyze', async (req, res) => {
  console.log('Received analyze request');
  const { code, language } = req.body;
  
  if (!code || !language) {
    console.log('Missing code or language');
    return res.status(400).json({ error: 'Code and language are required' });
  }
  
  try {
    console.log('Starting analysis for language:', language);
    const timeComplexity = analyzeTimeComplexity(code, language);
    const spaceComplexity = analyzeSpaceComplexity(code, language);
    
    console.log('Getting AI analysis...');
    let aiAnalysis = null;
    let optimizedCode = null;
    try {
      aiAnalysis = await getAIAnalysis(code, language);

      // Determine if code is optimized or not by checking AI analysis for keywords
      const lowerAIAnalysis = aiAnalysis.toLowerCase();

      // Improved heuristic: check for phrases indicating code is not optimized
      const positiveKeywords = ['optimized', 'best practice', 'efficient'];
      const negativeIndicators = ['could be optimized', 'not efficient', 'can be improved', 'inefficient', 'suboptimal', 'improve', 'optimization'];

      const hasPositive = positiveKeywords.some(keyword => lowerAIAnalysis.includes(keyword));
      const hasNegative = negativeIndicators.some(phrase => lowerAIAnalysis.includes(phrase));

      if (!hasPositive || hasNegative) {
        // Request optimized code from OpenAI
        const optimizationPrompt = `Optimize the following ${language} code for better performance and readability. Provide only the optimized code without explanations.\n\nCode:\n${code}`;

        try {
          const optimizationResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: "You are an expert software engineer who provides optimized code."
              },
              {
                role: "user",
                content: optimizationPrompt
              }
            ],
            max_tokens: 1000
          });

          optimizedCode = optimizationResponse.choices[0].message.content.trim();
        } catch (optimizationError) {
          console.error('Optimized code generation failed:', optimizationError);
          optimizedCode = 'Optimized code generation is currently unavailable due to API quota limits or an error.';
        }
      }
    } catch (aiError) {
      console.error('AI analysis or optimization failed:', aiError);
      // Continue with the analysis even if AI fails
    }
    
    let explanation = `The code has a time complexity of ${timeComplexity} and space complexity of ${spaceComplexity}. `;
    
    if (timeComplexity === 'O(n)') {
      explanation += 'The time complexity is linear because there is a single loop iterating through the input. ';
    } else if (timeComplexity === 'O(n²)') {
      explanation += 'The time complexity is quadratic because there are nested loops. ';
    } else if (timeComplexity === 'O(2^n)') {
      explanation += 'The time complexity is exponential due to recursive calls. ';
    }
    
    if (spaceComplexity === 'O(1)') {
      explanation += 'The space complexity is constant as no additional data structures are used and the memory usage does not grow with input size. ';
    } else if (spaceComplexity === 'O(n)') {
      if (hasRecursion) {
        explanation += 'The space complexity is linear due to the recursive calls using stack space. ';
      } else {
        explanation += 'The space complexity is linear due to the use of arrays or dynamic memory allocation that grows with input size. ';
      }
    }
    
    console.log('Analysis completed successfully');
    res.json({
      timeComplexity,
      spaceComplexity,
      explanation,
      aiAnalysis,
      optimizedCode
    });
  } catch (error) {
    console.error('Error in /analyze endpoint:', error);
    res.status(500).json({ 
      error: 'Error analyzing code',
      details: error.message || 'Unknown error occurred'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: err.message
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('OpenAI API Key loaded:', process.env.OPENAI_API_KEY ? 'Yes' : 'No');
}); 