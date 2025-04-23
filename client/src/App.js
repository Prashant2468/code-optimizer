import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('java');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const validateCodeLanguage = (code, selectedLanguage) => {
    const languagePatterns = {
      java: [
        /public\s+class/,
        /System\.out\.println/,
        /import\s+java\./,
        /String\[\]\s+args/
      ],
      cpp: [
        /#include\s+<iostream>/,
        /cout\s+<<|cin\s+>>/,
        /std::/,
        /int\s+main\s*\(/
      ],
      python: [
        /def\s+\w+\s*\(/,
        /print\s*\(/,
        /import\s+\w+/,
        /if\s+__name__\s*==\s*['"]__main__['"]/
      ]
    };

    const patterns = languagePatterns[selectedLanguage];
    return patterns.some(pattern => pattern.test(code));
  };

  const handleAnalyze = async () => {
    if (!code.trim()) {
      toast.error('Please enter some code to analyze!');
      return;
    }

    if (!validateCodeLanguage(code, language)) {
      toast.warning(`The code doesn't appear to be ${language.toUpperCase()}. Please check your code or select the correct language.`);
      return;
    }

    setLoading(true);
    try {
      await axios.get('http://localhost:5001/test');
      const response = await axios.post('http://localhost:5001/analyze', {
        code,
        language
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setAnalysis(response.data);
      toast.success('Analysis completed successfully!');
    } catch (error) {
      console.error('Error analyzing code:', error);
      let errorMessage = 'Error analyzing code. Please try again.';

      if (error.response) {
        errorMessage = error.response.data.details || error.response.data.error || errorMessage;
      } else if (error.request) {
        errorMessage = 'Server is not responding. Please check if the server is running.';
      }

      toast.error(errorMessage);
    }
    setLoading(false);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <ToastContainer theme={darkMode ? "dark" : "light"} />

      <header className="border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-y-2">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            Code Complexity Analyzer
          </h1>
          <div className="flex items-center gap-4">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={`px-3 py-1.5 rounded-lg border transition-colors duration-200 w-full sm:w-auto ${
                darkMode 
                ? 'bg-gray-800 border-gray-700 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="java">Java</option>
              <option value="cpp">C++</option>
              <option value="python">Python</option>
            </select>
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-colors duration-200 ${
                darkMode 
                ? 'bg-gray-700 text-white hover:bg-gray-600' 
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              {darkMode ? '🌞' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row">
        <div className="w-full lg:w-1/2 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className={`w-full px-4 py-2 rounded-lg transition-colors duration-200 ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {loading ? 'Analyzing...' : 'Analyze Code'}
            </button>
          </div>
          <div className="flex-1 min-h-[400px]">
            <Editor
              height="100%"
              language={language}
              theme={darkMode ? 'vs-dark' : 'light'}
              value={code}
              onChange={setCode}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
                wordWrap: 'on',
              }}
            />
          </div>
        </div>

        <div className="w-full lg:w-1/2 overflow-auto">
          {analysis ? (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
                  <h3 className="text-lg font-semibold mb-2">Time Complexity</h3>
                  <p className="text-2xl font-mono text-blue-500">{analysis.timeComplexity}</p>
                </div>
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
                  <h3 className="text-lg font-semibold mb-2">Space Complexity</h3>
                  <p className="text-2xl font-mono text-green-500">{analysis.spaceComplexity}</p>
                </div>
              </div>

              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
                <h3 className="text-lg font-semibold mb-2">Explanation</h3>
                <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {analysis.explanation}
                </p>
              </div>

              {analysis.aiAnalysis && (
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
                  <h3 className="text-lg font-semibold mb-2">AI Analysis</h3>
                  <div className={`prose ${darkMode ? 'prose-invert' : ''} max-w-none`}>
                    {analysis.aiAnalysis.split('\n').map((line, index) => (
                      <p key={index} className="mb-2">{line}</p>
                    ))}
                  </div>
                </div>
              )}

              {analysis.optimizedCode && (
                <div className={`p-6 mt-6 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
                  <h3 className="text-lg font-semibold mb-2">Optimized Code</h3>
                  <pre className={`whitespace-pre-wrap break-words font-mono text-sm ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
                    {analysis.optimizedCode}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-6">
              <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Run analysis to see results here
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
