import { useState, useEffect, useRef, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import './ChatInterface.css';

const remarkPlugins = [remarkGfm];

// Only memoize user messages (they never change once sent)
const UserMessage = memo(function UserMessage({ content }) {
  return (
    <div className="message-group">
      <div className="user-message">
        <div className="message-label">You</div>
        <div className="message-content">
          <div className="markdown-content">
            <ReactMarkdown remarkPlugins={remarkPlugins}>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
});

// Memoize completed assistant messages, but skip memo for the active (last) one
const AssistantMessage = memo(function AssistantMessage({ msg, isActive }) {
  return (
    <div className="message-group">
      <div className="assistant-message">
        <div className="message-label">LLM Council</div>

        {/* Stage 1 */}
        {msg.loading?.stage1 && (
          <div className="stage-loading">
            <div className="spinner"></div>
            <span>Running Stage 1: Collecting individual responses...</span>
          </div>
        )}
        {msg.stage1 && <Stage1 responses={msg.stage1} />}

        {/* Stage 2 */}
        {msg.loading?.stage2 && (
          <div className="stage-loading">
            <div className="spinner"></div>
            <span>Running Stage 2: Peer rankings...</span>
          </div>
        )}
        {msg.stage2 && (
          <Stage2
            rankings={msg.stage2}
            labelToModel={msg.metadata?.label_to_model}
            aggregateRankings={msg.metadata?.aggregate_rankings}
          />
        )}

        {/* Stage 3 */}
        {msg.loading?.stage3 && (
          <div className="stage-loading">
            <div className="spinner"></div>
            <span>Running Stage 3: Final synthesis...</span>
          </div>
        )}
        {msg.stage3 && <Stage3 finalResponse={msg.stage3} />}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // If active (streaming), always re-render
  if (prevProps.isActive || nextProps.isActive) return false;
  // Otherwise skip re-render (completed messages don't change)
  return true;
});

export default function ChatInterface({
  conversation,
  onSendMessage,
  onStopGeneration,
  isLoading,
  pendingInput,
  onPendingInputConsumed,
}) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, isLoading]);

  // Recover input from stopped generation
  useEffect(() => {
    if (pendingInput !== null) {
      setInput(pendingInput);
      onPendingInputConsumed();
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [pendingInput]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!conversation) {
    return (
      <div className="chat-interface">
        <div className="empty-state">
          <h2>Welcome to LLM Council</h2>
          <p>Create a new conversation to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {conversation.messages.length === 0 ? (
          <div className="empty-state">
            <h2>Start a conversation</h2>
            <p>Ask a question to consult the LLM Council</p>
          </div>
        ) : (
          conversation.messages.map((msg, index) => {
            if (msg.role === 'user') {
              return <UserMessage key={index} content={msg.content} />;
            }
            const isLastAssistant = isLoading && index === conversation.messages.length - 1;
            return <AssistantMessage key={index} msg={msg} isActive={isLastAssistant} />;
          })
        )}

        {isLoading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <span>Consulting the council...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="input-form" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            className="message-input"
            placeholder="Ask your question... (Shift+Enter for new line, Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={3}
          />
          {isLoading ? (
            <button
              type="button"
              className="stop-button"
              onClick={onStopGeneration}
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              className="send-button"
              disabled={!input.trim()}
            >
              Send
            </button>
          )}
        </form>
    </div>
  );
}
