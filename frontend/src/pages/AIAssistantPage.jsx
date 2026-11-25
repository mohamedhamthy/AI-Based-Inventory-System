import { useEffect, useRef, useState } from 'react';
import { FiCpu, FiSend, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import PageHeader from '../components/common/PageHeader';
import { askInventoryAssistant } from '../services/aiService';

const suggestions = [
  'Which parts need reordering?',
  'What has the highest 28-day demand?',
  'How much stock do I have?',
];

const AIAssistantPage = () => {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([{
    id: 'welcome',
    role: 'assistant',
    text: 'I can answer questions using this workspace’s stock, recent sales, demand forecasts, and saved market forecasts. Your data stays in this app; no external AI provider is used.',
  }]);
  const endOfMessages = useRef(null);

  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const submitQuestion = async (value) => {
    const trimmedQuestion = value.trim();
    if (trimmedQuestion.length < 2 || isLoading) return;
    setQuestion('');
    setMessages((current) => [...current, {
      id: `${Date.now()}-user`,
      role: 'user',
      text: trimmedQuestion,
    }]);
    setIsLoading(true);
    try {
      const result = await askInventoryAssistant(trimmedQuestion);
      setMessages((current) => [...current, {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        text: result.reply,
      }]);
    } catch (error) {
      toast.error(error.message || 'Unable to get an inventory answer');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Local Inventory Assistant"
        description="Ask about stock, sales demand, reorder priorities, and saved market forecasts."
      />

      <section className="mx-auto flex min-h-[65vh] max-w-4xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-slate-900/70">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <span className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2 text-cyan-300"><FiCpu /></span>
          <div>
            <h2 className="font-semibold text-white">Inventory insights</h2>
            <p className="text-xs text-slate-400">Private workspace data · No external AI service</p>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite">
          {messages.map((message) => {
            const isUser = message.role === 'user';
            const Icon = isUser ? FiUser : FiCpu;
            return (
              <div key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser ? <span className="mt-1 shrink-0 rounded-lg bg-cyan-500/10 p-2 text-cyan-300"><Icon size={16} /></span> : null}
                <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                  isUser ? 'bg-cyan-400 text-slate-950' : 'border border-white/10 bg-slate-950/70 text-slate-200'
                }`}>{message.text}</p>
                {isUser ? <span className="mt-1 shrink-0 rounded-lg bg-white/10 p-2 text-slate-300"><Icon size={16} /></span> : null}
              </div>
            );
          })}
          {isLoading ? (
            <div role="status" className="flex items-center gap-3 text-sm text-slate-400">
              <span className="rounded-lg bg-cyan-500/10 p-2 text-cyan-300"><FiCpu size={16} /></span>
              Checking workspace inventory…
            </div>
          ) : null}
          <div ref={endOfMessages} />
        </div>

        {messages.length === 1 ? (
          <div className="flex flex-wrap gap-2 px-4 pb-3 sm:px-5">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => submitQuestion(suggestion)}
                disabled={isLoading}
                className="rounded-full border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitQuestion(question);
          }}
          className="flex gap-2 border-t border-white/10 p-4 sm:p-5"
        >
          <label className="sr-only" htmlFor="assistant-question">Ask about your inventory</label>
          <input
            id="assistant-question"
            type="text"
            maxLength={250}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about a product, demand, or reorder…"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50"
          />
          <button
            type="submit"
            aria-label="Send question"
            disabled={isLoading || question.trim().length < 2}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiSend size={16} /><span className="hidden sm:inline">Ask</span>
          </button>
        </form>
      </section>
    </div>
  );
};

export default AIAssistantPage;
