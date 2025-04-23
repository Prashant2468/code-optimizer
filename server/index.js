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

// Configure CORS
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://your-vercel-app-url.vercel.app',
    'https://*.vercel.app'  // Allow all Vercel deployments
  ],
  methods: ['GET', 'POST'],
  credentials: true
}));

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
  let hasOnlyIO = true;

  // List of IO operations that should be considered O(1)
  const ioOperations = [
    'System.out',
    'Scanner',
    'scanner',
    'nextInt',
    'nextLine',
    'nextDouble',
    'nextFloat',
    'nextLong',
    'nextShort',
    'nextByte',
    'print',
    'println',
    'printf',
    'close'
  ];

  // List of operations that indicate non-constant time
  const nonConstantOperations = [
    'for',
    'while',
    'do',
    'forEach',
    'map',
    'filter',
    'reduce',
    'sort',
    'Collections.sort',
    'Arrays.sort'
  ];

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines and comments
    if (trimmedLine === '' || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
      continue;
    }

    // Check for non-constant time operations
    if (nonConstantOperations.some(op => trimmedLine.includes(op))) {
      hasOnlyIO = false;
      if (trimmedLine.includes('for') || trimmedLine.includes('while')) {
        currentNestedLevel++;
        maxNestedLevel = Math.max(maxNestedLevel, currentNestedLevel);
      }
    } else if (trimmedLine.includes('}')) {
      currentNestedLevel = Math.max(0, currentNestedLevel - 1);
    }

    // Check for recursion
    if (trimmedLine.includes('return') && 
        trimmedLine.includes('(') && 
        trimmedLine.includes(')') &&
        !ioOperations.some(op => trimmedLine.includes(op))) {
      hasRecursion = true;
      hasOnlyIO = false;
    }

    // Check if line contains any non-IO operations
    if (!ioOperations.some(op => trimmedLine.includes(op)) &&
        !trimmedLine.includes('import') &&
        !trimmedLine.includes('public') &&
        !trimmedLine.includes('class') &&
        !trimmedLine.includes('private') &&
        !trimmedLine.includes('static') &&
        !trimmedLine.includes('void') &&
        !trimmedLine.includes('int') &&
        !trimmedLine.includes('String') &&
        !trimmedLine.includes('{') &&
        !trimmedLine.includes('}')) {
      hasOnlyIO = false;
    }
  }

  // If the code only contains IO operations and declarations, it's O(1)
  if (hasOnlyIO && maxNestedLevel === 0 && !hasRecursion) {
    complexity = 'O(1)';
  } else {
    complexity = hasRecursion ? 'O(2^n)' : 
                maxNestedLevel === 2 ? 'O(n²)' :
                maxNestedLevel === 1 ? 'O(n)' : 'O(1)';
  }

  return {
    complexity,
    hasRecursion
  };
}

function analyzeSpaceComplexity(code, language) {
  const lines = code.split('\n');
  let hasArray = false;
  let hasDynamicAllocation = false;
  let hasRecursion = false;
  let hasInputOutput = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check for input/output operations
    if (trimmedLine.includes('System.out') || 
        trimmedLine.includes('Scanner') || 
        trimmedLine.includes('scanner')) {
      hasInputOutput = true;
      continue; // Skip further analysis for this line
    }

    // Check for recursion
    if (trimmedLine.includes('return') && 
        trimmedLine.includes('(') && 
        trimmedLine.includes(')')) {
      hasRecursion = true;
      break;
    }
  }

  // If there are only input/output operations and no arrays/recursion, complexity is O(1)
  if (hasInputOutput && !hasArray && !hasRecursion) {
    return {
      complexity: 'O(1)',
      hasRecursion
    };
  }

  // If no recursion, check for data structures
  if (!hasRecursion) {
    for (const line of lines) {
      const trimmedLine = line.trim();
      // Check for array declarations
      if (trimmedLine.includes('[]') || 
          trimmedLine.includes('ArrayList') || 
          trimmedLine.includes('List') ||
          trimmedLine.includes('array')) {
        hasArray = true;
      }
      
      // Check for dynamic memory allocation (excluding Scanner)
      if ((trimmedLine.includes('new') || 
          trimmedLine.includes('malloc')) &&
          !trimmedLine.includes('Scanner')) {
        hasDynamicAllocation = true;
      }
    }
  }

  return {
    complexity: (hasRecursion) ? 'O(n)' :
               (hasArray || hasDynamicAllocation) ? 'O(n)' : 'O(1)',
    hasRecursion
  };
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
    const timeAnalysis = analyzeTimeComplexity(code, language);
    const spaceAnalysis = analyzeSpaceComplexity(code, language);
    
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
    
    let explanation = `The code has a time complexity of ${timeAnalysis.complexity} and space complexity of ${spaceAnalysis.complexity}. `;
    
    if (timeAnalysis.complexity === 'O(n)') {
      explanation += 'The time complexity is linear because there is a single loop iterating through the input. ';
    } else if (timeAnalysis.complexity === 'O(n²)') {
      explanation += 'The time complexity is quadratic because there are nested loops. ';
    } else if (timeAnalysis.complexity === 'O(2^n)') {
      explanation += 'The time complexity is exponential due to recursive calls. ';
    }
    
    if (spaceAnalysis.complexity === 'O(1)') {
      explanation += 'The space complexity is constant as no additional data structures are used and the memory usage does not grow with input size. ';
    } else if (spaceAnalysis.complexity === 'O(n)') {
      if (spaceAnalysis.hasRecursion) {
        explanation += 'The space complexity is linear due to the recursive calls using stack space. ';
      } else {
        explanation += 'The space complexity is linear due to the use of arrays or dynamic memory allocation that grows with input size. ';
      }
    }
    
    console.log('Analysis completed successfully');
    res.json({
      timeComplexity: timeAnalysis.complexity,
      spaceComplexity: spaceAnalysis.complexity,
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