import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonEnums } from '@ohif/ui';
import { Icons } from '@ohif/ui-next';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
}

const AIAssistant: React.FC = () => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages are added
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Generate a unique ID for each message
  const generateId = () => {
    return Math.random().toString(36).substr(2, 9);
  };

  // Format current timestamp
  const formatTimestamp = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Call Doubao API
  const callDoubaoAPI = async (question: string) => {
    try {
      setIsLoading(true);

      // TODO: Replace with actual Doubao API call
      // For now, we'll simulate a response
      await new Promise(resolve => setTimeout(resolve, 1500));

      const response = {
        answer: `This is a simulated response to your question: "${question}". In a real implementation, this would be replaced with an actual response from the Doubao API.`
      };

      return response.answer;
    } catch (error) {
      console.error('Error calling Doubao API:', error);
      return t('AIAssistant:Error getting response from AI assistant');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      text: inputText.trim(),
      isUser: true,
      timestamp: formatTimestamp()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    // Get AI response
    const aiResponseText = await callDoubaoAPI(inputText.trim());
    const aiMessage: Message = {
      id: generateId(),
      text: aiResponseText,
      isUser: false,
      timestamp: formatTimestamp()
    };

    setMessages(prev => [...prev, aiMessage]);
  };

  // Handle input key press (send on Enter, shift+Enter for new line)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-white">
      <Icons.Info className="mb-4 h-16 w-16 text-primary" />
      <h2 className="mb-2 text-2xl font-bold">{t('WorkList:AI Assistant')}</h2>
      <p className="mb-6 text-center text-gray-400">{t('WorkList:Ask questions about medical images')}</p>
      <div className="w-full max-w-2xl space-y-4">
        {/* Chat messages container */}
        <div className="h-64 rounded-lg bg-gray-800 p-4 overflow-y-auto">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="flex justify-center items-center h-full text-gray-500">
                {t('AIAssistant:No messages yet. Ask your first question!')}
              </div>
            ) : (
              messages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${message.isUser ? 'bg-primary text-white' : 'bg-gray-700 text-white'}`}
                  >
                    <div className="text-sm">{message.text}</div>
                    <div className={`text-xs mt-1 ${message.isUser ? 'text-primary-100' : 'text-gray-400'}`}>
                      {message.timestamp}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="flex flex-col space-y-2">
          <textarea
            className="w-full h-40 rounded-lg bg-gray-800 p-4 text-white resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t('WorkList:Enter your question here...')}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <div className="flex justify-end">
            <Button
              type={ButtonEnums.type.primary}
              size={ButtonEnums.size.medium}
              onClick={handleSendMessage}
              startIcon={isLoading ? <Icons.LoadingSpinner /> : <Icons.ArrowRightBold />}
              disabled={isLoading || !inputText.trim()}
            >
              {isLoading ? t('WorkList:Loading...') : t('WorkList:Send')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
