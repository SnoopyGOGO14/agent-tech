import React, { useState, useEffect, useRef } from 'react';
import './ChatInterface.css';

function ChatInterface({ answerQuestion }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputText.trim() === '') return;
    
    const userMessageText = inputText;
    // Add user message
    const userMessage = {
      text: userMessageText,
      sender: 'user',
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);
    
    // Get response from knowledge base
    try {
      // The answerQuestion function is expected to be passed as a prop
      const responseText = await answerQuestion(userMessageText);
      
      // Add bot response
      const botMessage = {
        text: responseText, // This should be the already formatted response from localModel.js
        sender: 'bot',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error getting response:', error);
      
      // Add error message
      const errorMessage = {
        text: 'Sorry, I encountered an error processing your request.',
        sender: 'bot',
        timestamp: new Date().toISOString(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Agent Tech - Studio 338 Assistant</h2>
      </div>
      
      <div className="messages-container">
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`message ${msg.sender} ${msg.isError ? 'error' : ''}`}
          >
            {/* Render text directly, assuming it's a string. 
                If it can be JSX (like your spec update notification example),
                this part would need adjustment or the response formatted accordingly. */}
            {typeof msg.text === 'string' ? msg.text.split('\n').map((line, i) => (
              <React.Fragment key={i}>{line}<br/></React.Fragment>
            )) : msg.text}
          </div>
        ))}
        
        {isTyping && (
          <div className="message bot typing">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="input-container">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !isTyping && handleSendMessage()}
          placeholder="Ask a question about Studio 338..."
          disabled={isTyping}
        />
        <button onClick={handleSendMessage} disabled={isTyping || inputText.trim() === ''}>
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatInterface;
