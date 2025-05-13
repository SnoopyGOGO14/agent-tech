import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface/ChatInterface';
import BudgetCalculator, { setSpecificationManagerRetriever } from './components/BudgetCalculator/BudgetCalculator';
import localModel from './utils/localModel'; // Default import
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    async function initializeApp() {
      try {
        console.log("App.js: Initializing localModel...");
        const initSuccess = await localModel.initializeKnowledgeBase();
        if (initSuccess) {
          console.log("App.js: localModel initialized successfully.");
          // Pass the spec manager retriever to BudgetCalculator
          // BudgetCalculator will call this to get the instance of specManager from localModel
          setSpecificationManagerRetriever(localModel.getSpecificationManager);
          setIsInitialized(true);
        } else {
          console.error("App.js: localModel initialization failed.");
          setError('Failed to initialize critical knowledge components. Please check console and try again.');
        }
      } catch (err) {
        console.error('App.js: Critical error during app initialization:', err);
        setError('Critical error during app initialization. Please refresh and try again.');
      } finally {
        setIsLoading(false);
      }
    }

    if (!isInitialized) {
      initializeApp();
    }
  }, [isInitialized]); // Re-run if isInitialized changes, though it should only run once to set true

  if (isLoading) {
    return <div className="loading-container"><div className="loading-spinner"></div><p>Loading Studio 338 Agent Tech knowledge base...</p></div>;
  }

  if (error) {
    return <div className="error-container"><p>{error}</p></div>;
  }

  if (!isInitialized) {
    // This state could be reached if initialization failed silently or is still in a weird intermediate state
    return <div className="error-container"><p>Application could not be initialized. Please check the console.</p></div>;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Agent Tech - Studio 338 Assistant</h1>
        <nav className="app-nav">
          <button 
            className={`nav-button ${activeTab === 'chat' ? 'active' : ''}`} 
            onClick={() => setActiveTab('chat')}
          >
            Chat Assistant
          </button>
          <button 
            className={`nav-button ${activeTab === 'budget' ? 'active' : ''}`} 
            onClick={() => setActiveTab('budget')}
          >
            Equipment Budget
          </button>
        </nav>
      </header>
      
      <main className="app-main">
        {activeTab === 'chat' && <ChatInterface answerQuestion={localModel.answerQuestion} />}
        {activeTab === 'budget' && <BudgetCalculator />}
         {/* BudgetCalculator will use setSpecificationManagerRetriever to get the manager instance */}
      </main>
      
      <footer className="app-footer">
        <p>Studio 338 Agent Tech - Offline Technical Assistant</p>
      </footer>
    </div>
  );
}

export default App;