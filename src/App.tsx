import React, { useState, useRef } from 'react';
import { Play, Loader2, Mic, MicOff } from 'lucide-react';

const App: React.FC = () => {
  const [goal, setGoal] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error(event.error);
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setGoal(prev => (prev + ' ' + finalTranscript).trim());
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const runAgent = async () => {
    if (!goal) return;
    setIsRunning(true);
    setStatus('Initializing agent...');
    setScreenshot(null);

    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data:')) {
            try {
              const jsonContent = trimmedLine.substring(5).trim();
              if (!jsonContent) continue;
              const data = JSON.parse(jsonContent);

              if (data.screenshot) {
                setScreenshot(data.screenshot);
              }

              if (data.type === 'finish') {
                setStatus(`✅ Complete: ${data.answer}`);
                setIsRunning(false);

                // Redirect to the final URL if available
                if (data.finalUrl && data.finalUrl !== 'about:blank') {
                  setTimeout(() => {
                    window.location.href = data.finalUrl;
                  }, 2000); // Give user 2 seconds to see the success message
                }
              } else if (data.type === 'error') {
                setStatus(`❌ Error: ${data.message}`);
                setIsRunning(false);
              } else {
                setStatus(`Step ${data.step + 1}: ${data.thought || 'Processing...'}`);
              }
            } catch (err) {
              console.error("Parse error on line:", trimmedLine, err);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setStatus('❌ Connection error');
      setIsRunning(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '600px',
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '20px',
        padding: '3rem',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '800',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem',
          textAlign: 'center'
        }}>
          AETHER
        </h1>

        <p style={{
          textAlign: 'center',
          color: '#64748b',
          fontSize: '0.875rem',
          marginBottom: '2rem',
          fontWeight: '500'
        }}>
          Autonomous Web Agent
        </p>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#334155',
            }}>
              Mission Objective
            </label>
            <button
              onClick={toggleListening}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: isListening ? '#ef4444' : '#667eea',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem',
                fontWeight: '600',
                padding: '4px 8px',
                borderRadius: '6px',
                transition: 'all 0.2s',
                backgroundColor: isListening ? '#fee2e2' : 'transparent',
              }}
            >
              {isListening ? (
                <><MicOff size={14} /> STOP RECORDING</>
              ) : (
                <><Mic size={14} /> VOICE INPUT</>
              )}
            </button>
          </div>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Example: Find the latest SpaceX news on Google..."
            disabled={isRunning}
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '1rem',
              fontSize: '1rem',
              border: '2px solid #e2e8f0',
              borderRadius: '12px',
              resize: 'vertical',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
              outline: 'none',
              borderColor: isListening ? '#ef4444' : '#e2e8f0',
            }}
            onFocus={(e) => e.target.style.borderColor = '#667eea'}
            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
          />
        </div>

        <button
          onClick={runAgent}
          disabled={isRunning || !goal}
          style={{
            width: '100%',
            padding: '1rem',
            fontSize: '1rem',
            fontWeight: '700',
            color: 'white',
            background: isRunning || !goal ? '#94a3b8' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '12px',
            cursor: isRunning || !goal ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s',
            boxShadow: isRunning || !goal ? 'none' : '0 4px 15px rgba(102, 126, 234, 0.4)',
          }}
          onMouseEnter={(e) => {
            if (!isRunning && goal) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = isRunning || !goal ? 'none' : '0 4px 15px rgba(102, 126, 234, 0.4)';
          }}
        >
          {isRunning ? (
            <>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              EXECUTING...
            </>
          ) : (
            <>
              <Play size={20} fill="white" />
              INITIATE AGENT
            </>
          )}
        </button>

        {status && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: status.startsWith('✅') ? '#f0fdf4' : status.startsWith('❌') ? '#fef2f2' : '#f8fafc',
            border: `2px solid ${status.startsWith('✅') ? '#86efac' : status.startsWith('❌') ? '#fca5a5' : '#e2e8f0'}`,
            borderRadius: '12px',
            fontSize: '0.875rem',
            color: status.startsWith('✅') ? '#166534' : status.startsWith('❌') ? '#991b1b' : '#475569',
            fontWeight: '500',
            lineHeight: '1.5'
          }}>
            {status}
          </div>
        )}

        {screenshot && (
          <div style={{
            marginTop: '1.5rem',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '2px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <img
              src={`data:image/jpeg;base64,${screenshot}`}
              alt="Agent View"
              style={{ width: '100%', display: 'block' }}
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default App;
